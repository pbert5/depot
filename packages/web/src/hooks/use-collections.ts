import type { depot } from '@depot/core';
import { useEffect } from 'react';

import { offlineStorage } from '@/data/offline-storage';
import { useFactionsContext } from '@/contexts/factions/context';
import { hydrateCollection } from '@/utils/refresh-user-data';
import useAsync from './use-async';

export const useCollections = (): {
  collections: depot.Collection[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} => {
  const { getDatasheet, getFactionManifest } = useFactionsContext();
  const { data, loading, error, refresh } = useAsync(async () => {
    const stored = await offlineStorage.getCollections();
    return Promise.all(
      stored.map((collection) =>
        hydrateCollection(collection, { getDatasheet, getFactionManifest })
      )
    );
  }, [getDatasheet, getFactionManifest]);
  useEffect(() => {
    const handleChange = () => void refresh();
    window.addEventListener('depot:user-data-changed', handleChange);
    return () => window.removeEventListener('depot:user-data-changed', handleChange);
  }, [refresh]);
  return { collections: data ?? [], loading, error, refresh };
};

export default useCollections;
