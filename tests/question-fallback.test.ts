import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/db', () => ({
  db: {
    interviewSession: { findFirst: vi.fn() },
    profile: { findUnique: vi.fn() },
    questionAttempt: { findMany: vi.fn() },
    question: { findMany: vi.fn(), create: vi.fn() },
  },
}));
import { db } from '@/lib/db';
import { generateNext } from '@/server/questions';
import { ai } from '@/server/ai';
import { AppError } from '@/lib/http';
import { offlineBank } from '@/server/offline';
import { hashQuestion } from '@/lib/math';

const session = {
  id: 's',
  userId: 'u',
  mode: 'Technical',
  status: 'active',
  targetCount: 5,
  difficulty: 'easy',
  language: 'Python',
  expiresAt: null,
  topic: null,
  questions: [],
};
beforeEach(() => {
  vi.stubEnv('PRACTICE_MODE', '');
  vi.stubEnv('GEMINI_API_KEY', 'invalid-key');
  vi.mocked(db.interviewSession.findFirst).mockResolvedValue(session as never);
  vi.mocked(db.profile.findUnique).mockResolvedValue({ role: 'Developer' } as never);
  vi.mocked(db.questionAttempt.findMany).mockResolvedValue([]);
  vi.mocked(db.question.findMany).mockResolvedValue([]);
  vi.mocked(db.question.create).mockImplementation(
    ({ data }) => ({ id: 'q', hintsUsed: 0, ...data }) as never,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe('question generation fallback', () => {
  it('saves a real bank question when the configured provider fails', async () => {
    vi.spyOn(ai, 'structured').mockRejectedValue(new AppError(502, 'Invalid key'));
    const question = await generateNext('u', 's');
    expect(question.title).toContain('Practice bank:');
    expect(db.question.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ embeddingModel: 'offline-bank-v1', embedding: [] }),
      }),
    );
  });
  it('keeps the session on the bank without retrying the failed provider', async () => {
    const first = offlineBank('Technical')[0];
    vi.mocked(db.interviewSession.findFirst).mockResolvedValue({
      ...session,
      questions: [{ payload: first, attempt: {} }],
    } as never);
    vi.mocked(db.question.findMany).mockResolvedValue([
      { hash: hashQuestion(first.question) },
    ] as never);
    const remote = vi.spyOn(ai, 'structured');
    const question = await generateNext('u', 's');
    expect(question.question).not.toBe(first.question);
    expect(remote).not.toHaveBeenCalled();
  });
  it('reports database errors without saving a replacement question', async () => {
    vi.mocked(db.question.findMany).mockRejectedValue(new Error('Database unavailable'));
    await expect(generateNext('u', 's')).rejects.toThrow('Database unavailable');
    expect(db.question.create).not.toHaveBeenCalled();
  });
  it('reports bank exhaustion without repeating a question', async () => {
    vi.stubEnv('PRACTICE_MODE', 'standard');
    vi.mocked(db.question.findMany).mockResolvedValue(
      offlineBank('Technical').map((q) => ({ hash: hashQuestion(q.question) })) as never,
    );
    await expect(generateNext('u', 's')).rejects.toMatchObject({ status: 409 });
    expect(db.question.create).not.toHaveBeenCalled();
  });
});
