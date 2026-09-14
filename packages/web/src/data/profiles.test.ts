import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profilesApi } from './profiles';

const profile = {
  id: 'profile-two',
  displayName: 'League night',
  createdAt: '2026-01-02T00:00:00Z',
  kind: 'main' as const
};

describe('profilesApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('notifies profile consumers after creating the newly active profile', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(profile), { status: 201 })
    );
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    await expect(profilesApi.create(profile.displayName)).resolves.toEqual(profile);

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'depot:profile-changed' })
    );
  });

  it('sends and returns an explicit e2e profile kind', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ...profile, kind: 'e2e' }), { status: 201 })
    );

    await expect(profilesApi.create('worker fixture', 'e2e')).resolves.toMatchObject({
      kind: 'e2e'
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/profiles',
      expect.objectContaining({
        body: JSON.stringify({ displayName: 'worker fixture', kind: 'e2e' })
      })
    );
  });

  it('notifies profile consumers after renaming the active profile', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      return new Response(
        JSON.stringify(url.includes('/select') ? profile : { ...profile, displayName: 'Renamed' }),
        { status: 200 }
      );
    });
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    await profilesApi.rename(profile.id, 'Renamed');

    expect(await profilesApi.select(profile.id)).toMatchObject({ kind: 'main' });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'depot:profile-changed' })
    );
  });
});
