import { test, expect } from '@playwright/test';
import { resetClientState } from './utils';

test.describe('Collection bulk management', () => {
  test.beforeEach(async ({ page }) => resetClientState(page));

  test('changes, reloads, filters, removes, and atomically handles a failed mutation', async ({ page }) => {
    await page.goto('/collections');
    await page.getByTestId('create-collection-button').click();
    await page.getByLabel('Name').fill(`Bulk E2E ${Date.now()}`);
    await page.getByLabel('Faction').selectOption('astra-militarum');
    await page.getByTestId('create-collection-submit').click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}$/i);
    const collectionUrl = page.url();

    await page.getByTestId('add-collection-units-button').click();
    await page.getByTestId('datasheet-search').fill('Cadian Heavy Weapons Squad');
    const add = page.getByTestId('add-datasheet-cadian-heavy-weapons-squad');
    await add.click();
    await add.click();
    await add.click();
    await page.getByRole('button', { name: /Review Selection/i }).click();
    await page.getByTestId('unit-selection-summary').getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(collectionUrl);
    const cards = page.getByTestId('collection-unit-card');
    await expect(cards).toHaveCount(3);
    const ids = await cards.evaluateAll((elements) => elements.map((element) => element.id));

    await page.getByTestId('toggle-selection-mode').click();
    const selectable = page.getByRole('checkbox');
    await selectable.nth(0).click();
    await selectable.nth(1).click();
    await page.getByTestId('bulk-change-state').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('bulk-state-built').click();

    await expect(page.locator(`#${ids[0]}`)).toHaveAttribute('data-state', 'built');
    await expect(page.locator(`#${ids[1]}`)).toHaveAttribute('data-state', 'built');
    await expect(page.locator(`#${ids[2]}`)).toHaveAttribute('data-state', 'sprue');

    await page.reload();
    await expect(page.locator(`#${ids[0]}`)).toHaveAttribute('data-state', 'built');
    await page.getByTestId('collection-state-filter-built').click();
    await expect(page.getByTestId('collection-unit-card')).toHaveCount(2);

    await page.getByTestId('toggle-selection-mode').click();
    await page.getByTestId('select-visible-units').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('bulk-remove').click();
    await expect(page.getByTestId('empty-collection-state')).toBeVisible();
    await page.getByTestId('collection-state-filter-all').click();
    await expect(page.getByTestId('collection-unit-card')).toHaveCount(1);
    await expect(page.locator(`#${ids[2]}`)).toHaveAttribute('data-state', 'sprue');

    // A failed save must leave the local collection unchanged.
    await page.route('**/api/collections/**', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 503, body: '{"error":"temporary outage"}' });
      } else {
        await route.continue();
      }
    });
    await page.getByTestId('select-visible-units').click();
    await page.getByTestId('bulk-change-state').click();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('bulk-state-parade-ready').click();
    await expect(page.locator(`#${ids[2]}`)).toHaveAttribute('data-state', 'sprue');
  });
});
