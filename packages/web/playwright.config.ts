import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ?? '5173';
const HOST = process.env.HOST ?? 'localhost';
const baseURL = process.env.WEB_BASE_URL ?? `http://${HOST}:${PORT}`;
const external = Boolean(process.env.WEB_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  // The isolated API deliberately uses one disposable user.  Running tests
  // concurrently lets one test's reset delete another test's documents.
  // Keep the shared-runtime contract deterministic until each worker has its
  // own request-scoped profile identity.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
    workers: 1,
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
      testMatch: /.*(roster-add-units|collections)\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } }
    },
    {
      name: 'chromium-narrow-360',
      testMatch: /.*roster-add-units\.spec\.ts/,
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 844 } }
    }
  ],
  webServer: external ? undefined : {
    command: `pnpm --filter @depot/web dev -- --host --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
