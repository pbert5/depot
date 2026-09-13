import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ?? '5173';
const HOST = process.env.HOST ?? 'localhost';
const baseURL = process.env.WEB_BASE_URL ?? `http://${HOST}:${PORT}`;
const external = Boolean(process.env.WEB_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Keep the disposable Compose database/API within its connection budget;
  // callers can raise this explicitly when the topology supports it.
  workers: Number(process.env.PLAYWRIGHT_WORKERS ?? '8'),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'chromium-mobile-390',
      testMatch: /.*(roster-add-units|roster-warlord-mobile|collections)\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } }
    },
    {
      name: 'chromium-narrow-360',
      testMatch: /.*(roster-add-units|roster-warlord-mobile)\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 844 } }
    }
  ],
  webServer: external
    ? undefined
    : {
        command: `pnpm --filter @depot/web dev -- --host --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000
      }
});
