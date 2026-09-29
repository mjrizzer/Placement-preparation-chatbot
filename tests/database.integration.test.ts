import { describe, it, expect, vi, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { question, evaluation, plan, profile } from './fixtures';
import { ai } from '@/server/ai';
import { executor } from '@/server/execution';
import { generateNext } from '@/server/questions';
import {
  submitAnswer,
  sessionDetail,
  finishSession,
  codeAction,
  analytics,
  hint,
} from '@/server/interviews';
import { withUserLock, rateLimit } from '@/lib/security';
import type { z } from 'zod';
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return {
    db: new PrismaClient({
      datasourceUrl:
        process.env.TEST_DATABASE_URL ||
        'postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured',
    }),
  };
});
import { db } from '@/lib/db';
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('PostgreSQL interview lifecycle (mocked external providers)', () => {
  let userId = '';
  let otherId = '';
  let sessionId = '';
  const ids: string[] = [];
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL?.includes('placement_test'))
      throw new Error('Integration tests require a disposable database named placement_test.');
    await db.$connect();
  });
  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'mock-provider-only');
    const user = await db.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: 'test-only',
        profile: { create: profile },
      },
    });
    userId = user.id;
    ids.push(userId);
    const other = await db.user.create({
      data: { email: `other-${randomUUID()}@example.com`, passwordHash: 'test-only' },
    });
    otherId = other.id;
    ids.push(otherId);
    sessionId = (
      await db.interviewSession.create({
        data: {
          userId,
          mode: 'Technical',
          difficulty: 'medium',
          language: 'Python',
          targetCount: 3,
        },
      })
    ).id;
    vi.spyOn(ai, 'embed').mockResolvedValue([1, 0, 0]);
    vi.spyOn(ai, 'structured').mockImplementation(
      async <T>(
        name: string,
        _instructions: string,
        _data: unknown,
        schema: z.ZodType<T>,
      ): Promise<T> =>
        schema.parse(
          name === 'evaluation'
            ? evaluation
            : name === 'improvement_plan'
              ? plan
              : name === 'interview_report'
                ? {
                    summary: 'Completed interview.',
                    strengths: ['Indexing'],
                    weaknesses: ['Traversal'],
                    nextSteps: ['Practice collections'],
                  }
                : name === 'similarity'
                  ? { duplicate: false }
                  : question,
        ),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it('persists questions, feedback, mistakes, and a plan atomically', async () => {
    const q = await generateNext(userId, sessionId);
    expect(q).not.toHaveProperty('explanation');
    await submitAnswer(userId, q.id, 'Indexed access is fast.');
    const detail = await sessionDetail(userId, sessionId);
    expect(detail.questions[0].attempt?.score).toBe(73);
    expect(detail.questions[0].attempt?.mistakes[0].type).toBe('Incomplete answer');
    await finishSession(userId, sessionId);
    expect((await sessionDetail(userId, sessionId)).status).toBe('completed');
    expect(await db.improvementTask.count({ where: { plan: { userId } } })).toBe(7);
    const a = await analytics(userId);
    expect(a.questionsSolved).toBe(1);
    expect(a.sessionsCompleted).toBe(1);
  });
  it('does not score repeated submissions twice', async () => {
    const q = await generateNext(userId, sessionId);
    const a = await submitAnswer(userId, q.id, 'Indexed access.');
    const b = await submitAnswer(userId, q.id, 'Changed answer.');
    expect(b.id).toBe(a.id);
    expect(await db.questionAttempt.count({ where: { questionId: q.id } })).toBe(1);
  });
  it('returns the outstanding question instead of generating another', async () => {
    const q = await generateNext(userId, sessionId);
    expect((await generateNext(userId, sessionId)).id).toBe(q.id);
    expect(ai.structured).toHaveBeenCalledTimes(1);
  });
  it('rejects semantically equivalent paraphrases and generates a distinct question', async () => {
    const q = await generateNext(userId, sessionId);
    await submitAnswer(userId, q.id, 'Indexed access.');
    vi.mocked(ai.embed).mockResolvedValueOnce([0.99, 0.01, 0]).mockResolvedValueOnce([0, 1, 0]);
    vi.mocked(ai.structured)
      .mockResolvedValueOnce({
        ...question,
        question: 'Describe random lookup tradeoffs in a collection.',
      })
      .mockResolvedValueOnce({
        ...question,
        title: 'Transactions',
        question: 'How would you prevent a lost update?',
        concept: 'Concurrent transaction isolation',
        topic: 'Databases',
      });
    const next = await generateNext(userId, sessionId);
    expect(next.question).toBe('How would you prevent a lost update?');
    expect(await db.question.count({ where: { userId } })).toBe(2);
  });
  it('uses semantic adjudication for borderline embeddings', async () => {
    const q = await generateNext(userId, sessionId);
    await submitAnswer(userId, q.id, 'Indexed access.');
    vi.mocked(ai.embed).mockResolvedValueOnce([0.8, 0.6, 0]).mockResolvedValueOnce([0, 0, 1]);
    vi.mocked(ai.structured)
      .mockResolvedValueOnce({
        ...question,
        question: 'What are the lookup tradeoffs for this collection?',
      })
      .mockResolvedValueOnce({ duplicate: true })
      .mockResolvedValueOnce({
        ...question,
        question: 'Describe deadlock detection.',
        concept: 'Deadlock cycle detection',
        topic: 'Operating Systems',
      });
    expect((await generateNext(userId, sessionId)).question).toBe('Describe deadlock detection.');
  });
  it('fails closed when only duplicate questions can be generated', async () => {
    const q = await generateNext(userId, sessionId);
    await submitAnswer(userId, q.id, 'Indexed access.');
    await expect(generateNext(userId, sessionId)).rejects.toMatchObject({ status: 503 });
    expect(await db.question.count({ where: { userId } })).toBe(1);
  });
  it('enforces student ownership on sessions and answers', async () => {
    const q = await generateNext(userId, sessionId);
    await expect(sessionDetail(otherId, sessionId)).rejects.toMatchObject({ status: 404 });
    await expect(submitAnswer(otherId, q.id, 'Access another user')).rejects.toMatchObject({
      status: 404,
    });
  });
  it('persists progressive hint limits without revealing the explanation', async () => {
    const q = await generateNext(userId, sessionId);
    expect((await hint(userId, q.id)).hint).toBe(question.hints[0]);
    expect((await hint(userId, q.id)).hint).toBe(question.hints[1]);
    await expect(hint(userId, q.id)).rejects.toMatchObject({ status: 409 });
  });
  it('enforces the mock test deadline on the server', async () => {
    await db.interviewSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(generateNext(userId, sessionId)).rejects.toMatchObject({ status: 409 });
  });
  it('validates generated coding tests and stores final submission results', async () => {
    await db.interviewSession.update({ where: { id: sessionId }, data: { mode: 'Coding' } });
    const coding = {
      ...question,
      kind: 'coding',
      coding: {
        inputFormat: 'One integer',
        outputFormat: 'The integer',
        constraints: ['0 <= n <= 10'],
        examples: [{ input: '1', output: '1' }],
        hiddenTests: Array.from({ length: 5 }, (_, i) => ({
          input: String(i + 2),
          output: String(i + 2),
        })),
        expectedComplexity: 'O(1)',
        tags: ['Arrays'],
        referencePython: 'print(input())',
      },
    };
    vi.mocked(ai.structured).mockResolvedValueOnce(coding);
    vi.spyOn(executor, 'run').mockResolvedValue({
      status: 'Accepted',
      passed: true,
      stdout: 'private-output',
      stderr: '',
      time: 0.01,
      memory: 100,
    });
    const q = await generateNext(userId, sessionId);
    const result = await codeAction(userId, q.id, 'print(input())', 'Python', true);
    expect(result.passed).toBe(6);
    expect(
      result.results.filter((r) => 'hidden' in r && r.hidden).every((r) => !('stdout' in r)),
    ).toBe(true);
    expect(await db.codingSubmission.count({ where: { questionId: q.id, isFinal: true } })).toBe(1);
    expect((await sessionDetail(userId, sessionId)).questions[0].attempt?.score).toBe(92);
  });
  it('serializes concurrent operations across clients', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let entered: () => void = () => {};
    const ready = new Promise<void>((r) => {
      entered = r;
    });
    const operation = withUserLock(userId, async () => {
      entered();
      await gate;
      return 'done';
    });
    await ready;
    try {
      await expect(withUserLock(userId, async () => {})).rejects.toMatchObject({ status: 409 });
    } finally {
      release();
    }
    expect(await operation).toBe('done');
    expect(await db.operationLock.findUnique({ where: { userId } })).toBeNull();
  });
  it('enforces a shared database rate limit', async () => {
    const key = randomUUID();
    await rateLimit(key, 2);
    await rateLimit(key, 2);
    await expect(rateLimit(key, 2)).rejects.toMatchObject({ status: 429 });
  });
});
// Importing PrismaClient is deliberately checked by TypeScript alongside the generated schema.
export type DatabaseClient = PrismaClient;
