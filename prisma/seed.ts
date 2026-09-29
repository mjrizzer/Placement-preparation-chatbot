import { PrismaClient } from '@prisma/client';
import { topics } from '../src/lib/catalog';
const db = new PrismaClient();
async function seed() {
  for (const [category, names] of Object.entries(topics))
    for (const name of names)
      await db.topic.upsert({ where: { name }, create: { name, category }, update: { category } });
}
seed().finally(() => db.$disconnect());
