import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hash, compare } from 'bcryptjs';
import { db } from '@/lib/db';
import { body, boundedBody, errorResponse, AppError, sameOrigin } from '@/lib/http';
import {
  createSession,
  currentUser,
  requireUser,
  logout,
  rateLimit,
  withUserLock,
} from '@/lib/security';
import { profileSchema, sessionSchema } from '@/lib/contracts';
import { codingLanguages } from '@/lib/catalog';
import { generateNext } from '@/server/questions';
import {
  submitAnswer,
  hint,
  codeAction,
  sessionDetail,
  finishSession,
  analytics,
  createPlan,
  submissionHistory,
} from '@/server/interviews';
export const runtime = 'nodejs';
export const maxDuration = 300;
type Context = { params: Promise<{ path: string[] }> };
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(12)
    .max(72)
    .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must fit within 72 UTF-8 bytes.'),
});
async function route(request: Request, ctx: Context) {
  try {
    const { path } = await ctx.params;
    const key = path.join('/');
    const method = request.method;
    const url = new URL(request.url);
    if (method !== 'GET') sameOrigin(request);
    if (key === 'health' && method === 'GET') return NextResponse.json({ status: 'ok' });
    if (key === 'auth/me' && method === 'GET')
      return NextResponse.json({ user: await currentUser() });
    if (['auth/login', 'auth/signup'].includes(key) && method === 'POST') {
      const data = await body(request, credentials);
      const ip =
        process.env.TRUST_PROXY === 'true'
          ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
          : 'global';
      await rateLimit('auth-ip:' + ip, 30);
      await rateLimit('auth-email:' + data.email, 8);
      if (key === 'auth/signup') {
        const existing = await db.user.findUnique({
          where: { email: data.email },
          select: { id: true },
        });
        if (existing) throw new AppError(409, 'Unable to create this account. Try signing in.');
        const user = await db.user.create({
          data: { email: data.email, passwordHash: await hash(data.password, 12) },
        });
        await createSession(user.id);
        return NextResponse.json({ ok: true });
      }
      const user = await db.user.findUnique({ where: { email: data.email } });
      const valid = await compare(
        data.password,
        user?.passwordHash || '$2b$12$C6UzMDM.H6dfI/f/IKcEe.2vjA6eRg77nxoa6nOSdJA2MPH48JJT6',
      );
      if (!user || !valid) throw new AppError(401, 'Email or password is incorrect.');
      await createSession(user.id);
      return NextResponse.json({ ok: true });
    }
    const user = await requireUser();
    if (method !== 'GET') await rateLimit('user:' + user.id, 30);
    if (key === 'auth/logout' && method === 'POST') {
      await logout();
      return NextResponse.json({ ok: true });
    }
    if (key === 'profile' && method === 'GET') return NextResponse.json({ profile: user.profile });
    if (key === 'profile' && method === 'PUT') {
      const data = await body(request, profileSchema);
      return NextResponse.json(
        await db.profile.upsert({
          where: { userId: user.id },
          create: { ...data, userId: user.id },
          update: data,
        }),
      );
    }
    if (key === 'resume' && method === 'POST') {
      await rateLimit('resume:' + user.id, 3);
      if (!user.profile) throw new AppError(400, 'Save your profile first.');
      if (Number(request.headers.get('content-length') || 0) > 3_000_000)
        throw new AppError(413, 'Resume must be smaller than 2 MB.');
      const bytes = await boundedBody(request, 3_000_000);
      const form = await new Response(bytes, {
        headers: { 'Content-Type': request.headers.get('content-type') || '' },
      }).formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size > 2_000_000)
        throw new AppError(400, 'Upload a PDF or plain text resume under 2 MB.');
      let text = '';
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) text = await file.text();
      else if (file.type === 'application/pdf') {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: Buffer.from(await file.arrayBuffer()) });
        try {
          text = (await parser.getText()).text;
        } catch {
          throw new AppError(
            400,
            'This PDF could not be read. Upload a text-based PDF or TXT file.',
          );
        } finally {
          await parser.destroy();
        }
      } else throw new AppError(400, 'Supported formats: PDF and plain text.');
      if (text.trim().length < 30)
        throw new AppError(400, 'Could not read enough text. Upload a text-based PDF or TXT file.');
      await db.profile.update({
        where: { userId: user.id },
        data: { resumeText: text.slice(0, 20000) },
      });
      return NextResponse.json({ ok: true, characters: Math.min(text.length, 20000) });
    }
    if (key === 'resume' && method === 'DELETE') {
      await db.profile.update({ where: { userId: user.id }, data: { resumeText: null } });
      return NextResponse.json({ ok: true });
    }
    if (key === 'analytics' && method === 'GET') return NextResponse.json(await analytics(user.id));
    if (
      path[0] === 'questions' &&
      path.length === 3 &&
      path[2] === 'submissions' &&
      method === 'GET'
    ) {
      const page = Math.max(
        1,
        Math.min(10000, Math.floor(Number(url.searchParams.get('page')) || 1)),
      );
      return NextResponse.json(await submissionHistory(user.id, path[1], page));
    }
    if (key === 'sessions' && method === 'GET') {
      const page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
      const [sessions, total] = await Promise.all([
        db.interviewSession.findMany({
          where: { userId: user.id },
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * 12,
          take: 12,
          include: { questions: { select: { attempt: { select: { score: true } } } } },
        }),
        db.interviewSession.count({ where: { userId: user.id } }),
      ]);
      return NextResponse.json({ sessions, total, page });
    }
    if (key === 'sessions' && method === 'POST') {
      const data = await body(request, sessionSchema);
      if (!user.profile) throw new AppError(400, 'Complete your profile first.');
      if (data.mode === 'Resume' && !user.profile.resumeText)
        throw new AppError(400, 'Upload your resume on the Profile page first.');
      if (data.mode === 'Company' && !data.company)
        throw new AppError(400, 'Enter a target company.');
      if (
        ['Coding', 'Mock'].includes(data.mode) &&
        !codingLanguages.includes(data.language as (typeof codingLanguages)[number])
      )
        throw new AppError(400, 'Select a supported coding language.');
      return NextResponse.json(
        await withUserLock(user.id, async () => {
          const active = await db.interviewSession.count({
            where: { userId: user.id, status: 'active' },
          });
          if (active >= 5)
            throw new AppError(409, 'Finish an active interview before starting another.');
          const s = await db.interviewSession.create({
            data: {
              ...data,
              userId: user.id,
              targetCount: data.mode === 'Mock' ? 72 : data.targetCount,
              expiresAt: data.mode === 'Mock' ? new Date(Date.now() + 120 * 60_000) : null,
            },
          });
          return { id: s.id };
        }),
      );
    }
    if (path[0] === 'sessions' && path.length === 2 && method === 'GET')
      return NextResponse.json(await sessionDetail(user.id, path[1]));
    if (path[0] === 'sessions' && path[2] === 'next' && method === 'POST')
      return NextResponse.json(await withUserLock(user.id, () => generateNext(user.id, path[1])));
    if (path[0] === 'sessions' && path[2] === 'finish' && method === 'POST')
      return NextResponse.json(await withUserLock(user.id, () => finishSession(user.id, path[1])));
    if (path[0] === 'questions' && path[2] === 'answer' && method === 'POST') {
      const data = await body(
        request,
        z.object({
          answer: z.string().trim().max(20000),
          autoSubmitted: z.boolean().default(false),
        }),
      );
      return NextResponse.json(
        await withUserLock(user.id, () =>
          submitAnswer(user.id, path[1], data.answer, data.autoSubmitted),
        ),
      );
    }
    if (path[0] === 'questions' && path[2] === 'hint' && method === 'POST')
      return NextResponse.json(await withUserLock(user.id, () => hint(user.id, path[1])));
    if (path[0] === 'questions' && path[2] === 'code' && method === 'POST') {
      await rateLimit('code:' + user.id, 8);
      const data = await body(
        request,
        z.object({
          source: z.string().max(50000),
          autoSubmitted: z.boolean().default(false),
          language: z
            .string()
            .refine((l) => codingLanguages.includes(l as (typeof codingLanguages)[number])),
          final: z.boolean(),
          customInput: z.string().max(10000).optional(),
        }),
      );
      return NextResponse.json(
        await withUserLock(user.id, () =>
          codeAction(
            user.id,
            path[1],
            data.source,
            data.language,
            data.final,
            data.customInput,
            data.autoSubmitted,
          ),
        ),
      );
    }
    if (key === 'plans' && method === 'GET')
      return NextResponse.json(
        await db.improvementPlan.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          include: { tasks: { orderBy: { day: 'asc' } } },
        }),
      );
    if (key === 'plans' && method === 'POST') {
      await rateLimit('plan:' + user.id, 3);
      return NextResponse.json(await withUserLock(user.id, () => createPlan(user.id)));
    }
    if (path[0] === 'tasks' && path.length === 2 && method === 'PATCH') {
      const data = await body(request, z.object({ completed: z.boolean() }));
      const result = await db.improvementTask.updateMany({
        where: { id: path[1], plan: { userId: user.id } },
        data,
      });
      if (!result.count) throw new AppError(404, 'Task not found.');
      return NextResponse.json({ ok: true });
    }
    if (key === 'settings/password' && method === 'POST') {
      const data = await body(
        request,
        z.object({ current: z.string().max(72), password: credentials.shape.password }),
      );
      const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      if (!(await compare(data.current, record.passwordHash)))
        throw new AppError(400, 'Current password is incorrect.');
      await db.$transaction([
        db.user.update({
          where: { id: user.id },
          data: { passwordHash: await hash(data.password, 12) },
        }),
        db.authSession.deleteMany({ where: { userId: user.id } }),
      ]);
      await createSession(user.id);
      return NextResponse.json({ ok: true });
    }
    throw new AppError(404, 'Endpoint not found.');
  } catch (error) {
    return errorResponse(error);
  }
}
export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
