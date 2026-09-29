import { test, expect } from '@playwright/test';
test('landing, authentication and responsive navigation', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /A place to practise/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Create an account' }).click();
  const email = `browser-${Date.now()}-${testInfo.project.name}@example.com`;
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('placement-test-password-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Set up your profile' })).toBeVisible();
  await page.getByLabel('Full name').fill('Alex Student');
  await page.getByLabel('College', { exact: true }).fill('Example Institute');
  await page.getByLabel('Degree', { exact: true }).fill('B.Tech');
  await page.getByLabel('Branch', { exact: true }).fill('Computer Science');
  await page.getByRole('button', { name: 'Create my workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Alex.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await page.goto('/interview');
  await page.getByRole('button', { name: 'Let’s get started' }).click();
  await expect(page.getByRole('heading', { name: 'Ready when you are.' })).toBeVisible();
  await page.getByRole('button', { name: 'Generate my first question' }).click();
  await expect(page.locator('.error-notice')).toContainText('AI is not configured');
  await page.goto('/history');
  await expect(page.getByRole('link', { name: /Technical interview/ })).toBeVisible();
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('placement-test-password-2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, Alex.' })).toBeVisible();
});
test('private API rejects anonymous access', async ({ request }) => {
  const response = await request.get('/api/sessions');
  expect(response.status()).toBe(401);
});
