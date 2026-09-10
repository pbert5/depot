import { describe, expect, it, vi } from 'vitest';
import {
  mutateSelected,
  persistSelectedMutation,
  removeSelected,
  updateSelected
} from './bulk-mutations';

type Item = { id: string; state: 'new' | 'done' };

const items: Item[] = [
  { id: 'keep', state: 'new' },
  { id: 'update', state: 'new' },
  { id: 'remove', state: 'done' }
];

describe('bulk mutations', () => {
  it('updates selected items only', () => {
    const update = vi.fn((item: Item): Item => ({ ...item, state: 'done' }));

    const result = updateSelected(items, ['update'], update);

    expect(result).toEqual([
      { id: 'keep', state: 'new' },
      { id: 'update', state: 'done' },
      { id: 'remove', state: 'done' }
    ]);
    expect(update).toHaveBeenCalledTimes(1);
    expect(result[0]).toBe(items[0]);
    expect(result).not.toBe(items);
  });

  it('removes selected items only', () => {
    expect(removeSelected(items, new Set(['remove']))).toEqual([
      { id: 'keep', state: 'new' },
      { id: 'update', state: 'new' }
    ]);
  });

  it('persists a bulk mutation with one logical save', async () => {
    const save = vi.fn<(nextItems: Item[]) => Promise<void>>().mockResolvedValue(undefined);

    const result = await persistSelectedMutation(
      items,
      ['keep', 'update'],
      { update: (item): Item => ({ ...item, state: 'done' }) },
      save
    );

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith([
      { id: 'keep', state: 'done' },
      { id: 'update', state: 'done' },
      { id: 'remove', state: 'done' }
    ]);
    expect(result).toEqual(save.mock.calls[0][0]);
  });

  it('does not persist a partial result when the mutation fails', async () => {
    const save = vi.fn<(nextItems: Item[]) => Promise<void>>().mockResolvedValue(undefined);
    const failure = new Error('mutation failed');

    await expect(
      persistSelectedMutation(
        items,
        ['update', 'remove'],
        {
          update: (item) =>
            item.id === 'remove'
              ? (() => {
                  throw failure;
                })()
              : item
        },
        save
      )
    ).rejects.toBe(failure);

    expect(save).not.toHaveBeenCalled();
    expect(items).toEqual([
      { id: 'keep', state: 'new' },
      { id: 'update', state: 'new' },
      { id: 'remove', state: 'done' }
    ]);
  });

  it('supports remove through the same single-save path', async () => {
    const save = vi.fn<(nextItems: Item[]) => Promise<void>>().mockResolvedValue(undefined);

    await persistSelectedMutation(items, ['remove'], { remove: true }, save);

    expect(save).toHaveBeenCalledOnce();
    expect(mutateSelected(items, ['remove'], { remove: true })).toEqual([
      { id: 'keep', state: 'new' },
      { id: 'update', state: 'new' }
    ]);
  });
});
