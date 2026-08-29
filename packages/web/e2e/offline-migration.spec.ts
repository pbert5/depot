import { test, expect, type Page, type Route } from '@playwright/test';

const DB_NAME = 'depot-offline';
const DB_VERSION = 11;
const MIGRATION_KEY = 'server-migration-v1';

const roster = {
  id: 'migration-roster-11111111',
  name: 'Preseeded Migration Roster',
  factionId: 'space-marines',
  factionSlug: 'space-marines',
  faction: {
    id: 'space-marines',
    slug: 'space-marines',
    name: 'Space Marines',
    path: '/data/space-marines.json'
  },
  dataVersion: null,
  detachments: [],
  points: { current: 0, max: 1000 },
  warlordUnitId: null,
  units: [],
  enhancements: [],
  collectionId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const collection = {
  id: 'migration-collection-22222222',
  name: 'Preseeded Migration Collection',
  factionId: 'space-marines',
  factionSlug: 'space-marines',
  faction: {
    id: 'space-marines',
    slug: 'space-marines',
    name: 'Space Marines',
    path: '/data/space-marines.json'
  },
  dataVersion: null,
  items: [],
  points: { current: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

type StoredDocuments = {
  rosters: typeof roster[];
  collections: typeof collection[];
};

const deleteDatabase = (page: Page) =>
  page.evaluate(
    (name) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
      }),
    DB_NAME
  );

const seedV11 = (page: Page) =>
  page.evaluate(
    ({ name, version, seededRoster, seededCollection }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name, version);
        request.onupgradeneeded = () => {
          const db = request.result;
          for (const storeName of [
            'factionIndex',
            'factionManifests',
            'datasheets',
            'settings',
            'userData'
          ]) {
            if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
          }
          if (!db.objectStoreNames.contains('rosters')) {
            db.createObjectStore('rosters', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('collections')) {
            db.createObjectStore('collections', { keyPath: 'id' });
          }
          request.transaction!.objectStore('rosters').put(seededRoster);
          request.transaction!.objectStore('collections').put(seededCollection);
        };
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
        request.onerror = () => reject(request.error);
      }),
    { name: DB_NAME, version: DB_VERSION, seededRoster: roster, seededCollection: collection }
  );

const readClientState = (page: Page) =>
  page.evaluate(
    ({ name, markerKey }) =>
      new Promise<{
        version: number;
        roster: unknown;
        collection: unknown;
        marker: unknown;
      }>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['rosters', 'collections', 'userData']);
          const rosterRequest = transaction.objectStore('rosters').get('migration-roster-11111111');
          const collectionRequest = transaction
            .objectStore('collections')
            .get('migration-collection-22222222');
          const markerRequest = transaction.objectStore('userData').get(markerKey);
          transaction.oncomplete = () => {
            db.close();
            resolve({
              version: db.version,
              roster: rosterRequest.result,
              collection: collectionRequest.result,
              marker: markerRequest.result
            });
          };
          transaction.onerror = () => reject(transaction.error);
        };
      }),
    { name: DB_NAME, markerKey: MIGRATION_KEY }
  );

const installApi = async (page: Page, options: { failFirstPut?: boolean } = {}) => {
  const remote: StoredDocuments = { rosters: [], collections: [] };
  const puts: { path: string; body: unknown }[] = [];
  let failedFirstPut = false;

  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const match = url.pathname.match(/^\/api\/(rosters|collections)(?:\/([^/]+))?$/);
    if (!match) {
      await route.fulfill({ status: 404, body: '{}' });
      return;
    }

    const kind = match[1] as keyof StoredDocuments;
    const id = match[2];
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          id ? remote[kind].find((item) => item.id === id) ?? null : remote[kind]
        )
      });
      return;
    }

    if (request.method() === 'PUT' && id) {
      const body = request.postDataJSON();
      puts.push({ path: url.pathname, body });
      if (options.failFirstPut && !failedFirstPut) {
        failedFirstPut = true;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"temporary outage"}'
        });
        return;
      }
      remote[kind] = [...remote[kind].filter((item) => item.id !== id), body] as never;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body)
      });
      return;
    }

    await route.fulfill({ status: 405, body: '{}' });
  });

  return { remote, puts };
};

const prepareSeededPage = async (page: Page) => {
  await page.goto('/favicon.ico');
  await deleteDatabase(page);
  await seedV11(page);
  await page.reload();
};

test.describe('IndexedDB server migration', () => {
  test(
    'migrates v11 roster and collection, displays them, preserves sources, and is idempotent',
    async ({ page }) => {
      const api = await installApi(page);
      await prepareSeededPage(page);

      await page.goto('/rosters');
      await expect.poll(() => api.puts.length).toBe(2);
      await page.reload();
      await expect(page.getByTestId('roster-card')).toContainText(roster.name);
      await page.goto('/collections');
      await expect(page.getByTestId(`collection-card-${collection.id}`)).toContainText(
        collection.name
      );

      expect(api.puts).toEqual([
        { path: `/api/rosters/${roster.id}`, body: roster },
        { path: `/api/collections/${collection.id}`, body: collection }
      ]);
      const migratedState = await readClientState(page);
      expect(migratedState.version).toBe(DB_VERSION);
      expect(migratedState.roster).toEqual(roster);
      expect(migratedState.collection).toEqual(collection);
      expect(migratedState.marker).toEqual(expect.any(String));

      const putCount = api.puts.length;
      await page.reload();
      await expect(page.getByTestId(`collection-card-${collection.id}`)).toContainText(
        collection.name
      );
      expect(api.puts).toHaveLength(putCount);
      expect(await readClientState(page)).toMatchObject({
        roster,
        collection,
        version: DB_VERSION
      });
    }
  );

  test(
    'keeps v11 sources and leaves migration retryable after an API failure',
    async ({ page }) => {
      const api = await installApi(page, { failFirstPut: true });
      await prepareSeededPage(page);

      await page.goto('/rosters');
      await expect(page.getByTestId('empty-rosters')).toBeVisible();
      await expect.poll(() => api.puts.length).toBe(1);
      const failedState = await readClientState(page);
      expect(failedState.version).toBe(DB_VERSION);
      expect(failedState.roster).toEqual(roster);
      expect(failedState.collection).toEqual(collection);
      expect(failedState.marker).toBeUndefined();
      expect(api.puts).toHaveLength(1);

      await page.reload();
      await expect.poll(() => api.puts.length).toBe(3);
      await page.reload();
      await expect(page.getByTestId('roster-card')).toContainText(roster.name);
      await expect(page.getByTestId(`collection-card-${collection.id}`)).toContainText(
        collection.name
      );
      expect(api.puts).toHaveLength(3);
      expect(api.puts.slice(1)).toEqual([
        { path: `/api/rosters/${roster.id}`, body: roster },
        { path: `/api/collections/${collection.id}`, body: collection }
      ]);
      expect((await readClientState(page)).marker).toEqual(expect.any(String));
    }
  );
});
