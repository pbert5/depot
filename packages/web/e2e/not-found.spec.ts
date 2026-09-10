import { test, expect } from './fixtures';

test.describe('Not Found page', () => {
  test('shows 404 content and navigation actions', async ({ page }) => {
    await page.goto('/not-found');

    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByTestId('not-found-icon')).toBeVisible();
    await expect(page.getByTestId('page-heading')).toHaveText('Page Not Found');
    await expect(
      page.getByText(/The page you're looking for has been moved, deleted, or doesn't exist/i)
    ).toBeVisible();

    const homeButton = page.getByTestId('go-home-button');
    const backButton = page.getByTestId('go-back-button');

    await expect(homeButton).toBeVisible();
    await expect(backButton).toBeVisible();

    await homeButton.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('keeps informational pages reachable from the shell', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'About depot' })).toBeVisible();
    await expect(page.getByText(/offline-first roster companion/i)).toBeVisible();

    await page.getByRole('link', { name: 'Privacy' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('shows the recoverable failed-load actions', async ({ page }) => {
    await page.goto('/faction/space-marines/detachments');
    await page.route('**/data/factions/space-marines/faction.json', (route) => route.abort());
    await page.reload();

    const error = page.getByTestId('error-state');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Failed to Load Faction');
    await expect(error.getByRole('button', { name: 'Try Again' })).toBeVisible();
    await expect(error.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
  });
});
