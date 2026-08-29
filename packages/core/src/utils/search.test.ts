import { describe, expect, it } from 'vitest';
import { normalizeSearchText, rankSearch, searchItems } from './search.js';

const units = [
  { name: 'Trukk', faction: 'Orks', role: 'Transport' },
  { name: 'Battlewagon', faction: 'Orks', role: 'Transport' },
  { name: 'Boyz', faction: 'Orks', role: 'Battleline' },
  { name: 'Beast Snagga Boyz', faction: 'Orks', role: 'Battleline' },
  { name: 'Meganobz', faction: 'Orks', role: 'Infantry' },
  { name: 'Warboss', faction: 'Orks', role: 'Character' },
  { name: 'Deff Dread', faction: 'Orks', role: 'Walker' },
  { name: 'Gorkanaut', faction: 'Orks', role: 'Transport' }
];

describe('search', () => {
  it('normalizes case, punctuation, whitespace, hyphens, and apostrophes conservatively', () => {
    expect(normalizeSearchText("  Beast-Snagga's   Boyz! ")).toBe('beast snagga s boyz');
    expect(normalizeSearchText('MÉGANOBZ')).toBe('meganobz');
  });

  it('prioritizes exact and prefix matches before token and substring matches', () => {
    expect(searchItems(units, 'boyz').map((unit) => unit.name)).toEqual(['Boyz', 'Beast Snagga Boyz']);
    expect(searchItems(units, 'deff dredd')[0].name).toBe('Deff Dread');
    expect(searchItems(units, 'gork')).toEqual([{ name: 'Gorkanaut', faction: 'Orks', role: 'Transport' }]);
  });

  it('matches metadata after the primary name and supports safe plural forms', () => {
    expect(searchItems(units, 'battleline', { getMetadata: (unit) => ({ role: unit.role }) }).map((unit) => unit.name)).toEqual([
      'Beast Snagga Boyz',
      'Boyz'
    ]);
    expect(searchItems(units, 'meganob').map((unit) => unit.name)).toEqual(['Meganobz']);
  });

  it('uses controlled fuzzy fallback and deterministic tie breaks', () => {
    expect(searchItems(units, 'truk').map((unit) => unit.name)).toEqual(['Trukk']);
    expect(searchItems(units, 'ork', { getMetadata: (unit) => ({ faction: unit.faction }) }).map((unit) => unit.name)).toEqual(
      ['Battlewagon', 'Beast Snagga Boyz', 'Boyz', 'Deff Dread', 'Gorkanaut', 'Meganobz', 'Trukk', 'Warboss']
    );
    expect(rankSearch(units, 'transport', { getMetadata: (unit) => ({ role: unit.role }) }).map((result) => result.item.name)).toEqual([
      'Battlewagon',
      'Gorkanaut',
      'Trukk'
    ]);
  });
});
