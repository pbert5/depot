import { test, expect } from './fixtures';

test('worker fixture makes its profile the active API identity', async ({ page }) => {
  const active = await page.evaluate(async () => {
    const response = await fetch('/api/profiles/active', { cache: 'no-store' });
    expect(response.ok).toBeTruthy();
    return (await response.json()) as { id: string; displayName: string };
  });

  expect(active.displayName).toMatch(/^E2E .+ worker \d+$/);
});
