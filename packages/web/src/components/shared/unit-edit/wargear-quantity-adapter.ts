import type { depot } from '@depot/core';
import { parseWargearRules } from '@depot/core/utils/wargear';

export type WargearQuantityAction = 'increase' | 'decrease';

export interface WargearQuantityControl {
  counted: boolean;
  quantity: number;
  min: number;
  max?: number;
  groupIds: string[];
  increaseDisabled: boolean;
  decreaseDisabled: boolean;
  increaseReason?: string;
  decreaseReason?: string;
}

export interface WargearQuantityAdapter {
  controls: Map<string, WargearQuantityControl>;
  transition: (
    selected: depot.Wargear[],
    wargear: depot.Wargear,
    action: WargearQuantityAction
  ) => depot.Wargear[];
}

const countOf = (selected: depot.Wargear[], id: string) =>
  selected.reduce((count, item) => count + (item.id === id ? 1 : 0), 0);

const totalOf = (selected: depot.Wargear[], ids: string[]) =>
  selected.reduce((count, item) => count + (ids.includes(item.id) ? 1 : 0), 0);

/**
 * UI-only bridge for the current core rule IR. Keep this pure so it can be
 * replaced by the core evaluator/transition API without moving legality into
 * React. Rules the parser cannot prove are intentionally left as toggles.
 */
export const createWargearQuantityAdapter = (
  loadout: string | undefined,
  wargear: depot.Wargear[],
  selected: depot.Wargear[]
): WargearQuantityAdapter => {
  const parsed = loadout ? parseWargearRules(loadout, wargear) : { rules: [], diagnostics: [] };
  const constraints = new Map<string, { ids: string[]; min: number; max?: number }>();

  parsed.rules.forEach((rule) => {
    if (rule.kind !== 'quantity' && rule.kind !== 'choice-group') return;
    const ids = rule.choices.map((choice) => choice.id);
    const current = constraints.get(ids[0]);
    const min = rule.kind === 'quantity' ? (rule.min ?? 0) : 0;
    const max = rule.kind === 'quantity' ? rule.max : rule.choose;
    if (!current) {
      ids.forEach((id) => constraints.set(id, { ids, min, max }));
      return;
    }
    ids.forEach((id) =>
      constraints.set(id, {
        ids: current.ids,
        min: Math.max(current.min, min),
        max:
          current.max === undefined || max === undefined
            ? (current.max ?? max)
            : Math.min(current.max, max)
      })
    );
  });

  const controls = new Map<string, WargearQuantityControl>();
  constraints.forEach((constraint, id) => {
    const quantity = countOf(selected, id);
    const groupQuantity = totalOf(selected, constraint.ids);
    const atMin = groupQuantity <= constraint.min && quantity === 0;
    const atMax = constraint.max !== undefined && groupQuantity >= constraint.max;
    controls.set(id, {
      counted: true,
      quantity,
      min: constraint.min,
      max: constraint.max,
      groupIds: constraint.ids,
      increaseDisabled: atMax,
      decreaseDisabled: quantity === 0 || atMin,
      increaseReason: atMax
        ? `Maximum ${constraint.max} allowed for this option group.`
        : undefined,
      decreaseReason:
        quantity === 0
          ? 'This option is not selected.'
          : atMin
            ? `At least ${constraint.min} is required for this option group.`
            : undefined
    });
  });

  return {
    controls,
    transition: (current, weapon, action) => {
      const constraint = constraints.get(weapon.id);
      if (!constraint) {
        const selectedNow = current.some((item) => item.id === weapon.id);
        return selectedNow ? current.filter((item) => item.id !== weapon.id) : [...current, weapon];
      }
      const groupQuantity = totalOf(current, constraint.ids);
      if (action === 'increase') {
        if (constraint.max !== undefined && groupQuantity >= constraint.max) return current;
        return [...current, weapon];
      }
      const index = current.findIndex((item) => item.id === weapon.id);
      if (index < 0 || (groupQuantity <= constraint.min && countOf(current, weapon.id) <= 1)) {
        return current;
      }
      return current.filter((_, itemIndex) => itemIndex !== index);
    }
  };
};
