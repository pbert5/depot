import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { profilesApi } from '@/data/profiles';
import { offlineStorage } from '@/data/offline-storage';
import { ProfileProvider, useProfileContext } from './context';

const ProfileState = () => {
  const { loading, profile } = useProfileContext();
  return <output>{loading ? 'loading' : profile?.displayName ?? 'offline'}</output>;
};

describe('ProfileProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
