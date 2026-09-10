import { createContext, useContext, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import { LOCAL_PROFILE_ID, offlineStorage } from '@/data/offline-storage';
import { profilesApi, type Profile, type ProfileList } from '@/data/profiles';

interface ProfileContextValue {
  profile: Profile | null;
  profileId: string;
  loading: boolean;
  refresh: () => Promise<void>;
  selectProfile: (profileId: string) => Promise<Profile>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export const ProfileProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ProfileList | null>(null);
  const [loading, setLoading] = useState(true);
  const migration = useRef<Promise<unknown> | null>(null);
  const refresh = async () => {
    try {
      const next = await profilesApi.list();
      setState(next);
      offlineStorage.setProfileId(next.activeProfileId || next.active.id || LOCAL_PROFILE_ID);
      migration.current ??= offlineStorage.migrateLegacyUserData().finally(() => {
        migration.current = null;
      });
    } catch {
      // The profile API is unavailable in offline and non-browser runtimes.
      // Keep any previously loaded profile and allow the rest of the app to render.
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    const onProfileChange = () => void refresh();
    window.addEventListener('depot:profile-changed', onProfileChange);
    return () => window.removeEventListener('depot:profile-changed', onProfileChange);
  }, []);
  const selectProfile = async (profileId: string) => {
    const profile = await profilesApi.select(profileId);
    offlineStorage.setProfileId(profile.id);
    setState((current) => current ? { ...current, active: profile, activeProfileId: profile.id } : current);
    return profile;
  };
  const value = useMemo(() => ({
    profile: state?.active ?? null,
    profileId: offlineStorage.getProfileId(),
    loading,
    refresh,
    selectProfile
  }), [state, loading]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfileContext = (): ProfileContextValue => {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfileContext must be used inside ProfileProvider');
  return context;
};
