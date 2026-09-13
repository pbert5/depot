import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profilesApi, type Profile, type ProfileList } from '@/data/profiles';
import { LOCAL_PROFILE_ID, offlineStorage } from '@/data/offline-storage';
import { ProfileProvider, useProfileContext } from './context';

const ProfileState = () => {
  const { loading, profile, profileId, selectProfile } = useProfileContext();
  return (
    <>
      <output>{loading ? 'loading' : `${profileId}:${profile?.displayName ?? 'offline'}`}</output>
      <button onClick={() => void selectProfile('profile-two')}>switch</button>
    </>
  );
};

const local: Profile = {
  id: LOCAL_PROFILE_ID,
  displayName: 'Local',
  createdAt: '2026-01-01T00:00:00Z'
};
const two: Profile = {
  id: 'profile-two',
  displayName: 'League night',
  createdAt: '2026-01-02T00:00:00Z'
};

describe('ProfileProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    offlineStorage.setProfileId(LOCAL_PROFILE_ID);
  });

  const renderProvider = (list: () => Promise<ProfileList>) => {
    vi.spyOn(profilesApi, 'list').mockImplementation(list);
    vi.spyOn(offlineStorage, 'migrateLegacyUserData').mockResolvedValue({
      migrated: true,
      rosters: 0,
      collections: 0
    });
    render(
      <ProfileProvider>
        <ProfileState />
      </ProfileProvider>
    );
  };

  it('bootstraps the Local profile into provider and offline storage state', async () => {
    renderProvider(
      vi.fn().mockResolvedValue({ profiles: [local], active: local, activeProfileId: local.id })
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(`${LOCAL_PROFILE_ID}:Local`)
    );
    expect(offlineStorage.getProfileId()).toBe(LOCAL_PROFILE_ID);
  });

  it('converges provider and offline storage when switching profiles', async () => {
    vi.spyOn(profilesApi, 'select').mockResolvedValue(two);
    renderProvider(
      vi
        .fn()
        .mockResolvedValue({ profiles: [local, two], active: local, activeProfileId: local.id })
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Local'));
    fireEvent.click(screen.getByRole('button', { name: 'switch' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('profile-two:League night')
    );
    expect(offlineStorage.getProfileId()).toBe(two.id);
  });

  it('converges after create refreshes the newly active profile', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ profiles: [local], active: local, activeProfileId: local.id })
      .mockResolvedValue({ profiles: [local, two], active: two, activeProfileId: two.id });
    renderProvider(list);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Local'));
    vi.spyOn(profilesApi, 'create').mockResolvedValue(two);
    window.dispatchEvent(new Event('depot:profile-changed'));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('profile-two:League night')
    );
    expect(offlineStorage.getProfileId()).toBe(two.id);
  });

  it('updates the provider profile name after rename', async () => {
    const renamed = { ...local, displayName: 'Renamed' };
    const list = vi
      .fn()
      .mockResolvedValueOnce({ profiles: [local], active: local, activeProfileId: local.id })
      .mockResolvedValue({ profiles: [renamed], active: renamed, activeProfileId: renamed.id });
    renderProvider(list);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Local'));
    window.dispatchEvent(new Event('depot:profile-changed'));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(`${LOCAL_PROFILE_ID}:Renamed`)
    );
    expect(offlineStorage.getProfileId()).toBe(LOCAL_PROFILE_ID);
  });

  it('settles into an offline state when the profile API is unavailable', async () => {
    vi.spyOn(profilesApi, 'list').mockRejectedValue(new TypeError('Failed to parse URL'));
    const migration = vi.spyOn(offlineStorage, 'migrateLegacyUserData').mockResolvedValue({
      migrated: true,
      rosters: 0,
      collections: 0
    });

    render(
      <ProfileProvider>
        <ProfileState />
      </ProfileProvider>
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('offline'));
    expect(migration).toHaveBeenCalledOnce();
  });
});
