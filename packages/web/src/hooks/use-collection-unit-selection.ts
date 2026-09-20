import { useCallback, useState } from 'react';

interface CollectionUnitSelection {
  selectedIds: Set<string>;
  selectedCount: number;
  toggle: (unitId: string) => void;
  clear: () => void;
  prune: (unitIds: Iterable<string>) => void;
}

/**
 * Selection for the collection roster builder.
 *
 * Filtering the browser must not discard a selected unit: a search or settings
 * transition can temporarily hide it. `prune` is only for units removed from
 * the collection itself.
 */
export const useCollectionUnitSelection = (): CollectionUnitSelection => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((unitId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const prune = useCallback((unitIds: Iterable<string>) => {
    const availableIds = new Set(unitIds);
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((unitId) => availableIds.has(unitId)));
      return next.size === previous.size ? previous : next;
    });
  }, []);

  return { selectedIds, selectedCount: selectedIds.size, toggle, clear, prune };
};

export default useCollectionUnitSelection;
