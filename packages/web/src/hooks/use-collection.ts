import { useCallback } from 'react';
import type { depot } from '@depot/core';
import { offlineStorage } from '@/data/offline-storage';
import { calculateCollectionPoints } from '@depot/core/utils/collection';
import { useFactionsContext } from '@/contexts/factions/context';
import { hydrateCollection } from '@/utils/refresh-user-data';
import useAsync from './use-async';

export const useCollection = (collectionId?: string) => {
  const { getDatasheet, getFactionManifest } = useFactionsContext();
  const { data, setData, loading, error } = useAsync(async () => {
    const stored = collectionId ? await offlineStorage.getCollection(collectionId) : null;
    return stored ? hydrateCollection(stored, { getDatasheet, getFactionManifest }) : null;
  }, [collectionId, getDatasheet, getFactionManifest]);

  const save = useCallback(
    async (updated: depot.Collection) => {
      const withPoints = {
        ...updated,
        dataVersion: updated.dataVersion ?? null,
        points: { current: calculateCollectionPoints(updated) }
      };
      // A rejected online write must not make a bulk action appear successful.
      // Network failures still retain the existing local-draft fallback.
      await offlineStorage.saveCollection(withPoints, { fallbackOnHttpError: false });
      setData(withPoints);
    },
    [setData]
  );

  return { collection: data ?? null, loading, error, save };
};

export default useCollection;
