import { test, expect } from './fixtures';
import { resetClientState } from './utils';

test('reset only deletes the current worker profile documents', async ({ page, request, e2eProfileId }) => {
  await page.goto('/');
  const workerProfile = await page.evaluate(async () => {
    const response = await fetch('/api/profiles/active');
    return await response.json() as { id: string };
  });
  const otherProfile = await request.post('/api/profiles', {
    data: { displayName: 'E2E isolation proof other worker' }
  }).then(async (response) => {
    if (!response.ok()) throw new Error(`other profile creation failed: ${response.status()}`);
    return (await response.json() as { id: string }).id;
  });
  const document = (id: string) => ({ id, name: id, factionId: 'space-marines' });
  const seed = async (profile: string, doc: ReturnType<typeof document>) => {
    const response = await request.put(`/api/rosters/${doc.id}`, {
      headers: { 'x-depot-profile-id': profile }, data: doc
    });
    if (!response.ok()) throw new Error(`profile seed failed: ${response.status()}`);
  };
  await Promise.all([
    seed(workerProfile.id, document('worker-a-document')),
    seed(otherProfile, document('worker-b-document'))
  ]);
  // Profile creation intentionally does not change the worker identity, but
  // explicitly restore it before reset so this proof remains valid if a
  // browser implementation processes Set-Cookie on credentialless fetches.
  await page.evaluate(async (profile) => {
    const response = await fetch(`/api/profiles/${profile}/select`, { method: 'POST' });
    if (!response.ok) throw new Error(`worker A select failed: ${response.status}`);
  }, workerProfile.id);
  const beforeResetResponse = await request.get('/api/rosters', {
    headers: { 'x-depot-profile-id': otherProfile }
  });
  if (!beforeResetResponse.ok()) throw new Error(`other profile pre-reset read failed: ${beforeResetResponse.status()}`);
  const beforeReset = await beforeResetResponse.json();
  expect(beforeReset).toEqual([expect.objectContaining({ id: 'worker-b-document' })]);
  await resetClientState(page, e2eProfileId);
  const remainingResponse = await request.get('/api/rosters', {
    headers: { 'x-depot-profile-id': otherProfile }
  });
  if (!remainingResponse.ok()) throw new Error(`other profile read failed: ${remainingResponse.status()}`);
  const remaining = await remainingResponse.json();
  expect(remaining).toEqual([expect.objectContaining({ id: 'worker-b-document' })]);
});
