export type ItemWithId = { id: string };

export type SelectedMutation<T> = {
  update?: (item: T) => T;
  remove?: boolean;
};

const selectedIdSet = (ids: ReadonlySet<string> | readonly string[]): ReadonlySet<string> =>
  ids instanceof Set ? ids : new Set(ids);

/** Return a new list with the updater applied only to selected items. */
export const updateSelected = <T extends ItemWithId>(
  items: readonly T[],
  selectedIds: ReadonlySet<string> | readonly string[],
  update: (item: T) => T
): T[] => {
  const selected = selectedIdSet(selectedIds);
  return items.map((item) => (selected.has(item.id) ? update(item) : item));
};

/** Return a new list with selected items removed. */
export const removeSelected = <T extends ItemWithId>(
  items: readonly T[],
  selectedIds: ReadonlySet<string> | readonly string[]
): T[] => {
  const selected = selectedIdSet(selectedIds);
  return items.filter((item) => !selected.has(item.id));
};

/** Apply one selected-item mutation without changing the input list. */
export const mutateSelected = <T extends ItemWithId>(
  items: readonly T[],
  selectedIds: ReadonlySet<string> | readonly string[],
  mutation: SelectedMutation<T>
): T[] => {
  if (mutation.remove) return removeSelected(items, selectedIds);
  if (mutation.update) return updateSelected(items, selectedIds, mutation.update);
  return [...items];
};

/**
 * Apply a selected-item mutation and persist the complete result once.
 *
 * The mutation is evaluated before save is called, so a failed updater leaves
 * persistence untouched and cannot expose a partially-mutated list.
 */
export const persistSelectedMutation = async <T extends ItemWithId>(
  items: readonly T[],
  selectedIds: ReadonlySet<string> | readonly string[],
  mutation: SelectedMutation<T>,
  save: (items: T[]) => Promise<void>
): Promise<T[]> => {
  const nextItems = mutateSelected(items, selectedIds, mutation);
  await save(nextItems);
  return nextItems;
};
