import { test, expect } from '@playwright/test';
import { question, evaluation, profile } from '../tests/fixtures';

test('interview question, hints, evaluation, and report UI', async ({ page }) => {
  const q = {
    id: 'ui-question',
    position: 0,
    title: question.title,
    question: question.question,
    topic: question.topic,
    concept: question.concept,
    difficulty: 'medium',
    kind: 'technical',
    followUpPossible: true,
    coding: null,
    hintsUsed: 0,
    revealedHints: [] as string[],
    createdAt: new Date().toISOString(),
    attempt: null as unknown,
    submissions: [],
  };
  const session = {
    id: 'ui-session',
    mode: 'Technical',
    status: 'active',
    difficulty: 'medium',
    language: 'Python',
    targetCount: 1,
    expiresAt: null,
    questions: [q],
    report: null as unknown,
  };
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { user: { id: 'ui-student', email: 'ui@example.com', profile } } }),
  );
  await page.route('**/api/sessions/ui-session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/questions/ui-question/hint', (route) => {
    q.hintsUsed++;
    q.revealedHints.push('Think about the layout.');
    return route.fulfill({ json: { hint: 'Think about the layout.' } });
  });
  await page.route('**/api/questions/ui-question/answer', async (route) => {
    const data = route.request().postDataJSON();
    q.attempt = {
      id: 'attempt',
      answer: data.answer,
      score: 73,
      feedback: evaluation,
      timeTaken: 20,
      mistakes: evaluation.mistakes,
    };
    await route.fulfill({ json: q.attempt });
  });
  await page.route('**/api/sessions/ui-session/finish', (route) => {
    session.status = 'completed';
    session.report = {
      summary: 'You explained indexing. Practice traversal next.',
      strengths: ['Indexing'],
      weaknesses: ['Traversal'],
      nextSteps: ['Compare linked and contiguous storage.'],
      score: 73,
      answered: 1,
      total: 1,
    };
    return route.fulfill({ json: session.report });
  });
  await page.goto('/session/ui-session');
  await expect(page.getByText(question.question, { exact: true })).toBeVisible();
  await expect(page.getByText(question.explanation, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hint (0/2)' }).click();
  await expect(page.getByText('Think about the layout.')).toBeVisible();
  await page.getByLabel('Your answer', { exact: true }).fill('Indexed access avoids scanning.');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('73/100')).toBeVisible();
  await expect(page.getByText(evaluation.correctAnswer, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Get my report' }).click();
  await expect(page.getByRole('heading', { name: 'Session results' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Monaco loads locally and submits source to the protected API', async ({ page }, testInfo) => {
  const q = {
    id: 'code-question',
    position: 0,
    title: 'Echo an integer',
    question: 'Read an integer and print it.',
    topic: 'Arrays',
    concept: 'Input output',
    difficulty: 'easy',
    kind: 'coding',
    followUpPossible: false,
    hintsUsed: 0,
    createdAt: new Date().toISOString(),
    attempt: null as unknown,
    submissions: [],
    coding: {
      inputFormat: 'One integer.',
      outputFormat: 'Print the integer.',
      constraints: ['0 <= n <= 10'],
      examples: [{ input: '1', output: '1' }],
      tags: ['Arrays'],
    },
  };
  const session = {
    id: 'coding-session',
    mode: 'Coding',
    status: 'active',
    difficulty: 'easy',
    language: 'JavaScript',
    targetCount: 1,
    expiresAt: null,
    questions: [q],
    report: null,
  };
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { user: { id: 'ui-student', email: 'ui@example.com', profile } } }),
  );
  await page.route('**/api/sessions/coding-session', (route) => route.fulfill({ json: session }));
  await page.route('**/api/questions/code-question/code', async (route) => {
    const data = route.request().postDataJSON();
    expect(data.source).toContain('console.log');
    if (data.final)
      q.attempt = {
        id: 'a',
        answer: data.source,
        score: 92,
        feedback: evaluation,
        timeTaken: 30,
        mistakes: evaluation.mistakes,
      };
    await route.fulfill({
      json: {
        results: [
          { status: 'Accepted', passed: true, stdout: '1', stderr: '', time: 0.01, memory: 1024 },
        ],
        passed: 1,
        total: 1,
      },
    });
  });
  await page.goto('/session/coding-session');
  await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 20000 });
  const editor = page.getByRole('textbox', { name: 'Code editor' });
  await editor.focus();
  await page.keyboard.insertText('console.log(1);');
  expect(
    await editor.evaluate((node) =>
      node.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true })),
    ),
  ).toBe(false);
  expect(
    await editor.evaluate((node) =>
      node.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true })),
    ),
  ).toBe(false);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByText('Accepted', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/coding-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('92/100')).toBeVisible();
});
