import { test as base, expect } from '@playwright/test';

type WorkerFixtures = { e2eProfileId: string };
const e2eBaseURL = process.env.WEB_BASE_URL
  ?? `http://${process.env.HOST ?? 'localhost'}:${process.env.PORT ?? '5173'}`;

export const test = base.extend<{}, WorkerFixtures>({
  e2eProfileId: [async ({ playwright }, use, workerInfo) => {
    const api = await playwright.request.newContext({ baseURL: e2eBaseURL });
    const response = await api.post('/api/profiles', {
      data: { displayName: `E2E ${workerInfo.project.name} worker ${workerInfo.workerIndex}` }
    });
    if (!response.ok()) throw new Error(`Unable to create E2E profile (${response.status()})`);
    const profile = (await response.json()) as { id: string };
    await api.dispose();
    await use(profile.id);
  }, { scope: 'worker' }],
  context: async ({ context, e2eProfileId, baseURL }, use) => {
    await context.setExtraHTTPHeaders({ 'x-depot-profile-id': e2eProfileId });
    await context.addCookies([{
      name: 'depot_profile_id', value: e2eProfileId, url: baseURL!
    }]);
    await use(context);
  }
});

export { expect };
export type { Page, Route } from '@playwright/test';
