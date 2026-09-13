import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profilesApi } from './profiles';

const profile = {
  id: 'profile-two',
  displayName: 'League night',
  createdAt: '2026-01-02T00:00:00Z'
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

  it('notifies profile consumers after renaming the active profile', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ...profile, displayName: 'Renamed' }), { status: 200 })
    );
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    await profilesApi.rename(profile.id, 'Renamed');

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'depot:profile-changed' })
    );
  });
});
