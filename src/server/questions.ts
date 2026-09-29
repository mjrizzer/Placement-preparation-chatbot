import { db } from '@/lib/db';
import { cosine, hashQuestion } from '@/lib/math';
import { AppError } from '@/lib/http';
import { type GeneratedQuestion, questionSchema, type PublicQuestion } from '@/lib/contracts';
import { topics, sectionFor } from '@/lib/catalog';
import {
  ai,
  equivalent,
  QuestionGenerator,
  AptitudeGenerator,
  DSAGenerator,
  CodingProblemGenerator,
  ResumeInterviewer,
} from './ai';
import { executeTests } from './execution';
import type { Question } from '@prisma/client';
import { offlineBank } from './offline';
export function publicQuestion(q: Question): PublicQuestion {
  const data = questionSchema.parse(q.payload);
  return {
    id: q.id,
    position: q.position,
    hintsUsed: q.hintsUsed,
    revealedHints: data.hints.slice(0, Math.min(q.hintsUsed, 2)),
    title: data.title,
    question: data.question,
    topic: data.topic,
    concept: data.concept,
    difficulty: data.difficulty,
    kind: data.kind,
    followUpPossible: data.followUpPossible,
    coding: data.coding
      ? {
          inputFormat: data.coding.inputFormat,
          outputFormat: data.coding.outputFormat,
          constraints: data.coding.constraints,
          examples: data.coding.examples,
          tags: data.coding.tags,
        }
      : null,
  };
}
export async function studentContext(userId: string) {
  const [profile, attempts] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.questionAttempt.findMany({
      where: { question: { userId } },
      include: {
        question: { select: { topic: true, kind: true, difficulty: true, content: true } },
        mistakes: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);
  const stats = new Map<string, { sum: number; n: number }>();
  for (const a of attempts) {
    const s = stats.get(a.question.topic) || { sum: 0, n: 0 };
    s.sum += a.score;
    s.n++;
    stats.set(a.question.topic, s);
  }
  const performance = Array.from(stats, ([topic, s]) => ({
    topic,
    score: Math.round(s.sum / s.n),
    attempts: s.n,
  })).sort((a, b) => a.score - b.score);
  return {
    profile,
    performance,
    weakTopics: performance.filter((p) => p.score < 65),
    strongTopics: performance.filter((p) => p.score >= 80),
    previousMistakes: attempts.flatMap((a) => a.mistakes).slice(0, 20),
    recent: attempts
      .slice(0, 10)
      .map((a) => ({ topic: a.question.topic, score: a.score, feedback: a.feedback })),
  };
}
export async function generateNext(userId: string, sessionId: string) {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: { questions: { orderBy: { position: 'asc' }, include: { attempt: true } } },
  });
  if (!session) throw new AppError(404, 'Interview not found.');
  if (session.status !== 'active') throw new AppError(409, 'This interview has ended.');
  if (session.expiresAt && session.expiresAt.getTime() <= Date.now())
    throw new AppError(
      409,
      'The mock test time has expired. Finish the session to receive your report.',
    );
  const unanswered = session.questions.find((q) => !q.attempt);
  if (unanswered) return publicQuestion(unanswered);
  if (session.questions.length >= session.targetCount)
    throw new AppError(
      409,
      'All questions are complete. Finish the session to receive your report.',
    );
  const context = await studentContext(userId);
  if (!context.profile)
    throw new AppError(400, 'Complete your profile before starting an interview.');
  const position = session.questions.length;
  const mode =
    session.mode === 'Mock'
      ? sectionFor(position)
      : session.mode === 'Mixed'
        ? ['Technical', 'Quantitative Aptitude', 'DSA', 'Logical Reasoning', 'HR'][position % 5]
        : session.mode;
  if (!process.env.OPENAI_API_KEY) {
    const history = await db.question.findMany({ where: { userId }, select: { hash: true } });
    const seen = new Set(history.map((q) => q.hash));
    const bank = offlineBank(mode);
    const candidate =
      bank.find((q) => !seen.has(hashQuestion(q.question)) && q.topic === session.topic) ??
      bank.find((q) => !seen.has(hashQuestion(q.question)));
    if (!candidate)
      throw new AppError(
        409,
        'You have completed this offline question bank. Try another practice mode, or add an AI key for new questions.',
      );
    const saved = await db.question.create({
      data: {
        userId,
        sessionId,
        position,
        content: candidate.question,
        hash: hashQuestion(candidate.question),
        embedding: [],
        embeddingModel: 'offline-bank-v1',
        concept: candidate.concept,
        topic: candidate.topic,
        difficulty: candidate.difficulty,
        kind: candidate.kind,
        payload: candidate,
      },
    });
    return publicQuestion(saved);
  }
  const generator =
    mode === 'Coding'
      ? new CodingProblemGenerator()
      : ['Aptitude', 'Quantitative Aptitude', 'Logical Reasoning', 'Verbal'].includes(mode)
        ? new AptitudeGenerator()
        : mode === 'DSA'
          ? new DSAGenerator()
          : mode === 'Resume'
            ? new ResumeInterviewer()
            : new QuestionGenerator();
  const last = session.questions.at(-1)?.attempt?.feedback as { followUp?: string } | undefined;
  const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const recent = await db.question.findMany({
    where: { userId },
    select: { content: true, concept: true },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  for (let retry = 0; retry < 5; retry++) {
    const candidate = await generator.generate({
      ...context,
      mode,
      difficulty: session.difficulty,
      language: session.language,
      company: session.company,
      requestedTopic: session.topic,
      topicCatalog: topics,
      focus:
        position % 3 === 2
          ? 'Explore a different topic or strength'
          : 'Prioritize weaknesses when relevant',
      previousQuestions: recent.map((q) => ({ ...q, content: q.content.slice(0, 1200) })),
      followUp: session.mode !== 'Mock' && position % 3 !== 2 ? last?.followUp : null,
      retry,
    });
    if (
      (mode === 'Coding') !== Boolean(candidate.coding) ||
      (candidate.kind === 'coding') !== Boolean(candidate.coding) ||
      candidate.hints.length < 2 ||
      candidate.question.trim().length < 10 ||
      candidate.question.length > 12000
    )
      continue;
    candidate.difficulty = session.difficulty as GeneratedQuestion['difficulty'];
    const hash = hashQuestion(candidate.question);
    if (
      await db.question.findUnique({
        where: { userId_hash: { userId, hash } },
        select: { id: true },
      })
    )
      continue;
    const embedding = await ai.embed(
      candidate.question + '\nAssessment intent: ' + candidate.concept,
    );
    let cursor: string | undefined;
    let duplicate = false;
    let nearest: { content: string; concept: string; similarity: number }[] = [];
    do {
      const page = await db.question.findMany({
        where: { userId },
        select: { id: true, content: true, concept: true, embedding: true, embeddingModel: true },
        orderBy: { id: 'asc' },
        take: 250,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const old of page) {
        if (old.embeddingModel === 'offline-bank-v1') {
          old.embedding = await ai.embed(old.content + '\nAssessment intent: ' + old.concept);
          old.embeddingModel = embeddingModel;
          await db.question.update({
            where: { id: old.id },
            data: { embedding: old.embedding, embeddingModel },
          });
        }
        if (old.embeddingModel !== embeddingModel || old.embedding.length !== embedding.length)
          throw new AppError(
            503,
            'Embedding model changed. Re-embed question history before generating new questions.',
          );
        const similarity = cosine(embedding, old.embedding);
        if (similarity >= 0.94) duplicate = true;
        if (similarity >= 0.65)
          nearest.push({ content: old.content, concept: old.concept, similarity });
      }
      nearest = nearest.sort((a, b) => b.similarity - a.similarity).slice(0, 12);
      cursor = page.length === 250 ? page.at(-1)?.id : undefined;
    } while (cursor && !duplicate);
    if (duplicate || (await equivalent(candidate, nearest))) {
      recent.push({ content: candidate.question, concept: candidate.concept });
      continue;
    }
    if (candidate.coding) {
      const coding = candidate.coding;
      if (
        coding.hiddenTests.length < 5 ||
        coding.hiddenTests.length > 8 ||
        coding.examples.length < 1 ||
        coding.examples.length > 3
      )
        continue;
      const checked = await executeTests(coding.referencePython, 'Python', [
        ...coding.examples,
        ...coding.hiddenTests,
      ]);
      if (checked.some((t) => !t.passed)) continue;
    }
    const saved = await db.question.create({
      data: {
        userId,
        sessionId,
        position,
        content: candidate.question,
        hash,
        embedding,
        embeddingModel,
        concept: candidate.concept,
        topic: candidate.topic,
        difficulty: candidate.difficulty,
        kind: candidate.kind,
        payload: candidate,
      },
    });
    return publicQuestion(saved);
  }
  throw new AppError(
    503,
    'Could not generate a sufficiently distinct, validated question. Please retry or choose another topic.',
  );
}
