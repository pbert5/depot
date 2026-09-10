import { test, expect } from './fixtures';
import { resetClientState } from './utils';

test('reset only deletes the current worker profile documents', async ({ page }) => {
  await page.goto('/');
  const workerProfile = await page.evaluate(async () => {
    const response = await fetch('/api/profiles/active');
    return await response.json() as { id: string };
  });
  const otherProfile = await page.evaluate(async () => {
    const response = await fetch('/api/profiles', {
      method: 'POST', credentials: 'omit', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ displayName: 'E2E isolation proof other worker' })
    });
    return (await response.json() as { id: string }).id;
  });
  const document = (id: string) => ({ id, name: id, factionId: 'space-marines' });
  await page.evaluate(async ({ profile, doc }) => { await fetch('/api/rosters', { method: 'POST', headers: { 'content-type': 'application/json', 'x-depot-profile-id': profile }, body: JSON.stringify(doc) }); }, { profile: workerProfile.id, doc: document('worker-a-document') });
  await page.evaluate(async ({ profile, doc }) => { await fetch('/api/rosters', { method: 'POST', headers: { 'content-type': 'application/json', 'x-depot-profile-id': profile }, body: JSON.stringify(doc) }); }, { profile: otherProfile, doc: document('worker-b-document') });
  await resetClientState(page);
  const remaining = await page.evaluate(async (profile) => (await fetch('/api/rosters', { headers: { 'x-depot-profile-id': profile } })).json(), otherProfile);
  expect(remaining).toEqual([expect.objectContaining({ id: 'worker-b-document' })]);
});
