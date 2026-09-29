import { chromium } from '@playwright/test';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const directory = 'artifacts/walkthrough';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, slowMo: 100 });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: directory, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();
const shot = async (name) => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
};
const results = [];
try {
  await page.goto('http://localhost:3000');
  await shot('01-home');
  await page.goto('http://localhost:3000/signup');
  const email = `walkthrough-${randomUUID()}@example.com`;
  const password = `Practice-${randomUUID()}`;
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByLabel('Full name').fill('Student');
  await page.getByLabel('College', { exact: true }).fill('Example College');
  await page.getByLabel('Degree', { exact: true }).fill('B.Tech');
  await page.getByLabel('Branch', { exact: true }).fill('Computer Science');
  await page.getByRole('button', { name: 'Create my workspace' }).click();
  await page.getByRole('heading', { name: 'Welcome, Student.' }).waitFor();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await shot('02-login');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Welcome, Student.' }).waitFor();
  await shot('03-dashboard');
  results.push('Real registration, onboarding, logout and login passed against PostgreSQL.');
  await page.goto('http://localhost:3000/demo');
  await page.getByLabel('Your answer').fill('100');
  await page.getByRole('button', { name: 'Submit answer', exact: true }).click();
  await page.getByRole('heading', { name: 'Correct', exact: true }).waitFor();
  await shot('04-answer');
  await page.getByRole('button', { name: 'Next question' }).click();
  await page.getByLabel('Your answer').fill('Queue');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByText('Submitted automatically after switching tabs.', { exact: true }).waitFor();
  await shot('05-tab-submission');
  results.push('Tab-switch event automatically submitted the second sample answer.');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Next question' }).click();
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  await editor.waitFor();
  await editor.focus();
  await page.keyboard.insertText('a, b = map(int, input().split())\nprint(a + b)');
  const blocked = await editor.evaluate((node) =>
    ['copy', 'paste', 'cut'].every(
      (type) => !node.dispatchEvent(new ClipboardEvent(type, { bubbles: true, cancelable: true })),
    ),
  );
  if (!blocked) throw new Error('Clipboard rules failed');
  await shot('06-coding');
  results.push('Code entry worked; copy, paste and cut events were blocked.');
  await page.getByRole('button', { name: 'Submit code', exact: true }).click();
  await page.getByRole('heading', { name: 'Code saved for review' }).waitFor();
  await page.getByRole('button', { name: 'View summary' }).click();
  await page.getByRole('heading', { name: '2 / 2 practice answers correct' }).waitFor();
  await shot('07-summary');
  results.push('Sample summary showed two correct answers and code saved without execution.');
  await context.close();
  await copyFile(await page.video().path(), `${directory}/walkthrough.webm`);
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto('http://localhost:3000/demo');
  if (!(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
    throw new Error('Mobile horizontal overflow');
  await mobile.screenshot({ path: `${directory}/08-mobile.png`, fullPage: true });
  await mobile.close();
  results.push('Sample screen fits a 390px mobile viewport.');
  await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2));
  await writeFile(
    `${directory}/index.html`,
    `<!doctype html><html lang="en"><meta charset="utf-8"><title>Placement Prep walkthrough</title><style>body{font:16px/1.6 Arial;max-width:960px;margin:40px auto;padding:20px;color:#23392f;background:#f6f8f7}video,img{max-width:100%;border:1px solid #dce5df;border-radius:10px}section{margin:36px 0}li{margin:8px 0}</style><h1>Placement Prep: recorded walkthrough</h1><p>Login uses the real local PostgreSQL database. The sample practice is clearly labelled and uses preset questions. No live AI response or code execution is claimed.</p><video controls src="walkthrough.webm"></video><ul>${results.map((r) => `<li>${r}</li>`).join('')}</ul>${[
      ['01-home', 'Home'],
      ['03-dashboard', 'Dashboard after signing in'],
      ['04-answer', 'Sample answer feedback'],
      ['05-tab-submission', 'Automatic submission'],
      ['06-coding', 'Code editor'],
      ['07-summary', 'Sample summary'],
      ['08-mobile', 'Mobile layout'],
    ]
      .map(
        ([file, title]) =>
          `<section><h2>${title}</h2><img src="${file}.png" alt="${title}"></section>`,
      )
      .join('')}</html>`,
  );
  console.log(results.join('\n'));
  console.log('Recording and screenshots saved in artifacts/walkthrough.');
} finally {
  await browser.close();
}
