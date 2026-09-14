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

  test('dismisses Saved without blocking the bottom action and recovers one failed PUT', async ({
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
    await expect(page).toHaveURL(`${roster.rosterBaseUrl}/add-units`);
    await page.goBack();
    await expect(page).toHaveURL(roster.rosterEditUrl);
    await expect(runtherdCard).toBeVisible();

    await runtherdCard.click();
    await expect(page.getByRole('switch', { name: 'Nominate as warlord' })).toBeChecked();
    await page.getByRole('switch', { name: 'Nominate as warlord' }).uncheck();

    let failedPutCount = 0;
    const failOnePut = async (route: import('@playwright/test').Route) => {
      if (route.request().method() === 'PUT' && failedPutCount === 0) {
        failedPutCount += 1;
        await route.fulfill({ status: 503, body: '{"error":"temporary outage"}' });
        return;
      }
      await route.continue();
    };
    await page.route('**/api/rosters/**', failOnePut);
    await page.getByTestId('save-button').click();
    await expect(page).toHaveURL(/\/edit#unit-/);
    const failedStatus = statuses.filter({ hasText: 'Save failed' }).first();
    await expect(failedStatus).toBeVisible({ timeout: 5000 });
    const retry = page.getByRole('button', { name: 'Retry' }).first();
    await expect(retry).toBeVisible();
    await expect(retry).toBeEnabled();
    expect(failedPutCount).toBe(1);

    await page.unroute('**/api/rosters/**', failOnePut);
    await retry.click();
    await expect(statuses.filter({ hasText: 'Saved' }).first()).toBeVisible({ timeout: 5000 });
  });
});
