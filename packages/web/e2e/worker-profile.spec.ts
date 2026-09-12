import { test, expect } from './fixtures';

test('worker fixture makes its profile the active API identity', async ({ page }) => {
  await page.goto('/');
  const active = await page.evaluate(async () => {
    const response = await fetch('/api/profiles/active', { cache: 'no-store' });
    if (!response.ok) throw new Error(`active profile request failed: ${response.status}`);
    return (await response.json()) as { id: string; displayName: string };
  });

  expect(active.displayName).toMatch(/^E2E .+ worker \d+$/);
});
