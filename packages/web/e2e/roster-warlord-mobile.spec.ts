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
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/\/edit#unit-/);
    await expect(page.getByTestId('unit-warlord-tag')).toContainText('Warlord');
    await expect(page.getByTestId('roster-save-status').first()).toContainText('Saved');
    const status = page.getByTestId('roster-save-status').first();
    const statusBox = await status.boundingBox();
    expect(statusBox).not.toBeNull();
    expect(statusBox!.x).toBeGreaterThanOrEqual(0);
    expect(statusBox!.x + statusBox!.width).toBeLessThanOrEqual(
      await page.evaluate(() => innerWidth)
    );
  });

  test('dismisses Saved without blocking the bottom action', async ({
    page
  }, testInfo) => {
    test.skip(testInfo.project.name === 'chromium-desktop', 'Mobile regression only');
    const viewportWidth = testInfo.project.name === 'chromium-mobile-390' ? 390 : 360;
    await page.setViewportSize({ width: viewportWidth, height: 844 });
    expect(await page.evaluate(() => innerWidth)).toBe(viewportWidth);

    const roster = await createRoster(page, { factionLabel: 'Orks' });
    await page.getByTestId('add-units-button').click();
    await expect(page).toHaveURL(`${roster.rosterBaseUrl}/add-units`);
    await page
      .getByTestId('datasheet-loading')
      .waitFor({ state: 'detached' })
      .catch(() => {});
    await page.getByTestId('datasheet-search').fill('Runtherd');
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
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/\/edit#unit-/);
    await expect(page.getByTestId('unit-warlord-tag')).toContainText('Warlord');

    const statuses = page.getByTestId('roster-save-status');
    await expect(statuses.filter({ hasText: 'Saved' }).first()).toBeVisible();
    await expect(statuses).toHaveCount(0, { timeout: 5000 });
    expect(
      await statuses.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { width: box.width, height: box.height };
        })
      )
    ).toEqual([]);

    const bottomAction = page.getByTestId('add-units-button');
    await expect(bottomAction).toBeVisible();
    await expect(bottomAction).toBeEnabled();
    await bottomAction.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(
      new URL(`${roster.rosterBaseUrl}/add-units`).pathname
    );
    await page.goBack();
    const rosterEditPath = new URL(roster.rosterEditUrl).pathname;
    await expect
      .poll(() => {
        const currentUrl = new URL(page.url());
        return currentUrl.pathname === rosterEditPath && /^#unit-/.test(currentUrl.hash);
      })
      .toBe(true);
    await expect(runtherdCard).toBeVisible();

  });
});
