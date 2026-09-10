import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, UserRound } from 'lucide-react';
import { Alert, Button, Loader, SectionHeader } from '@/components/ui';
import {
  hideReservedProfiles,
  profilesApi,
  type Profile,
  type ProfilesAdapter
} from '@/data/profiles';

interface ProfileSelectorProps {
  adapter?: ProfilesAdapter;
}

const ProfileSelector = ({ adapter = profilesApi }: ProfileSelectorProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [editing, setEditing] = useState(false);

  const visibleProfiles = useMemo(() => hideReservedProfiles(profiles), [profiles]);
  const activeProfile = visibleProfiles.find((profile) => profile.id === activeId) ?? null;

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adapter.list();
      setProfiles(result.profiles);
      setActiveId(result.activeProfileId || result.active?.id || null);
      setRenameName(result.active?.displayName ?? '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfiles();
  }, [adapter]);

  const mutate = async (operation: () => Promise<Profile>, after?: (profile: Profile) => void) => {
    setBusy(true);
    setError(null);
    try {
      const profile = await operation();
      after?.(profile);
      const result = await adapter.list();
      setProfiles(result.profiles);
      setActiveId(result.activeProfileId || result.active?.id || profile.id);
      setRenameName(result.active?.displayName ?? profile.displayName);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error ? mutationError.message : 'Unable to update profiles.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = createName.trim();
    if (!name) return;
    void mutate(
      () => adapter.create(name),
      () => setCreateName('')
    );
  };

  const handleRename = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeId || !renameName.trim()) return;
    void mutate(
      () => adapter.rename(activeId, renameName.trim()),
      () => setEditing(false)
    );
  };

  return (
    <section className="flex flex-col gap-2" data-testid="profile-selector">
      <SectionHeader title="Profile" />
      <div className="surface-card flex flex-col gap-4 p-3 sm:p-4">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-subtle" role="status">
            <Loader size="sm" /> Loading profiles…
          </div>
        ) : error ? (
          <Alert variant="error" title="Profiles unavailable">
            <p className="text-sm">{error}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadProfiles()}>
              Try again
            </Button>
          </Alert>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-accent text-accent">
                <UserRound size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Current profile
                </p>
                <p
                  className="truncate text-base font-bold text-foreground"
                  data-testid="current-profile"
                >
                  {activeProfile?.displayName ?? 'Unavailable'}
                </p>
              </div>
              {activeProfile && !editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Rename current profile"
                  onClick={() => setEditing(true)}
                >
                  <Pencil size={16} aria-hidden="true" />{' '}
                  <span className="sr-only sm:not-sr-only">Rename</span>
                </Button>
              ) : null}
            </div>

            {visibleProfiles.length > 0 ? (
              <label
                className="flex flex-col gap-1 text-sm font-medium text-foreground"
                htmlFor="profile-select"
              >
                Switch profile
                <select
                  id="profile-select"
                  className="input-base"
                  value={activeProfile ? (activeId ?? '') : ''}
                  disabled={busy}
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id && id !== activeId) void mutate(() => adapter.select(id));
                  }}
                >
                  {!activeProfile ? <option value="">Select a profile</option> : null}
                  {visibleProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-subtle">No profiles are available yet.</p>
            )}

            {editing ? (
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-end"
                onSubmit={handleRename}
              >
                <label
                  className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-foreground"
                  htmlFor="profile-rename"
                >
                  New profile name
                  <input
                    id="profile-rename"
                    className="input-base"
                    value={renameName}
                    maxLength={80}
                    onChange={(event) => setRenameName(event.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={busy || !renameName.trim()}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleCreate}>
              <label
                className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-foreground"
                htmlFor="profile-create"
              >
                Create profile
                <input
                  id="profile-create"
                  className="input-base"
                  placeholder="e.g. Tournament prep"
                  value={createName}
                  maxLength={80}
                  onChange={(event) => setCreateName(event.target.value)}
                />
              </label>
              <Button type="submit" size="sm" disabled={busy || !createName.trim()}>
                <Plus size={16} aria-hidden="true" /> Create
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  );
};

export default ProfileSelector;
