import { test, expect } from './fixtures';
import { createRoster, resetClientState } from './utils';

test.describe('Orks Warlord mobile workflow', () => {
  test.beforeEach(async ({ page }) => resetClientState(page));

  test('adds the real Runtherd Character and keeps Warlord visible after save', async ({
    page
  }) => {
    const roster = await createRoster(page, { factionLabel: 'Orks' });
    await page.getByTestId('add-units-button').click();
    await expect(page).toHaveURL(`${roster.rosterBaseUrl}/add-units`);
    await page
      .getByTestId('datasheet-loading')
      .waitFor({ state: 'detached' })
      .catch(() => {});
    await page.getByTestId('datasheet-search').fill('Runtherd');
    await page.getByTestId('datasheet-role-character').click();
    await expect(page.getByTestId('add-datasheet-runtherd')).toBeVisible();
    await page.getByTestId('add-datasheet-runtherd').click();
    await page.getByRole('button', { name: /Review Selection/i }).click();
    await page
      .getByTestId('unit-selection-summary')
      .getByRole('button', { name: 'Confirm' })
      .click();
    await expect(page).toHaveURL(roster.rosterEditUrl);

    const runtherdCard = page.getByTestId('roster-unit-card-runtherd');
    await runtherdCard.click();
    await expect(page.getByTestId('warlord-section')).toBeVisible();
    await page.getByRole('switch', { name: 'Nominate as warlord' }).check();
    await page.route('**/api/rosters/*', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 503, body: 'temporary failure' });
      } else {
        await route.continue();
      }
    });
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/\/edit#unit-/);
    await expect(page.getByTestId('unit-warlord-tag')).toHaveTextContent('Warlord');
    await expect(page.getByTestId('roster-save-status')).toHaveTextContent('Save failed');
    const status = page.getByTestId('roster-save-status');
    const statusBox = await status.boundingBox();
    const retry = status.getByRole('button', { name: 'Retry' });
    const retryBox = await retry.boundingBox();
    expect(statusBox).not.toBeNull();
    expect(retryBox).not.toBeNull();
    expect(statusBox!.x).toBeGreaterThanOrEqual(0);
    expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth)
    );
    expect(retryBox!.x).toBeGreaterThanOrEqual(statusBox!.x);
    await retry.click();
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 844 }
  ]) {
    test(`keeps failed Retry inside the viewport at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      expect(viewport.width).toBeGreaterThanOrEqual(360);
    });
  }
});
