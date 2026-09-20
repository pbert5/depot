import type { depot } from '@depot/core';
import { mergeSettingsWithDefaults } from '@/constants/settings';
import { normalizeDatasheetWargear } from '@depot/core/utils/wargear';
import { normalizeUnit } from '@/contexts/roster/reducer';
import { toStoredCollection, toStoredRoster } from '@depot/core/utils/saved';
import type { CachedFaction } from '@/types/offline';

// Database configuration constants
const DB_CONFIG = {
  NAME: 'depot-offline',
  VERSION: 12
} as const;

const STORES = {
  FACTION_INDEX: 'factionIndex',
  FACTION_MANIFESTS: 'factionManifests',
  DATASHEETS: 'datasheets',
  SETTINGS: 'settings',
  USER_DATA: 'userData',
  ROSTERS: 'rosters',
  COLLECTIONS: 'collections',
  SCOPED_USER_DATA: 'scopedUserData',
  SCOPED_ROSTERS: 'scopedRosters',
  SCOPED_COLLECTIONS: 'scopedCollections'
} as const;

const KEYS = {
  SETTINGS: 'settings',
  DATA_VERSION: 'data-version',
  BOOKMARKS: 'bookmarks',
  MIGRATION: 'server-migration-v1'
} as const;

/** The API's bootstrap profile, also known as the Local user. */
export const LOCAL_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) }
  });
  if (!response.ok) {
    const error = new Error(`Depot API ${response.status}`) as Error & { status?: number; detail?: string };
    error.status = response.status;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body?.detail === 'string' && body.detail) {
        error.detail = body.detail;
        error.message = body.detail;
      }
    } catch {
      // Keep the status-based error when the response body is not JSON.
    }
    throw error;
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
};

const scopedKey = (profileId: string, id: string) => `${profileId}:${id}`;

const stampTimestamps = <T extends { createdAt?: string; updatedAt?: string }>(
  entity: T
): T & { createdAt: string; updatedAt: string } => {
  const now = new Date().toISOString();
  return {
    ...entity,
    createdAt: entity.createdAt ?? now,
    updatedAt: now
  };
};

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const normalizeRoster = (roster: depot.Roster): depot.Roster => {
  const factionSlug = roster.factionSlug ?? roster.faction?.slug ?? roster.factionId;

  return {
    ...roster,
    dataVersion: roster.dataVersion ?? null,
    factionSlug,
    faction: roster.faction
      ? { ...roster.faction, slug: roster.faction.slug ?? factionSlug }
      : roster.faction,
    warlordUnitId: roster.warlordUnitId ?? null,
    units: roster.units.map(normalizeUnit)
  };
};

const normalizeCollection = (collection: depot.Collection): depot.Collection => {
  const factionSlug = collection.factionSlug ?? collection.faction?.slug ?? collection.factionId;

  return {
    ...collection,
    dataVersion: collection.dataVersion ?? null,
    factionSlug,
    faction: collection.faction
      ? { ...collection.faction, slug: collection.faction.slug ?? factionSlug }
      : collection.faction,
    items: collection.items.map(normalizeUnit),
    points: {
      current:
        collection.points?.current ??
        collection.items.reduce(
          (total, item) => total + (parseInt(item.modelCost.cost, 10) || 0),
          0
        )
    }
  };
};

