import { test, expect } from '@playwright/test';
import { resetClientState } from './utils';

test.describe('Collections', () => {
  test.beforeEach(async ({ page }) => {
    await resetClientState(page);
  });

  test('collection form waits for factions and enables submit once filled', async ({ page }) => {
    await page.goto('/collections');
    await page.getByTestId('create-collection-button').click();

    const skeleton = page.getByTestId('field-skeleton');
    await skeleton.first().waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
    await page.getByTestId('collection-faction-field-select').waitFor({ state: 'visible' });

    const submitButton = page.getByTestId('create-collection-submit');
    await expect(submitButton).toBeDisabled();

    await page.getByTestId('collection-name-input').fill(`E2E Collection ${Date.now()}`);
    await page.getByTestId('collection-faction-field-select').selectOption({ index: 1 });

    await expect(submitButton).not.toBeDisabled();
  });

  test('create collection and persist state filter selection', async ({ page }) => {
    await page.goto('/collections');

    // Start create flow
    await page.getByTestId('create-collection-button').click();
    await expect(page.getByTestId('create-collection-sheet')).toBeVisible();

    const uniqueName = `E2E Collection ${Date.now()}`;
    await page.getByLabel('Name').fill(uniqueName);

    const factionSelect = page.getByLabel('Faction');
    await factionSelect.selectOption({ index: 1 });

    await page.getByTestId('create-collection-submit').click();

    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}$/i);
    await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible();
    await expect(page.getByTestId('add-collection-units-button')).toBeVisible();

    // State filters should be present
    const paradeFilter = page.getByTestId('collection-state-filter-parade-ready');
    await expect(paradeFilter).toBeVisible();

    await paradeFilter.click();
    const stored = await page.evaluate(
      () => window.localStorage.getItem('depot:tag-selection:collection-state-filter')
    );
    expect(stored).toBe('parade-ready');

    // Reload and ensure filter selection persisted
    const currentUrl = page.url();
    await page.goto(currentUrl);
    const storedAfterReload = await page.evaluate(
      () => window.localStorage.getItem('depot:tag-selection:collection-state-filter')
    );
    expect(storedAfterReload).toBe('parade-ready');
  });

  test('add Astra Militarum units to a collection', async ({ page }) => {
    await page.goto('/collections');

    await page.getByTestId('create-collection-button').click();
    await expect(page.getByTestId('create-collection-sheet')).toBeVisible();

    const uniqueName = `Astra Militarum E2E ${Date.now()}`;
    await page.getByLabel('Name').fill(uniqueName);

    const factionSelect = page.getByLabel('Faction');
    await factionSelect.selectOption('astra-militarum');

    await page.getByTestId('create-collection-submit').click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}$/i);

    const collectionUrl = page.url();
    await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible();

    await page.getByTestId('add-collection-units-button').click();
    await expect(page).toHaveURL(`${collectionUrl}/add-units`);

    const loadingLocator = page.locator('[data-testid="datasheet-loading"]');
    await loadingLocator.waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
    await loadingLocator.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {});

    const searchInput = page.getByTestId('datasheet-search');
    await expect(searchInput).toBeVisible({ timeout: 60000 });

    // Add a Leman Russ Commander
    await searchInput.fill('Leman Russ Commander');
    const lemanAddButton = page.getByTestId('add-datasheet-leman-russ-commander');
    await expect(lemanAddButton).toBeVisible();
    await lemanAddButton.click();

    // Queue two Heavy Weapons Squads
    await searchInput.fill('Cadian Heavy Weapons Squad');
    const cadianAddButton = page.getByTestId('add-datasheet-cadian-heavy-weapons-squad');
    await expect(cadianAddButton).toBeVisible();
    await cadianAddButton.click();
    await cadianAddButton.click();

    const reviewButton = page.getByRole('button', { name: /Review Selection/i });
    await expect(reviewButton).toBeVisible();
    await reviewButton.click();

    const summaryDrawer = page.getByTestId('unit-selection-summary');
    await expect(summaryDrawer).toBeVisible();
    await expect(summaryDrawer.getByText('Leman Russ Commander')).toBeVisible();
    await expect(summaryDrawer.getByText('Cadian Heavy Weapons Squad')).toBeVisible();
    await expect(summaryDrawer.getByText(/3 units/i)).toBeVisible();

    await summaryDrawer.getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(collectionUrl);

    const unitCards = page.getByTestId('collection-unit-card');
    await expect(unitCards).toHaveCount(3);
    await expect(page.getByText('Leman Russ Commander')).toBeVisible();
    const cadianCards = unitCards.filter({ hasText: 'Cadian Heavy Weapons Squad' });
    await expect(cadianCards).toHaveCount(2);
  });

  test('COLLECTION-003: filters all build states and persists unit edits', async ({ page }) => {
    await page.goto('/collections');
    await page.getByTestId('create-collection-button').click();
    await page.getByLabel('Name').fill(`Collection 003 ${Date.now()}`);
    await page.getByLabel('Faction').selectOption('astra-militarum');
    await page.getByTestId('create-collection-submit').click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}$/i);

    const collectionUrl = page.url();
    await page.getByTestId('add-collection-units-button').click();
    await expect(page.getByTestId('datasheet-search')).toBeVisible({ timeout: 60000 });
    await page.getByTestId('datasheet-search').fill('Leman Russ Commander');
    await page.getByTestId('add-datasheet-leman-russ-commander').click();
    await page.getByRole('button', { name: /Review Selection/i }).click();
    await page.getByTestId('unit-selection-summary').getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(collectionUrl);

    const unitCard = page.getByTestId('collection-unit-card').first();
    const unitId = await unitCard.getAttribute('id');
    await unitCard.click();
    await expect(page).toHaveURL(new RegExp(`${collectionUrl}/units/.+/edit$`));

    const state = page.getByLabel('Build state');
    await state.selectOption('parade-ready');

    const wargear = page.getByTestId('wargear-table').getByRole('button').first();
    const wasWargearSelected = (await wargear.getAttribute('aria-pressed')) === 'true';
    if (!wasWargearSelected) await wargear.click();

    const modelCost = page.getByTestId('model-cost-select');
    await expect(modelCost).toBeVisible();
    const costOptions = modelCost.locator('option');
    expect(await costOptions.count()).toBeGreaterThan(1);
    const targetCost = await costOptions.last().getAttribute('value');
    expect(targetCost).not.toBeNull();
    await modelCost.locator('select').selectOption(targetCost!);
    await page.getByTestId('save-button').click();

    await expect(page).toHaveURL(new RegExp(`${collectionUrl}#collection-unit-.+`));
    await expect(page.getByTestId('collection-unit-card')).toHaveAttribute('data-state', 'parade-ready');
    await page.getByTestId('collection-state-filter-sprue').click();
    await expect(page.getByTestId('empty-collection-state')).toBeVisible();
    await page.getByTestId('collection-state-filter-built').click();
    await expect(page.getByTestId('collection-state-filter-built')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('collection-state-filter-battle-ready').click();
    await expect(page.getByTestId('collection-state-filter-battle-ready')).toHaveAttribute('aria-selected', 'true');
    await page.getByTestId('collection-state-filter-parade-ready').click();
    await expect(page.getByTestId('collection-unit-card')).toHaveAttribute('id', unitId!);

    await page.reload();
    await expect(page.getByTestId('collection-state-filter-parade-ready')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await page.getByTestId('collection-unit-card').click();
    await expect(page.getByTestId('unit-state-section').locator('select')).toHaveValue('parade-ready');
    await expect(page.getByTestId('model-cost-select').locator('select')).toHaveValue(targetCost!);
    await expect(wargear).toHaveAttribute('aria-pressed', 'true');
  });

  test('COLLECTION-004: duplicates independently and removes or deletes immediately', async ({ page }) => {
    await page.goto('/collections');
    await page.getByTestId('create-collection-button').click();
    const collectionName = `Collection 004 ${Date.now()}`;
    await page.getByLabel('Name').fill(collectionName);
    await page.getByLabel('Faction').selectOption('astra-militarum');
    await page.getByTestId('create-collection-submit').click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}$/i);
    const sourceUrl = page.url();

    await page.getByTestId('add-collection-units-button').click();
    await expect(page.getByTestId('datasheet-search')).toBeVisible({ timeout: 60000 });
    await page.getByTestId('datasheet-search').fill('Cadian Heavy Weapons Squad');
    await page.getByTestId('add-datasheet-cadian-heavy-weapons-squad').click();
    await page.getByRole('button', { name: /Review Selection/i }).click();
    await page.getByTestId('unit-selection-summary').getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(sourceUrl);
    const sourceUnitId = await page.getByTestId('collection-unit-card').getAttribute('id');

    await page.goto('/collections');
    const sourceCard = page.getByTestId(/^collection-card-/).filter({ hasText: collectionName });
    await sourceCard.getByTestId('duplicate-collection-button').click();
    const copyCard = page.getByTestId(/^collection-card-/).filter({ hasText: `${collectionName} Copy` });
    await expect(copyCard).toBeVisible();
    await copyCard.click();
    await expect(page).toHaveURL(/\/collections\/[0-9a-f-]{36}$/i);
    const copyUnit = page.getByTestId('collection-unit-card');
    await expect(copyUnit).toHaveCount(1);
    await expect(copyUnit).not.toHaveAttribute('id', sourceUnitId!);

    await copyUnit.getByRole('button', { name: 'Remove unit from collection' }).click();
    await expect(page.getByTestId('empty-collection-state')).toBeVisible();

    await page.goto('/collections');
    const sourceCardAfterCopy = page
      .getByTestId(/^collection-card-/)
      .filter({ has: page.getByText(collectionName, { exact: true }) });
    await expect(sourceCardAfterCopy).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await sourceCardAfterCopy.getByTestId('delete-collection-button').click();
    await expect(sourceCardAfterCopy).toHaveCount(0);
    await expect(page.getByTestId(/^collection-card-/).filter({ hasText: `${collectionName} Copy` })).toHaveCount(1);
  });
});
