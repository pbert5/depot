import type { Wargear } from '../types/depot.js';

export const syntheticWargear: Wargear[] = [
  'Basic Gun',
  'Upgraded Gun',
  'Special Blade',
  'Shield',
  'Heavy Tool'
].map((name) => ({
  id: `fixture:${name.toLocaleLowerCase().replaceAll(' ', '-')}`,
  datasheetId: 'fixture-datasheet',
  line: '1',
  name,
  type: 'Mixed',
  profiles: []
}));

export const syntheticLoadouts = {
  supported:
    'The Sergeant model can replace Basic Gun with Upgraded Gun. Every 5 models are equipped with: Heavy Tool, up to 2. Choose 1 of the following: Special Blade or Shield. Special Blade requires Shield. Heavy Tool cannot be taken with Shield.',
  unsupported: 'The unit benefits from a special battlefield rule. Up to 1 Imaginary Relic'
};
