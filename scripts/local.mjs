import './setup-env.mjs';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

process.loadEnvFile('.env');
const url = new URL(process.env.DATABASE_URL);
const reachable = () =>
  new Promise((resolve) => {
    const socket = createConnection({ host: url.hostname, port: Number(url.port || 5432) });
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
const children = [];
const launch = (file, args = []) => {
  const child = spawn(process.execPath, [file, ...args], {
    stdio: 'inherit',
    windowsHide: true,
    env: process.env,
  });
  children.push(child);
  return child;
};
const run = (file, args = []) =>
  new Promise((resolve, reject) => {
    const child = launch(file, args);
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${file} exited with ${code}`)),
    );
  });
try {
  if (!(await reachable())) {
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || Number(url.port || 5432) !== 5432)
      throw new Error('Configured database is unavailable. Start it before running the app.');
    launch('scripts/local-db.mjs');
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (await reachable()) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!ready) throw new Error('Local PostgreSQL failed to start. Check the database log above.');
  }
  await run('node_modules/prisma/build/index.js', ['generate']);
  await run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
  await run('scripts/assets.mjs');
  console.log('Opening the local app at http://localhost:3000. Keep this terminal running.');
  await run('node_modules/next/dist/bin/next', ['dev','--port','3000']);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
