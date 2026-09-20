import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useCollectionUnitSelection from './use-collection-unit-selection';

describe('useCollectionUnitSelection', () => {
  it('toggles and clears selected collection units', () => {
    const { result } = renderHook(() => useCollectionUnitSelection());

    act(() => result.current.toggle('unit-1'));
    expect(result.current.selectedIds).toEqual(new Set(['unit-1']));
    expect(result.current.selectedCount).toBe(1);

    act(() => result.current.toggle('unit-1'));
    expect(result.current.selectedCount).toBe(0);

    act(() => {
      result.current.toggle('unit-1');
      result.current.toggle('unit-2');
      result.current.clear();
    });
    expect(result.current.selectedIds).toEqual(new Set());
  });

  it('keeps selections across filtered views and prunes removed units', () => {
    const { result } = renderHook(() => useCollectionUnitSelection());

    act(() => {
      result.current.toggle('unit-1');
      result.current.toggle('unit-2');
      result.current.prune(['unit-1']);
    });

    expect(result.current.selectedIds).toEqual(new Set(['unit-1']));
  });
});
