import { db } from '@/lib/db';
import { AppError } from '@/lib/http';
import { questionSchema, evaluationSchema, type Evaluation } from '@/lib/contracts';
import { adaptDifficulty, scoreEvaluation, mean } from '@/lib/math';
import { topics, type Difficulty } from '@/lib/catalog';
import { AnswerEvaluator, MistakeAnalyzer, ImprovementPlanner, InterviewAgent } from './ai';
import { executeTests, executor } from './execution';
import { publicQuestion, studentContext } from './questions';
import type { Prisma } from '@prisma/client';
const json = (v: unknown) => v as Prisma.InputJsonValue;
export async function ownedSession(userId: string, id: string) {
  const s = await db.interviewSession.findFirst({
    where: { id, userId },
    include: {
      questions: {
        orderBy: { position: 'asc' },
        include: {
          attempt: { include: { mistakes: true } },
          submissions: { orderBy: { createdAt: 'desc' }, take: 10 },
          _count: { select: { submissions: true } },
        },
      },
    },
  });
  if (!s) throw new AppError(404, 'Interview not found.');
  return s;
}
export async function sessionDetail(userId: string, id: string) {
  const s = await ownedSession(userId, id);
  return {
    ...s,
    offline: !process.env.OPENAI_API_KEY,
    questions: s.questions.map((q) => ({
      ...publicQuestion(q),
      createdAt: q.createdAt,
      attempt: q.attempt,
      submissions: q.submissions.map((x) => ({ ...x, results: publicResults(x.results) })),
      submissionCount: q._count.submissions,
    })),
  };
}
export async function submissionHistory(userId: string, questionId: string, page: number) {
  const question = await db.question.findFirst({
    where: { id: questionId, userId },
    select: { id: true },
  });
  if (!question) throw new AppError(404, 'Question not found.');
  const [submissions, total] = await Promise.all([
    db.codingSubmission.findMany({
      where: { questionId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * 10,
      take: 10,
    }),
    db.codingSubmission.count({ where: { questionId } }),
  ]);
  return {
    submissions: submissions.map((s) => ({ ...s, results: publicResults(s.results) })),
    total,
    page,
  };
}
function publicResults(value: Prisma.JsonValue) {
  return (
    value as unknown as {
      hidden: boolean;
      status: string;
      passed: boolean;
      stdout: string;
      stderr: string;
      time: number | null;
      memory: number | null;
    }[]
  ).map((r) =>
    r.hidden
      ? { hidden: true, status: r.status, passed: r.passed, time: r.time, memory: r.memory }
      : r,
  );
}
async function actionableQuestion(userId: string, id: string) {
  const q = await db.question.findFirst({
    where: { id, userId },
    include: { session: true, attempt: true },
  });
  if (!q) throw new AppError(404, 'Question not found.');
  if (q.session.status !== 'active') throw new AppError(409, 'This interview has ended.');
  if (q.session.expiresAt && q.session.expiresAt.getTime() <= Date.now())
    throw new AppError(409, 'Time has expired. Finish the session to receive your report.');
  return q;
}
async function persistEvaluation(
  questionId: string,
  answer: string,
  evaluation: Evaluation,
  score: number,
  submission?: {
    source: string;
    language: string;
    results: unknown;
    passed: number;
    total: number;
  },
) {
  return db.$transaction(async (tx) => {
    const q = await tx.question.findUniqueOrThrow({
      where: { id: questionId },
      include: { session: true },
    });
    const attempt = await tx.questionAttempt.create({
      data: {
        questionId,
        answer,
        score,
        feedback: json(evaluation),
        timeTaken: Math.max(0, Math.round((Date.now() - q.createdAt.getTime()) / 1000)),
        mistakes: { create: new MistakeAnalyzer().analyze(evaluation) },
      },
    });
    if (submission)
      await tx.codingSubmission.create({
        data: { questionId, ...submission, results: json(submission.results), isFinal: true },
      });
    const previous = await tx.questionAttempt.findMany({
      where: { question: { sessionId: q.sessionId } },
      orderBy: { createdAt: 'asc' },
      select: { score: true },
    });
    const next = adaptDifficulty(
      q.session.difficulty as Difficulty,
      previous.map((p) => p.score),
    );
    if (next !== q.session.difficulty)
      await tx.interviewSession.update({ where: { id: q.sessionId }, data: { difficulty: next } });
    return { ...attempt, feedback: evaluation };
  });
}
function emptyFeedback(payload: ReturnType<typeof questionSchema.parse>): Evaluation {
  return {
    technicalAccuracy: 0,
    problemSolving: 0,
    communication: 0,
    completeness: 0,
    reasoning: 0,
    timeComplexity: 'Not assessed',
    spaceComplexity: 'Not assessed',
    confidenceEvidence: 'No answer was provided.',
    wellDone: [],
    improve: ['Write an answer before leaving the question.'],
    correctAnswer: payload.explanation,
    followUp: null,
    mistakes: [
      {
        type: 'Incomplete answer',
        topic: payload.topic,
        explanation: 'The tab was switched before an answer was entered.',
        correction: 'Stay on the question tab until you finish your answer.',
      },
    ],
  };
}
export async function submitAnswer(
  userId: string,
  questionId: string,
  answer: string,
  autoSubmitted = false,
) {
  const q = await actionableQuestion(userId, questionId);
  if (q.attempt) return q.attempt;
  if (q.kind === 'coding') throw new AppError(400, 'Submit coding answers using the code editor.');
  if (!answer.trim()) {
    if (!autoSubmitted) throw new AppError(400, 'Enter an answer first.');
    return persistEvaluation(
      q.id,
      '[No answer entered before switching tabs]',
      emptyFeedback(questionSchema.parse(q.payload)),
      0,
    );
  }
  const evaluation = await new AnswerEvaluator().evaluate({
    question: questionSchema.parse(q.payload),
    answer,
    profile: await db.profile.findUnique({ where: { userId } }),
  });
  return persistEvaluation(q.id, answer, evaluation, scoreEvaluation(evaluation));
}
export async function hint(userId: string, questionId: string) {
  const q = await actionableQuestion(userId, questionId);
  if (q.attempt) throw new AppError(409, 'This question has already been answered.');
  const payload = questionSchema.parse(q.payload);
  if (q.hintsUsed >= Math.min(2, payload.hints.length))
    throw new AppError(409, 'All hints have been used. Submit your answer to see the explanation.');
  await db.question.update({ where: { id: q.id }, data: { hintsUsed: { increment: 1 } } });
  return { hint: payload.hints[q.hintsUsed] };
}
export async function codeAction(
  userId: string,
  questionId: string,
  source: string,
  language: string,
  final: boolean,
  customInput?: string,
  autoSubmitted = false,
) {
  const q = await actionableQuestion(userId, questionId);
  if (q.attempt) throw new AppError(409, 'This question has already been submitted.');
  const payload = questionSchema.parse(q.payload);
  if (!payload.coding) throw new AppError(400, 'This is not a coding question.');
  if (!source.trim()) {
    if (!final || !autoSubmitted) throw new AppError(400, 'Write some code first.');
    const total = payload.coding.examples.length + payload.coding.hiddenTests.length;
    const attempt = await persistEvaluation(
      q.id,
      '[No code entered before switching tabs]',
      emptyFeedback(payload),
      0,
      { source: '', language, results: [], passed: 0, total },
    );
    return { results: [], passed: 0, total, attempt };
  }
  if (!final && customInput !== undefined) {
    const r = await executor.run(source, language, customInput);
    await db.codingSubmission.create({
      data: {
        questionId,
        source,
        language,
        results: json([{ ...r, hidden: false }]),
        passed: r.passed ? 1 : 0,
        total: 1,
      },
    });
    return { results: [r], custom: true };
  }
  const tests = final
    ? [...payload.coding.examples, ...payload.coding.hiddenTests]
    : payload.coding.examples;
  const results = (await executeTests(source, language, tests)).map((r, i) => ({
    ...r,
    hidden: i >= payload.coding!.examples.length,
  }));
  const passed = results.filter((r) => r.passed).length;
  if (!final) {
    await db.codingSubmission.create({
      data: { questionId, source, language, results: json(results), passed, total: tests.length },
    });
    return { results, passed, total: tests.length };
  }
  const evaluation = await new AnswerEvaluator().evaluate({
    question: {
      ...payload,
      coding: { ...payload.coding, hiddenTests: undefined, referencePython: undefined },
    },
    answer: source,
    language,
    testResults: results.map((r) => ({
      status: r.status,
      passed: r.passed,
      time: r.time,
      memory: r.memory,
    })),
    passed,
    total: tests.length,
  });
  const score = scoreEvaluation(evaluation, { passed, total: tests.length });
  const attempt = await persistEvaluation(q.id, source, evaluation, score, {
    source,
    language,
    results,
    passed,
    total: tests.length,
  });
  return {
    results: publicResults(json(results) as Prisma.JsonValue),
    passed,
    total: tests.length,
    attempt,
  };
}
export async function createPlan(userId: string) {
  const context = await studentContext(userId);
  const plan = await new ImprovementPlanner().generate(context);
  if (
    plan.tasks.length < 7 ||
    plan.tasks.length > 14 ||
    new Set(plan.tasks.map((t) => t.day)).size !== 7
  )
    throw new AppError(502, 'The AI returned an incomplete plan. Please retry.');
  return db.improvementPlan.create({
    data: { userId, summary: plan.summary, tasks: { create: plan.tasks } },
    include: { tasks: { orderBy: { day: 'asc' } } },
  });
}
export async function finishSession(userId: string, id: string) {
  const s = await ownedSession(userId, id);
  if (s.status === 'completed') return s.report;
  const attempts = s.questions.filter((q) => q.attempt);
  const report = await new InterviewAgent().report({
    mode: s.mode,
    answered: attempts.length,
    total: s.targetCount,
    score: mean(attempts.map((q) => q.attempt!.score)),
    answers: attempts.map((q) => ({
      question: q.content,
      answer: q.attempt!.answer,
      feedback: q.attempt!.feedback,
      score: q.attempt!.score,
    })),
  });
  const plan = await new ImprovementPlanner().generate(await studentContext(userId));
  if (
    plan.tasks.length < 7 ||
    plan.tasks.length > 14 ||
    new Set(plan.tasks.map((t) => t.day)).size !== 7
  )
    throw new AppError(502, 'Could not generate a complete improvement plan. Please retry.');
  await db.$transaction([
    db.interviewSession.update({
      where: { id },
      data: {
        status: 'completed',
        endedAt: new Date(),
        report: json({
          ...report,
          score: mean(attempts.map((q) => q.attempt!.score)),
          answered: attempts.length,
          total: s.targetCount,
        }),
      },
    }),
    db.improvementPlan.create({
      data: { userId, summary: plan.summary, tasks: { create: plan.tasks } },
    }),
  ]);
  return report;
}
export async function analytics(userId: string) {
  const [attempts, sessionCount, activeSessions, codingSubmissions] = await Promise.all([
    db.questionAttempt.findMany({
      where: { question: { userId } },
      select: {
        score: true,
        feedback: true,
        createdAt: true,
        question: {
          select: {
            topic: true,
            kind: true,
            difficulty: true,
            session: { select: { mode: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    db.interviewSession.count({ where: { userId, status: 'completed' } }),
    db.interviewSession.findMany({
      where: { userId, status: 'active' },
      orderBy: { startedAt: 'desc' },
      take: 3,
      select: { id: true, mode: true, startedAt: true },
    }),
    db.codingSubmission.findMany({
      where: { question: { userId }, isFinal: true },
      select: { passed: true, total: true },
    }),
  ]);
  const buckets = new Map<string, typeof attempts>();
  const dates = new Map<string, number[]>();
  for (const a of attempts) {
    buckets.set(a.question.topic, [...(buckets.get(a.question.topic) || []), a]);
    const day = a.createdAt.toISOString().slice(0, 10);
    dates.set(day, [...(dates.get(day) || []), a.score]);
  }
  const topicStats = Array.from(buckets, ([topic, items]) => {
    const middle = Math.floor(items.length / 2);
    const earlier = mean(items.slice(0, middle).map((x) => x.score));
    const recent = mean(items.slice(middle).map((x) => x.score));
    return {
      topic,
      score: mean(items.map((x) => x.score)),
      count: items.length,
      trend: items.length >= 4 ? recent - earlier : 0,
      persistent: items.length >= 3 && items.slice(-3).every((x) => x.score < 65),
    };
  }).sort((a, b) => a.score - b.score);
  let streak = 0;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (!dates.has(today.toISOString().slice(0, 10))) today.setUTCDate(today.getUTCDate() - 1);
  while (dates.has(today.toISOString().slice(0, 10))) {
    streak++;
    today.setUTCDate(today.getUTCDate() - 1);
  }
  const category = (filter: (a: (typeof attempts)[number]) => boolean) => {
    const selected = attempts.filter(filter);
    return { score: mean(selected.map((a) => a.score)), count: selected.length };
  };
  return {
    readiness: mean(attempts.map((a) => a.score)),
    questionsSolved: attempts.length,
    codingSolved: codingSubmissions.filter((s) => s.total > 0 && s.passed === s.total).length,
    sessionsCompleted: sessionCount,
    streak,
    activeSessions,
    topics: topicStats,
    progress: Array.from(dates, ([date, scores]) => ({
      date,
      score: mean(scores),
      count: scores.length,
    })).slice(-90),
    difficultyProgress: attempts
      .slice(-30)
      .map((a) => ({ date: a.createdAt, difficulty: a.question.difficulty, score: a.score })),
    codingSuccessRate: mean(
      codingSubmissions.map((s) => (s.total > 0 && s.passed === s.total ? 100 : 0)),
    ),
    scores: {
      Coding: category((a) => a.question.kind === 'coding'),
      DSA: category((a) => a.question.kind === 'dsa'),
      Aptitude: category((a) => ['aptitude', 'verbal'].includes(a.question.kind)),
      Technical: category((a) => a.question.kind === 'technical'),
      'Logical Reasoning': category(
        (a) =>
          a.question.session.mode === 'Logical Reasoning' ||
          topics['Logical Reasoning'].includes(a.question.topic),
      ),
      'Quantitative Aptitude': category(
        (a) =>
          a.question.session.mode === 'Quantitative Aptitude' ||
          topics['Quantitative Aptitude'].includes(a.question.topic),
      ),
      Communication: {
        score: mean(attempts.map((a) => evaluationSchema.parse(a.feedback).communication * 10)),
        count: attempts.length,
      },
    },
  };
}
