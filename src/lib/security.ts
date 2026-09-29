import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { AppError } from './http';
const digest = (s: string) => createHash('sha256').update(s).digest('hex');
export const cookieName = 'placement_session';
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await db.authSession.create({
    data: { userId, tokenHash: digest(token), expiresAt: new Date(Date.now() + 7 * 86400_000) },
  });
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 86400,
  });
}
export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await db.authSession.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { id: session.user.id, email: session.user.email, profile: session.user.profile };
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError(401, 'Please sign in to continue.');
  return user;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) await db.authSession.deleteMany({ where: { tokenHash: digest(token) } });
  jar.delete(cookieName);
}
export async function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = new Date();
  const expires = new Date(now.getTime() + windowMs);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${digest(key)},1,${expires}) ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END, "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= ${now} THEN ${expires} ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > limit)
    throw new AppError(429, 'Too many requests. Please wait a minute and try again.');
}
export async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const token = randomUUID();
  const now = new Date();
  const expires = new Date(Date.now() + 10 * 60_000);
  const rows = await db.$queryRaw<
    { token: string }[]
  >`INSERT INTO "OperationLock" ("userId","token","expiresAt") VALUES (${userId},${token},${expires}) ON CONFLICT ("userId") DO UPDATE SET "token"=${token},"expiresAt"=${expires} WHERE "OperationLock"."expiresAt" < ${now} RETURNING "token"`;
  if (!rows.length)
    throw new AppError(409, 'Another operation is in progress. Please wait for it to finish.');
  try {
    return await fn();
  } finally {
    await db.operationLock.deleteMany({ where: { userId, token } });
  }
}
