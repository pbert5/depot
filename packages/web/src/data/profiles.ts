/**
 * The web boundary for the profile API.
 *
 * Profile identity is owned by the API (including cookies/headers). The UI
 * only receives profile records and asks the API to select or mutate one.
 */
export interface Profile {
  id: string;
  displayName: string;
  createdAt: string;
  kind: 'main' | 'e2e';
}

export interface ProfileList {
  profiles: Profile[];
  active: Profile;
  activeProfileId: string;
}

export interface ProfilesAdapter {
  list: () => Promise<ProfileList>;
  create: (displayName: string, kind?: Profile['kind']) => Promise<Profile>;
  select: (profileId: string) => Promise<Profile>;
  rename: (profileId: string, displayName: string) => Promise<Profile>;
}

/** Reserved disposable identity used by the E2E Compose fixture. */
export const RESERVED_E2E_PROFILE_ID = '00000000-0000-0000-0000-000000000002';

const notifyProfileChanged = () => window.dispatchEvent(new Event('depot:profile-changed'));

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
  });

  if (!response.ok) {
    let message = `Profile request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // Keep the status-based message when the API did not return JSON.
    }
    throw new Error(message);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};

export const profilesApi: ProfilesAdapter = {
  list: () => request<ProfileList>('/profiles'),
  create: async (displayName, kind) => {
    const profile = await request<Profile>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ displayName, ...(kind ? { kind } : {}) })
    });
    notifyProfileChanged();
    return profile;
  },
  select: async (profileId) => {
    const profile = await request<Profile>(`/profiles/${encodeURIComponent(profileId)}/select`, {
      method: 'POST'
    });
    notifyProfileChanged();
    return profile;
  },
  rename: async (profileId, displayName) => {
    const profile = await request<Profile>(`/profiles/${encodeURIComponent(profileId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ displayName })
    });
    notifyProfileChanged();
    return profile;
  }
};

export const hideReservedProfiles = (profiles: Profile[]): Profile[] =>
  profiles.filter((profile) => profile.id !== RESERVED_E2E_PROFILE_ID);