// Database connection with proper error handling
class OfflineStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private profileId = LOCAL_PROFILE_ID;

  setProfileId(profileId: string): void {
    if (profileId && profileId !== this.profileId) {
      this.profileId = profileId;
      window.dispatchEvent(new Event('depot:user-data-changed'));
    }
  }

  getProfileId(): string {
    return this.profileId;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = () => {
          const db = request.result;
          const upgradeTransaction = request.transaction;

          // Create or reset faction index store
          if (db.objectStoreNames.contains(STORES.FACTION_INDEX)) {
            db.deleteObjectStore(STORES.FACTION_INDEX);
          }
          db.createObjectStore(STORES.FACTION_INDEX, { keyPath: 'slug' });

          // Create or reset faction manifests store keyed by slug
          if (!db.objectStoreNames.contains(STORES.FACTION_MANIFESTS)) {
            db.createObjectStore(STORES.FACTION_MANIFESTS);
          } else {
            upgradeTransaction?.objectStore(STORES.FACTION_MANIFESTS).clear();
          }

          // Create or reset datasheets store keyed by datasheet id
          if (!db.objectStoreNames.contains(STORES.DATASHEETS)) {
            db.createObjectStore(STORES.DATASHEETS);
          } else {
            upgradeTransaction?.objectStore(STORES.DATASHEETS).clear();
          }

          // Drop legacy factions store when upgrading
          if (db.objectStoreNames.contains('factions')) {
            db.deleteObjectStore('factions');
          }

          // Create settings store (preserve existing data)
          if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
            db.createObjectStore(STORES.SETTINGS);
          }

          // Create or reset user data store (my factions etc.)
          if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
            db.createObjectStore(STORES.USER_DATA);
          } else {
            upgradeTransaction?.objectStore(STORES.USER_DATA).clear();
          }

          // Saves survive upgrades: they hold ids and selections, and load
          // rehydrates them against whatever catalog is cached.
          if (!db.objectStoreNames.contains(STORES.ROSTERS)) {
            db.createObjectStore(STORES.ROSTERS, { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains(STORES.COLLECTIONS)) {
            db.createObjectStore(STORES.COLLECTIONS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.SCOPED_USER_DATA)) {
            db.createObjectStore(STORES.SCOPED_USER_DATA);
          }
          if (!db.objectStoreNames.contains(STORES.SCOPED_ROSTERS)) {
            db.createObjectStore(STORES.SCOPED_ROSTERS);
          }
          if (!db.objectStoreNames.contains(STORES.SCOPED_COLLECTIONS)) {
            db.createObjectStore(STORES.SCOPED_COLLECTIONS);
          }
        };
      });
    }

    return this.dbPromise;
  }

  private async store(
    storeName: (typeof STORES)[keyof typeof STORES],
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.getDB();
    return db.transaction([storeName], mode).objectStore(storeName);
  }

  private async scopedStore(
    storeName: typeof STORES.SCOPED_USER_DATA | typeof STORES.SCOPED_ROSTERS | typeof STORES.SCOPED_COLLECTIONS,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    return this.store(storeName, mode);
  }

  // Faction Index Operations
  async getFactionIndex(): Promise<depot.Index[] | null> {
    try {
      const store = await this.store(STORES.FACTION_INDEX);
      const result = (await req(store.getAll())) as depot.Index[] | undefined;
      return result && result.length > 0 ? result : null;
    } catch (error) {
      console.error('Failed to get faction index from IndexedDB:', error);
      return null;
    }
  }

  async setFactionIndex(index: depot.Index[]): Promise<void> {
    const store = await this.store(STORES.FACTION_INDEX, 'readwrite');
    await req(store.clear());
    await Promise.all(index.map((faction) => req(store.put(faction))));
  }

  // Faction Data Operations
  async getFactionManifest(factionSlug: string): Promise<depot.FactionManifest | null> {
    try {
      const store = await this.store(STORES.FACTION_MANIFESTS);
      return ((await req(store.get(factionSlug))) as depot.FactionManifest | undefined) ?? null;
    } catch (error) {
      console.error(`Failed to get manifest for ${factionSlug} from IndexedDB:`, error);
      return null;
    }
  }

  async setFactionManifest(factionSlug: string, manifest: depot.FactionManifest): Promise<void> {
    const store = await this.store(STORES.FACTION_MANIFESTS, 'readwrite');
    await req(store.put(manifest, factionSlug));
  }

  async getDatasheet(datasheetId: string): Promise<depot.Datasheet | null> {
    try {
      const store = await this.store(STORES.DATASHEETS);
      return ((await req(store.get(datasheetId))) as depot.Datasheet | undefined) ?? null;
    } catch (error) {
      console.error(`Failed to get datasheet ${datasheetId} from IndexedDB:`, error);
      return null;
    }
  }

  async setDatasheet(datasheet: depot.Datasheet): Promise<void> {
    const store = await this.store(STORES.DATASHEETS, 'readwrite');
    await req(store.put(normalizeDatasheetWargear(datasheet), datasheet.id));
  }

  // Collections
  async getCollections(): Promise<depot.StoredCollection[]> {
    try {
      return await apiRequest<depot.StoredCollection[]>('/collections', { headers: { 'x-depot-profile-id': this.profileId } });
    } catch {
      // Before the one-time migration completes, the old store remains a recovery source.
    }
    try {
      const store = await this.scopedStore(STORES.SCOPED_COLLECTIONS);
      return ((await req(store.getAll())) as Array<depot.StoredCollection & { profileId?: string }> | undefined)
        ?.filter((item) => item.profileId === this.profileId)
        .map(({ profileId: _profileId, ...collection }) => collection) ?? [];
    } catch (error) {
      console.error('Failed to get collections from IndexedDB:', error);
      return [];
    }
  }

  async getCollection(id: string): Promise<depot.StoredCollection | null> {
    try {
      return await apiRequest<depot.StoredCollection | null>(
        `/collections/${encodeURIComponent(id)}`, { headers: { 'x-depot-profile-id': this.profileId } }
      );
    } catch {
      // Recovery fallback; normal writes go to the API whenever it is reachable.
    }
    try {
      const store = await this.scopedStore(STORES.SCOPED_COLLECTIONS);
      return ((await req(store.get(scopedKey(this.profileId, id))) as (depot.StoredCollection & { profileId?: string }) | undefined) ?? null);
    } catch (error) {
      console.error(`Failed to get collection ${id} from IndexedDB:`, error);
      return null;
    }
  }

  async saveCollection(
    collection: depot.Collection,
    options: { fallbackOnHttpError?: boolean } = {}
  ): Promise<void> {
    const document = stampTimestamps(toStoredCollection(normalizeCollection(collection)));
    try {
      await apiRequest(`/collections/${encodeURIComponent(document.id)}`, {
        method: 'PUT',
        body: JSON.stringify(document), headers: { 'x-depot-profile-id': this.profileId }
      });
      return;
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        options.fallbackOnHttpError === false
      ) {
        throw error;
      }
      // Keep a local draft if the server is temporarily unavailable.
    }
    const store = await this.scopedStore(STORES.SCOPED_COLLECTIONS, 'readwrite');
    await req(store.put({ ...document, profileId: this.profileId }, scopedKey(this.profileId, document.id)));
  }

  async deleteCollection(id: string): Promise<void> {
    try {
      await apiRequest(`/collections/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-depot-profile-id': this.profileId } });
      return;
    } catch {
      // A local draft may still be removed while offline.
    }
    const store = await this.scopedStore(STORES.SCOPED_COLLECTIONS, 'readwrite');
    await req(store.delete(scopedKey(this.profileId, id)));
  }

  async getAllCachedFactions(): Promise<CachedFaction[]> {
    try {
      const [manifests, datasheets] = await Promise.all([
        this.store(STORES.FACTION_MANIFESTS).then(
          (store) => req(store.getAll()) as Promise<depot.FactionManifest[]>
        ),
        this.store(STORES.DATASHEETS).then(
          (store) => req(store.getAll()) as Promise<depot.Datasheet[]>
        )
      ]);

      const datasheetCountByFaction = (datasheets ?? []).reduce<Record<string, number>>(
        (acc, sheet) => {
          const factionSlug = sheet.factionSlug || sheet.factionId;
          if (!factionSlug) {
            return acc;
          }
          acc[factionSlug] = (acc[factionSlug] ?? 0) + 1;
          return acc;
        },
        {}
      );

      return (manifests ?? []).map((manifest) => ({
        id: manifest.id,
        slug: manifest.slug,
        name: manifest.name,
        cachedDatasheets: datasheetCountByFaction[manifest.slug] ?? 0
      }));
    } catch (error) {
      console.error('Failed to get all cached factions:', error);
      return [];
    }
  }

  // Settings Operations
  async getSettings(): Promise<depot.Settings | null> {
    try {
      const store = await this.store(STORES.SETTINGS);
      const storedSettings = (await req(store.get(KEYS.SETTINGS))) as depot.Settings | undefined;
      return storedSettings ? mergeSettingsWithDefaults(storedSettings) : null;
    } catch (error) {
      console.error('Failed to get settings from IndexedDB:', error);
      return null;
    }
  }

  async setSettings(settings: depot.Settings): Promise<void> {
    const store = await this.store(STORES.SETTINGS, 'readwrite');
    await req(store.put(mergeSettingsWithDefaults(settings), KEYS.SETTINGS));
  }

  async getDataVersion(): Promise<string | null> {
    try {
      const store = await this.scopedStore(STORES.SCOPED_USER_DATA);
      return ((await req(store.get(scopedKey(this.profileId, KEYS.DATA_VERSION)))) as string | undefined) ?? null;
    } catch (error) {
      console.error('Failed to get data version from IndexedDB:', error);
      return null;
    }
  }

  async setDataVersion(version: string): Promise<void> {
    const store = await this.scopedStore(STORES.SCOPED_USER_DATA, 'readwrite');
    await req(store.put(version, scopedKey(this.profileId, KEYS.DATA_VERSION)));
  }

  // Bookmark Operations (USER_DATA key-value)
  async getBookmarks(): Promise<depot.Bookmark[]> {
    try {
      const store = await this.scopedStore(STORES.SCOPED_USER_DATA);
      const stored = (await req(store.get(scopedKey(this.profileId, KEYS.BOOKMARKS)))) as depot.Bookmark[] | undefined;
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      console.error('Failed to get bookmarks from IndexedDB:', error);
      return [];
    }
  }

  async setBookmarks(bookmarks: depot.Bookmark[]): Promise<void> {
    const store = await this.scopedStore(STORES.SCOPED_USER_DATA, 'readwrite');
    await req(store.put(bookmarks, scopedKey(this.profileId, KEYS.BOOKMARKS)));
  }

  /** Returns true when the bookmark is present after the toggle. */
  async toggleBookmark(bookmark: depot.Bookmark): Promise<boolean> {
    const existing = await this.getBookmarks();
    const isPresent = existing.some((entry) => entry.id === bookmark.id);
    if (isPresent) {
      await this.setBookmarks(existing.filter((entry) => entry.id !== bookmark.id));
      return false;
    }
    await this.setBookmarks([bookmark, ...existing]);
    return true;
  }

  // Roster Operations
  async saveRoster(roster: depot.Roster): Promise<void> {
    const document = stampTimestamps(toStoredRoster(normalizeRoster(roster)));
    try {
      await apiRequest(`/rosters/${encodeURIComponent(document.id)}`, {
        method: 'PUT',
        body: JSON.stringify(document), headers: { 'x-depot-profile-id': this.profileId }
      });
      return;
    } catch {
      // Keep a local draft if the server is temporarily unavailable.
    }
    const store = await this.scopedStore(STORES.SCOPED_ROSTERS, 'readwrite');
    await req(store.put({ ...document, profileId: this.profileId }, scopedKey(this.profileId, document.id)));
  }

  /** Persist a roster to the server without silently converting an API failure into success. */
  async saveRosterToServer(roster: depot.Roster): Promise<void> {
    const document = stampTimestamps(toStoredRoster(normalizeRoster(roster)));
    await apiRequest(`/rosters/${encodeURIComponent(document.id)}`, {
      method: 'PUT',
      body: JSON.stringify(document), headers: { 'x-depot-profile-id': this.profileId }
    });
  }

  /** Keep a recoverable local draft without contacting the API. */
  async saveRosterLocally(roster: depot.Roster): Promise<void> {
    const document = stampTimestamps(toStoredRoster(normalizeRoster(roster)));
    const store = await this.scopedStore(STORES.SCOPED_ROSTERS, 'readwrite');
    await req(store.put({ ...document, profileId: this.profileId }, scopedKey(this.profileId, document.id)));
  }

  async getRoster(rosterId: string): Promise<depot.StoredRoster | null> {
    let remote: depot.StoredRoster | null = null;
    try {
      remote = await apiRequest<depot.StoredRoster | null>(
        `/rosters/${encodeURIComponent(rosterId)}`, { headers: { 'x-depot-profile-id': this.profileId } }
      );
    } catch {
      // Recovery fallback; the server is authoritative when available.
    }
    try {
      const store = await this.scopedStore(STORES.SCOPED_ROSTERS);
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const stored = (await req(store.get(scopedKey(this.profileId, rosterId)))) as depot.StoredRoster | undefined;
        if (stored) {
          const storedUpdatedAt = stored.updatedAt ?? '';
          const remoteUpdatedAt = remote?.updatedAt ?? '';
          return !remote || storedUpdatedAt > remoteUpdatedAt ? stored : remote;
        }
        if (remote) return remote;
        // A newly-created roster is staged locally immediately while its
        // debounced API save runs. Allow the detail route to observe that
        // write when it mounts in the same navigation turn.
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return remote;
    } catch (error) {
      console.error(`Failed to get roster ${rosterId} from IndexedDB:`, error);
      return null;
    }
  }

  async getAllRosters(): Promise<depot.StoredRoster[]> {
    try {
      return await apiRequest<depot.StoredRoster[]>('/rosters', { headers: { 'x-depot-profile-id': this.profileId } });
    } catch {
      // Recovery fallback; the server is authoritative when available.
    }
    try {
      const store = await this.scopedStore(STORES.SCOPED_ROSTERS);
      return ((await req(store.getAll())) as Array<depot.StoredRoster & { profileId?: string }> | undefined)
        ?.filter((item) => item.profileId === this.profileId)
        .map(({ profileId: _profileId, ...roster }) => roster) ?? [];
    } catch (error) {
      console.error('Failed to get all rosters from IndexedDB:', error);
      return [];
    }
  }

  async deleteRoster(rosterId: string): Promise<void> {
    try {
      await apiRequest(`/rosters/${encodeURIComponent(rosterId)}`, { method: 'DELETE', headers: { 'x-depot-profile-id': this.profileId } });
      return;
    } catch {
      // A local draft may still be removed while offline.
    }
    const store = await this.scopedStore(STORES.SCOPED_ROSTERS, 'readwrite');
    await req(store.delete(scopedKey(this.profileId, rosterId)));
  }

  async migrateLegacyUserData(): Promise<{
    migrated: boolean;
    rosters: number;
    collections: number;
  }> {
    const [legacyRosters, legacyCollections] = await Promise.all([
      this.getLegacyRosters(),
      this.getLegacyCollections()
    ]);
    let rosters = 0;
    let collections = 0;
    for (const roster of legacyRosters) {
      const localMarker = `${KEYS.MIGRATION}:local:roster:${roster.id}`;
      if (!(await this.getUserDataMarker(localMarker))) {
        try {
          await this.putScopedRoster(LOCAL_PROFILE_ID, roster);
          await this.setUserDataMarker(localMarker, new Date().toISOString());
        } catch (error) {
          console.warn(`Could not copy legacy roster ${roster.id}; it will be retried`, error);
          continue;
        }
      }
      if (await this.getUserDataMarker(`${KEYS.MIGRATION}:server:roster:${roster.id}`)) continue;
      try {
        await apiRequest(`/rosters/${encodeURIComponent(roster.id)}`, {
          method: 'PUT', body: JSON.stringify(roster),
          headers: { 'x-depot-profile-id': LOCAL_PROFILE_ID }
        });
        await this.setUserDataMarker(`${KEYS.MIGRATION}:server:roster:${roster.id}`, new Date().toISOString());
        rosters++;
      } catch (error) {
        console.warn(`Could not migrate legacy roster ${roster.id}; it will be retried`, error);
      }
    }
    for (const collection of legacyCollections) {
      const localMarker = `${KEYS.MIGRATION}:local:collection:${collection.id}`;
      if (!(await this.getUserDataMarker(localMarker))) {
        try {
          await this.putScopedCollection(LOCAL_PROFILE_ID, collection);
          await this.setUserDataMarker(localMarker, new Date().toISOString());
        } catch (error) {
          console.warn(`Could not copy legacy collection ${collection.id}; it will be retried`, error);
          continue;
        }
      }
      if (await this.getUserDataMarker(`${KEYS.MIGRATION}:server:collection:${collection.id}`)) continue;
      try {
        await apiRequest(`/collections/${encodeURIComponent(collection.id)}`, {
          method: 'PUT', body: JSON.stringify(collection),
          headers: { 'x-depot-profile-id': LOCAL_PROFILE_ID }
        });
        await this.setUserDataMarker(`${KEYS.MIGRATION}:server:collection:${collection.id}`, new Date().toISOString());
        collections++;
      } catch (error) {
        console.warn(`Could not migrate legacy collection ${collection.id}; it will be retried`, error);
      }
    }
    // Copy key/value user data without deleting the legacy values. Each key is
    // independently checkpointed, so bookmarks and markers survive retries.
    for (const key of [KEYS.BOOKMARKS, KEYS.DATA_VERSION]) {
      if (await this.getUserDataMarker(`${KEYS.MIGRATION}:userData:${key}`)) continue;
      try {
        const legacy = await this.getUserDataValue(key);
        if (legacy !== undefined) await this.setScopedUserDataValue(LOCAL_PROFILE_ID, key, legacy);
        await this.setUserDataMarker(`${KEYS.MIGRATION}:userData:${key}`, new Date().toISOString());
      } catch (error) {
        console.warn(`Could not migrate legacy user data ${key}; it will be retried`, error);
      }
    }
    return { migrated: rosters === legacyRosters.length && collections === legacyCollections.length, rosters, collections };
  }

  private async getLegacyRosters(): Promise<depot.StoredRoster[]> {
    const store = await this.store(STORES.ROSTERS);
    return ((await req(store.getAll())) as depot.StoredRoster[] | undefined) ?? [];
  }

  private async getLegacyCollections(): Promise<depot.StoredCollection[]> {
    const store = await this.store(STORES.COLLECTIONS);
    return ((await req(store.getAll())) as depot.StoredCollection[] | undefined) ?? [];
  }

  private async putScopedRoster(profileId: string, roster: depot.StoredRoster): Promise<void> {
    const store = await this.scopedStore(STORES.SCOPED_ROSTERS, 'readwrite');
    await req(store.put({ ...roster, profileId }, scopedKey(profileId, roster.id)));
  }

  private async putScopedCollection(profileId: string, collection: depot.StoredCollection): Promise<void> {
    const store = await this.scopedStore(STORES.SCOPED_COLLECTIONS, 'readwrite');
    await req(store.put({ ...collection, profileId }, scopedKey(profileId, collection.id)));
  }

  private async getUserDataValue(key: string): Promise<unknown> {
    const store = await this.store(STORES.USER_DATA);
    return req(store.get(key));
  }

  private async setScopedUserDataValue(profileId: string, key: string, value: unknown): Promise<void> {
    const store = await this.scopedStore(STORES.SCOPED_USER_DATA, 'readwrite');
    await req(store.put(value, scopedKey(profileId, key)));
  }

  private async getUserDataMarker(key: string): Promise<string | null> {
    const store = await this.store(STORES.USER_DATA);
    return ((await req(store.get(key))) as string | undefined) ?? null;
  }

  private async setUserDataMarker(key: string, value: string): Promise<void> {
    const store = await this.store(STORES.USER_DATA, 'readwrite');
    await req(store.put(value, key));
  }

  // Database Management
  async clearFactionData(): Promise<void> {
    const db = await this.getDB();
    const stores = [STORES.FACTION_INDEX, STORES.FACTION_MANIFESTS, STORES.DATASHEETS];
    const transaction = db.transaction(stores, 'readwrite');
    await Promise.all(stores.map((storeName) => req(transaction.objectStore(storeName).clear())));
  }

  async destroy(): Promise<void> {
    // Close existing connections
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db.close();
      this.dbPromise = null;
    }

    // Delete the database
    const request = indexedDB.deleteDatabase(DB_CONFIG.NAME);

    // Some mocks may not return a real request; guard accordingly
    if (!request) {
      return;
    }

    await req(request);
  }
}

// Export a singleton instance
export const offlineStorage = new OfflineStorage();
