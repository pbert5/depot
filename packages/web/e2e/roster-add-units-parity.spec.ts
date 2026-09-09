import { test, expect } from '@playwright/test';
import { resetClientState, createRoster } from './utils';

const FACTION_NAME = 'Drukhari';

const openAddUnits = async (page: Parameters<typeof test>[0]['page']) => {
  const roster = await createRoster(page, { factionLabel: FACTION_NAME });
  await page.getByTestId('add-units-button').click();
  await expect(page).toHaveURL(`${roster.rosterBaseUrl}/add-units`);
  await page.getByTestId('datasheet-loading').waitFor({ state: 'detached' }).catch(() => {});
  await expect(page.getByTestId('datasheet-search')).toBeVisible({ timeout: 60000 });
  return roster;
};

const add = async (page: Parameters<typeof test>[0]['page'], name: string, slug: string) => {
  const search = page.getByTestId('datasheet-search');
  await search.fill(name);
  await page.getByTestId(`add-datasheet-${slug}`).click();
};

const review = async (page: Parameters<typeof test>[0]['page']) => {
  await page.getByRole('button', { name: /Review Selection/i }).click();
  return page.getByTestId('unit-selection-summary');
};

test.describe('Roster add units parity', () => {
  test.beforeEach(async ({ page }) => resetClientState(page));

  test('supports one selection and confirmation', async ({ page }) => {
    const roster = await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    await expect((await review(page)).getByText('Archon')).toBeVisible();
    await page.getByTestId('unit-selection-summary').getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(roster.rosterEditUrl);
    await expect(page.getByTestId('roster-unit-card-archon')).toBeVisible();
  });

  test('keeps two different units selected while searching', async ({ page }) => {
    await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    await add(page, 'Kabalite Warriors', 'kabalite-warriors');
    const summary = await review(page);
    await expect(summary).toContainText(/2 units • \d+ pts/);
    await expect(summary.getByText('Archon')).toBeVisible();
    await expect(summary.getByText('Kabalite Warriors')).toBeVisible();
  });

  test('aggregates repeated datasheets with exact quantity and points', async ({ page }) => {
    await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    await add(page, 'Archon', 'archon');
    const summary = await review(page);
    await expect(summary).toContainText(/2 units • \d+ pts/);
    const item = summary.locator('[data-testid^="selection-item-"]');
    await expect(item).toHaveCount(1);
    await expect(item).toContainText(/Archon/);
    await expect(item).toContainText(/\d+ pts/);
    await expect(item.getByText('2', { exact: true })).toBeVisible();
    const cost = Number((await item.textContent())?.match(/(\d+) pts/)?.[1]);
    await expect(summary).toContainText(`2 units • ${cost * 2} pts`);
  });

  test('removes one selection while leaving another', async ({ page }) => {
    await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    await add(page, 'Kabalite Warriors', 'kabalite-warriors');
    const summary = await review(page);
    await summary.getByRole('button', { name: 'Decrease Archon' }).click();
    await expect(summary.getByText('Archon')).toBeHidden();
    await expect(summary.getByText('Kabalite Warriors')).toBeVisible();
  });

  test('closes and reopens review without losing selection', async ({ page }) => {
    await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    const summary = await review(page);
    await summary.getByRole('button', { name: 'Close' }).click();
    await expect(summary).toBeHidden();
    await expect((await review(page)).getByText('Archon')).toBeVisible();
  });

  test('clears the pending selection', async ({ page }) => {
    await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    const summary = await review(page);
    await summary.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByRole('button', { name: /Review Selection/i })).toBeHidden();
  });

  test('back navigation cancels pending units', async ({ page }) => {
    const roster = await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    const mobileBack = page.getByTestId('mobile-back-button');
    if (await mobileBack.isVisible().catch(() => false)) {
      await mobileBack.click();
    } else {
      await page.getByRole('link', { name: /Back to/i }).click();
    }
    await expect(page).toHaveURL(roster.rosterEditUrl);
    await expect(page.getByTestId('roster-unit-card-archon')).toHaveCount(0);
  });

  test('persists confirmed units after reload', async ({ page }) => {
    const roster = await openAddUnits(page);
    await add(page, 'Archon', 'archon');
    await (await review(page)).getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(roster.rosterEditUrl);
    await page.reload();
    await expect(page.getByTestId('roster-unit-card-archon')).toBeVisible();
  });
});
