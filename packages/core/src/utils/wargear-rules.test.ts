import { describe, expect, it } from 'vitest';
import { evaluateEquipment, parseWargearRules, transitionEquipment } from './wargear-rules.js';
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

describe('equipment evaluator', () => {
  const rules = parseWargearRules(syntheticLoadouts.supported, syntheticWargear);
  const id = (name: string) => `fixture:${name.toLocaleLowerCase().replaceAll(' ', '-')}`;

  it('derives counts, applied choices, capacities, and prerequisite/conflict issues', () => {
    const result = evaluateEquipment({
      wargear: syntheticWargear,
      rules,
      modelSize: 5,
      modelName: 'Sergeant',
      selection: { [id('Basic Gun')]: 1, [id('Heavy Tool')]: 2, [id('Special Blade')]: 1 }
    });
    expect(result.counts[id('Heavy Tool')]).toBe(2);
    expect(result.appliedChoices.map(({ name }) => name)).toContain('Special Blade');
    expect(result.actions[id('Heavy Tool')]).toMatchObject({
      current: 2,
      capacity: 2,
      canIncrement: false
    });
    expect(result.issues.map(({ code }) => code)).toContain('prerequisite');
  });

  it('keeps legacy selections as free one-per-item toggles without structured rules', () => {
    const result = evaluateEquipment({
      wargear: syntheticWargear,
      selection: [syntheticWargear[0]]
    });
    expect(result.issues).toEqual([]);
    expect(result.actions[id('Basic Gun')]).toMatchObject({
      current: 1,
      capacity: 1,
      canIncrement: false,
      canDecrement: true
    });
    expect(result.actions[id('Shield')]).toMatchObject({
      current: 0,
      capacity: 1,
      canIncrement: true
    });
  });

  it('fails closed for parser diagnostics and rejects a model-size shrink that breaks capacity', () => {
    const unsupported = parseWargearRules(syntheticLoadouts.unsupported, syntheticWargear);
    expect(
      evaluateEquipment({ wargear: syntheticWargear, rules: unsupported }).issues[0].code
    ).toBe('unsupported-prose');
    const result = transitionEquipment({
      wargear: syntheticWargear,
      rules,
      modelSize: 10,
      selection: { [id('Heavy Tool')]: 2 },
      action: { modelSize: 4 }
    });
    expect(result.accepted).toBe(false);
    expect(result.modelSize).toBe(10);
    expect(result.counts[id('Heavy Tool')]).toBe(2);
  });

  it('applies a legal increment immutably', () => {
    const input = {
      wargear: syntheticWargear,
      rules: rules.rules.filter((rule) => rule.kind === 'quantity'),
      modelSize: 5,
      selection: { [id('Heavy Tool')]: 1 }
    };
    const result = transitionEquipment({
      ...input,
      action: { choiceId: id('Heavy Tool'), delta: 1 }
    });
    expect(result.accepted).toBe(true);
    expect(result.counts[id('Heavy Tool')]).toBe(2);
    expect(input.selection[id('Heavy Tool')]).toBe(1);
  });
});
