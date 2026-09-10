import { describe, expect, it } from 'vitest';
import type { depot } from '@depot/core';
import { createWargearQuantityAdapter } from './wargear-quantity-adapter';

const syntheticWargear: depot.Wargear[] = ['Basic Gun', 'Heavy Tool'].map((name) => ({
  id: `fixture:${name.toLowerCase().replaceAll(' ', '-')}`,
  datasheetId: 'fixture-datasheet',
  line: '1',
  name,
  type: 'Mixed',
  profiles: []
}));

describe('createWargearQuantityAdapter', () => {
  it('derives exact group counts and blocks transitions at the parsed maximum', () => {
    const heavyTool = syntheticWargear.find((item) => item.name === 'Heavy Tool')!;
    const adapter = createWargearQuantityAdapter(
      'Every 5 models are equipped with: Heavy Tool, up to 2.',
      syntheticWargear,
      [heavyTool, heavyTool]
    );

    expect(adapter.controls.get(heavyTool.id)).toMatchObject({
      counted: true,
      quantity: 2,
      min: 1,
      max: 2,
      increaseDisabled: true,
      decreaseDisabled: false
    });
    expect(adapter.transition([heavyTool, heavyTool], heavyTool, 'increase')).toHaveLength(2);
    expect(adapter.transition([heavyTool, heavyTool], heavyTool, 'decrease')).toHaveLength(1);
  });

  it('preserves toggle behavior for unstructured entries', () => {
    const gun = syntheticWargear[0];
    const adapter = createWargearQuantityAdapter('', syntheticWargear, []);
    expect(adapter.transition([], gun, 'increase')).toEqual([gun]);
    expect(adapter.transition([gun], gun, 'decrease')).toEqual([]);
    expect(adapter.controls.has(gun.id)).toBe(false);
  });
});
