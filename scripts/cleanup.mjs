import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const now = new Date();
try {
  const results = await db.$transaction([
    db.authSession.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.operationLock.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  console.log(
    'Expired auth sessions, rate-limit buckets, and operation leases removed:',
    results.map((r) => r.count),
  );
} finally {
  await db.$disconnect();
}
