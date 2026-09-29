import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

// Each installation gets its own local password. Never commit the generated file.
if (!existsSync('.env')) {
  const password = randomBytes(24).toString('hex');
  const values = [
    `DATABASE_URL=postgresql://placement:${password}@127.0.0.1:5432/placement?schema=public`,
    `POSTGRES_PASSWORD=${password}`,
    'APP_URL=http://localhost:3000',
    'OPENAI_API_KEY=',
    'JUDGE0_URL=',
    'JUDGE0_API_KEY=',
    '',
  ];
  writeFileSync('.env', values.join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Created private local configuration. It is excluded from Git.');
}
