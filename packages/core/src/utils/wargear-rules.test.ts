import { describe, expect, it } from 'vitest';
import { parseWargearRules } from './wargear-rules.js';
import { syntheticWargear, syntheticLoadouts } from './wargear-rules.fixture.js';

describe('parseWargearRules', () => {
  it('normalizes supported grammar families into persisted-choice references', () => {
    const result = parseWargearRules(syntheticLoadouts.supported, syntheticWargear);
    expect(result.diagnostics).toEqual([]);
    expect(result.rules.map(({ kind }) => kind)).toEqual([
      'replacement',
      'quantity',
      'choice-group',
      'prerequisite',
      'conflict'
    ]);
    expect(result.rules[0]).toMatchObject({
      kind: 'replacement',
      from: [{ id: 'fixture:basic-gun', name: 'Basic Gun' }],
      to: [{ id: 'fixture:upgraded-gun', name: 'Upgraded Gun' }],
      scope: { modelName: 'Sergeant' },
      provenance: { source: 'datasheet-loadout', clauseIndex: 0 }
    });
    expect(result.rules[1]).toMatchObject({ kind: 'quantity', max: 2, scope: { everyModels: 5 } });
    expect(result.rules[2]).toMatchObject({ kind: 'choice-group', choose: 1 });
  });

  it('reports unsupported prose and never emits a guessed rule', () => {
    const result = parseWargearRules(syntheticLoadouts.unsupported, syntheticWargear);
    expect(result.rules).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'unsupported-prose', clauseIndex: 0 }),
      expect.objectContaining({ code: 'unknown-wargear', clauseIndex: 1 })
    ]);
  });
});
