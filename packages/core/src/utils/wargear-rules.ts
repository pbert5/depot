import type { Wargear } from '../types/depot.js';

export type WargearRuleKind =
  'replacement' | 'quantity' | 'choice-group' | 'prerequisite' | 'conflict';

export interface WargearChoice {
  id: string;
  name: string;
}

export interface WargearScope {
  modelName?: string;
  everyModels?: number;
  unitSize?: number;
}

export interface WargearRuleProvenance {
  source: 'datasheet-loadout';
  text: string;
  clause: string;
  clauseIndex: number;
}

export interface WargearRuleBase {
  kind: WargearRuleKind;
  scope?: WargearScope;
  provenance: WargearRuleProvenance;
}

export interface WargearReplacementRule extends WargearRuleBase {
  kind: 'replacement';
  from: WargearChoice[];
  to: WargearChoice[];
  max?: number;
}

export interface WargearQuantityRule extends WargearRuleBase {
  kind: 'quantity';
  choices: WargearChoice[];
  min?: number;
  max?: number;
}

export interface WargearChoiceGroupRule extends WargearRuleBase {
  kind: 'choice-group';
  choices: WargearChoice[];
  choose: number;
}

export interface WargearPrerequisiteRule extends WargearRuleBase {
  kind: 'prerequisite';
  choices: WargearChoice[];
  requires: WargearChoice[];
}

export interface WargearConflictRule extends WargearRuleBase {
  kind: 'conflict';
  choices: WargearChoice[];
  conflictsWith: WargearChoice[];
}

export type WargearRule =
  | WargearReplacementRule
  | WargearQuantityRule
  | WargearChoiceGroupRule
  | WargearPrerequisiteRule
  | WargearConflictRule;

export interface WargearRuleDiagnostic {
  code: 'unsupported-prose' | 'unknown-wargear';
  message: string;
  text: string;
  clause: string;
  clauseIndex: number;
}

export interface ParsedWargearRules {
  rules: WargearRule[];
  diagnostics: WargearRuleDiagnostic[];
}

export type EquipmentCounts = Readonly<Record<string, number>>;
export type EquipmentIssueCode =
  | WargearRuleDiagnostic['code']
  | 'below-minimum'
  | 'above-capacity'
  | 'choice-count'
  | 'replacement'
  | 'prerequisite'
  | 'conflict'
  | 'unknown-choice'
  | 'invalid-count'
  | 'invalid-model-size';

export interface EquipmentIssue {
  code: EquipmentIssueCode;
  message: string;
  choiceIds?: string[];
  rule?: WargearRuleProvenance;
}

export interface EquipmentActionState {
  current: number;
  capacity: number;
  canIncrement: boolean;
  canDecrement: boolean;
  reasonCode?: EquipmentIssueCode;
  reason?: string;
}

export interface EquipmentEvaluation {
  counts: EquipmentCounts;
  appliedChoices: WargearChoice[];
  issues: EquipmentIssue[];
  actions: Readonly<Record<string, EquipmentActionState>>;
  modelSize: number;
}

export interface EquipmentInput {
  wargear: Wargear[];
  selection?: EquipmentCounts | Wargear[];
  rules?: WargearRule[] | ParsedWargearRules;
  modelSize?: number;
  modelName?: string;
}

export interface EquipmentTransition extends EquipmentInput {
  action: { choiceId: string; delta: 1 | -1 } | { modelSize: number };
}

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const list = (value: string) =>
  value
    .split(/,|\s+or\s+|\s+and\s+/i)
    .map(clean)
    .map((name) => name.replace(/^(?:a|an|one)\s+/i, '').trim())
    .filter(Boolean);

const scopeFrom = (clause: string): WargearScope | undefined => {
  const scope: WargearScope = {};
  const model = clause.match(/(?:the|a|each)\s+([^,;]+?)\s+model\b/i);
  if (model?.[1]) scope.modelName = clean(model[1]);
  const every = clause.match(/every\s+(\d+)\s+models?/i);
  if (every?.[1]) scope.everyModels = Number(every[1]);
  const size = clause.match(/(?:unit of|units? of)\s+(\d+)\s+models?/i);
  if (size?.[1]) scope.unitSize = Number(size[1]);
  return Object.keys(scope).length ? scope : undefined;
};

const resolve = (
  names: string[],
  available: Map<string, Wargear>,
  diagnostics: WargearRuleDiagnostic[],
  text: string,
  clause: string,
  clauseIndex: number
): WargearChoice[] => {
  const resolved = names.flatMap((name) => {
    const weapon = available.get(name.toLocaleLowerCase());
    if (!weapon) {
      diagnostics.push({
        code: 'unknown-wargear',
        message: `Wargear “${name}” is not present in the datasheet catalogue.`,
        text,
        clause,
        clauseIndex
      });
      return [];
    }
    return [{ id: weapon.id, name: weapon.name }];
  });
  return resolved.length === names.length ? resolved : [];
};

const provenance = (text: string, clause: string, clauseIndex: number): WargearRuleProvenance => ({
  source: 'datasheet-loadout',
  text,
  clause,
  clauseIndex
});

/**
 * Parses only the documented, fixture-backed loadout grammar. The result is
 * intentionally an IR: it records constraints for a later evaluator and does
 * not decide whether a persisted selection is legal.
 */
export function parseWargearRules(loadout: string, wargear: Wargear[]): ParsedWargearRules {
  const rules: WargearRule[] = [];
  const diagnostics: WargearRuleDiagnostic[] = [];
  const available = new Map(wargear.map((weapon) => [weapon.name.toLocaleLowerCase(), weapon]));
  const clauses = loadout
    .split(/[.;]\s*/)
    .map(clean)
    .filter(Boolean);

  clauses.forEach((clause, clauseIndex) => {
    const source = provenance(loadout, clause, clauseIndex);
    let match: RegExpMatchArray | null;

    match = clause.match(
      /^(?:(?:for\s+)?every\s+\d+\s+models?|(?:every\s+)?models?)\s+(?:is|are)\s+equipped with:\s*(.+)$/i
    );
    if (match?.[1]) {
      const max = match[1].match(/,?\s*(?:up to|max(?:imum)?|no more than)\s+(\d+)\s*$/i)?.[1];
      const names = match[1].replace(/,?\s*(?:up to|max(?:imum)?|no more than)\s+\d+\s*$/i, '');
      const choices = resolve(list(names), available, diagnostics, loadout, clause, clauseIndex);
      if (choices.length)
        rules.push({
          kind: 'quantity',
          choices,
          min: 1,
          max: max ? Number(max) : undefined,
          scope: scopeFrom(clause),
          provenance: source
        });
      return;
    }

    match = clause.match(/^(.*?)\s+can replace\s+(.+?)\s+with\s+(.+)$/i);
    if (match?.[1] && match[2] && match[3]) {
      const from = resolve(list(match[2]), available, diagnostics, loadout, clause, clauseIndex);
      const to = resolve(list(match[3]), available, diagnostics, loadout, clause, clauseIndex);
      const max = clause.match(/(?:up to|max(?:imum)?|no more than)\s+(\d+)/i)?.[1];
      if (from.length && to.length)
        rules.push({
          kind: 'replacement',
          from,
          to,
          max: max ? Number(max) : undefined,
          scope: scopeFrom(match[1]),
          provenance: source
        });
      return;
    }

    match = clause.match(
      /^(?:take|choose|select)\s+(?:up to\s+)?(\d+)\s+of\s+the following:\s*(.+)$/i
    );
    if (match?.[1] && match[2]) {
      const choices = resolve(list(match[2]), available, diagnostics, loadout, clause, clauseIndex);
      if (choices.length)
        rules.push({
          kind: 'choice-group',
          choices,
          choose: Number(match[1]),
          scope: scopeFrom(clause),
          provenance: source
        });
      return;
    }

    match = clause.match(/^(.+?)\s+(?:requires|only if)\s+(.+)$/i);
    if (match?.[1] && match[2]) {
      const choices = resolve(list(match[1]), available, diagnostics, loadout, clause, clauseIndex);
      const requires = resolve(
        list(match[2]),
        available,
        diagnostics,
        loadout,
        clause,
        clauseIndex
      );
      if (choices.length && requires.length)
        rules.push({
          kind: 'prerequisite',
          choices,
          requires,
          scope: scopeFrom(clause),
          provenance: source
        });
      return;
    }

    match = clause.match(
      /^(.+?)\s+(?:cannot be taken with|conflicts with|may not be combined with)\s+(.+)$/i
    );
    if (match?.[1] && match[2]) {
      const choices = resolve(list(match[1]), available, diagnostics, loadout, clause, clauseIndex);
      const conflictsWith = resolve(
        list(match[2]),
        available,
        diagnostics,
        loadout,
        clause,
        clauseIndex
      );
      if (choices.length && conflictsWith.length)
        rules.push({
          kind: 'conflict',
          choices,
          conflictsWith,
          scope: scopeFrom(clause),
          provenance: source
        });
      return;
    }

    match = clause.match(/^(?:up to|max(?:imum)?|no more than)\s+(\d+)\s+(.+)$/i);
    if (match?.[1] && match[2]) {
      const choices = resolve(list(match[2]), available, diagnostics, loadout, clause, clauseIndex);
      if (choices.length)
        rules.push({
          kind: 'quantity',
          choices,
          max: Number(match[1]),
          scope: scopeFrom(clause),
          provenance: source
        });
      return;
    }

    diagnostics.push({
      code: 'unsupported-prose',
      message: 'This loadout clause is outside the supported wargear grammar.',
      text: loadout,
      clause,
      clauseIndex
    });
  });

  return { rules, diagnostics };
}

const asRules = (
  rules: EquipmentInput['rules']
): { rules: WargearRule[]; diagnostics: WargearRuleDiagnostic[] } =>
  Array.isArray(rules) ? { rules, diagnostics: [] } : (rules ?? { rules: [], diagnostics: [] });

const countsFrom = (selection: EquipmentInput['selection']): Record<string, number> => {
  if (!selection) return {};
  if (!Array.isArray(selection)) return { ...selection };
  return selection.reduce<Record<string, number>>((counts, item) => {
    counts[item.id] = (counts[item.id] ?? 0) + 1;
    return counts;
  }, {});
};

const names = (choices: WargearChoice[]) => choices.map((choice) => choice.name).join(', ');
const total = (counts: Record<string, number>, choices: WargearChoice[]) =>
  choices.reduce((sum, choice) => sum + (counts[choice.id] ?? 0), 0);
const applies = (rule: WargearRule, input: EquipmentInput, modelSize: number) => {
  const scope = rule.scope;
  return (
    (!scope?.modelName ||
      !input.modelName ||
      scope.modelName.toLocaleLowerCase() === input.modelName.toLocaleLowerCase()) &&
    (!scope?.unitSize || scope.unitSize === modelSize) &&
    (!scope?.everyModels || modelSize >= scope.everyModels)
  );
};

const issue = (code: EquipmentIssueCode, message: string, rule?: WargearRule): EquipmentIssue => ({
  code,
  message,
  ...(rule ? { rule: rule.provenance } : {})
});

const evaluateCounts = (
  input: EquipmentInput,
  counts: Record<string, number>,
  modelSize: number,
  includeActions: boolean
): EquipmentEvaluation => {
  const available = new Map(input.wargear.map((item) => [item.id, item]));
  const parsed = asRules(input.rules);
  const structured = parsed.rules.length > 0 || parsed.diagnostics.length > 0;
  const issues: EquipmentIssue[] = parsed.diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    message: diagnostic.message
  }));

  for (const [id, count] of Object.entries(counts)) {
    if (!available.has(id))
      issues.push(issue('unknown-choice', `Wargear “${id}” is not available.`));
    if (!Number.isInteger(count) || count < 0)
      issues.push(issue('invalid-count', `Count for “${id}” must be a non-negative integer.`));
  }

  const rules = parsed.rules.filter((rule) => applies(rule, input, modelSize));
  const quantities = new Map<string, number>();
  for (const rule of rules) {
    if (rule.kind === 'quantity') {
      const capacity =
        rule.max === undefined
          ? Math.floor(modelSize / (rule.scope?.everyModels ?? 1))
          : rule.max *
            (rule.scope?.everyModels ? Math.floor(modelSize / rule.scope.everyModels) : 1);
      const current = total(counts, rule.choices);
      for (const choice of rule.choices)
        quantities.set(choice.id, Math.min(quantities.get(choice.id) ?? Infinity, capacity));
      if (rule.min !== undefined && current < rule.min)
        issues.push(
          issue(
            'below-minimum',
            `At least ${rule.min} of ${names(rule.choices)} must be selected.`,
            rule
          )
        );
      if (current > capacity)
        issues.push(
          issue(
            'above-capacity',
            `At most ${capacity} of ${names(rule.choices)} may be selected.`,
            rule
          )
        );
    } else if (rule.kind === 'replacement') {
      const current = total(counts, [...rule.from, ...rule.to]);
      const capacity = rule.max ?? 1;
      for (const choice of [...rule.from, ...rule.to])
        quantities.set(choice.id, Math.min(quantities.get(choice.id) ?? Infinity, capacity));
      if (current > capacity)
        issues.push(
          issue(
            'replacement',
            `Only ${capacity} replacement${capacity === 1 ? '' : 's'} may be applied.`,
            rule
          )
        );
    } else if (rule.kind === 'choice-group') {
      const current = total(counts, rule.choices);
      for (const choice of rule.choices)
        quantities.set(choice.id, Math.min(quantities.get(choice.id) ?? Infinity, 1));
      if (current !== rule.choose)
        issues.push(
          issue('choice-count', `Choose exactly ${rule.choose} of ${names(rule.choices)}.`, rule)
        );
    } else if (
      rule.kind === 'prerequisite' &&
      total(counts, rule.choices) > 0 &&
      total(counts, rule.requires) === 0
    ) {
      issues.push(
        issue('prerequisite', `${names(rule.choices)} requires ${names(rule.requires)}.`, rule)
      );
    } else if (
      rule.kind === 'conflict' &&
      total(counts, rule.choices) > 0 &&
      total(counts, rule.conflictsWith) > 0
    ) {
      issues.push(
        issue(
          'conflict',
          `${names(rule.choices)} cannot be combined with ${names(rule.conflictsWith)}.`,
          rule
        )
      );
    }
  }

  const appliedChoices = input.wargear
    .filter((item) => (counts[item.id] ?? 0) > 0)
    .map((item) => ({ id: item.id, name: item.name }));
  const actions: Record<string, EquipmentActionState> = {};
  if (includeActions) {
    for (const item of input.wargear) {
      const current = counts[item.id] ?? 0;
      const capacity = structured ? (quantities.get(item.id) ?? 0) : 1;
      const test = (delta: 1 | -1) => {
        const candidate = { ...counts, [item.id]: Math.max(0, current + delta) };
        const result = evaluateCounts(
          { ...input, selection: candidate },
          candidate,
          modelSize,
          false
        );
        return result.issues[0];
      };
      const upIssue =
        current >= capacity
          ? issue(
              'above-capacity',
              structured ? 'This choice is at capacity.' : 'Legacy wargear is already selected.'
            )
          : test(1);
      const downIssue =
        current <= 0 ? issue('invalid-count', 'This choice is not selected.') : test(-1);
      actions[item.id] = {
        current,
        capacity,
        canIncrement: !upIssue,
        canDecrement: !downIssue,
        ...(upIssue && { reasonCode: upIssue.code, reason: upIssue.message })
      };
    }
  }
  return { counts: { ...counts }, appliedChoices, issues, actions, modelSize };
};

/** Evaluates a count-based equipment selection without mutating its input. */
export function evaluateEquipment(input: EquipmentInput): EquipmentEvaluation {
  const modelSize = input.modelSize ?? 1;
  return evaluateCounts(input, countsFrom(input.selection), modelSize, true);
}

/** Applies one equipment or model-size action only when the resulting state is legal. */
export function transitionEquipment(
  input: EquipmentTransition
): EquipmentEvaluation & { accepted: boolean } {
  const before = evaluateEquipment(input);
  let nextSize = before.modelSize;
  let nextCounts = { ...before.counts };
  if ('modelSize' in input.action) nextSize = input.action.modelSize;
  else
    nextCounts[input.action.choiceId] = Math.max(
      0,
      (nextCounts[input.action.choiceId] ?? 0) + input.action.delta
    );
  if (!Number.isInteger(nextSize) || nextSize < 1) {
    return {
      ...before,
      accepted: false,
      issues: [
        ...before.issues,
        issue('invalid-model-size', 'Model size must be a positive integer.')
      ]
    };
  }
  const after = evaluateCounts(
    { ...input, selection: nextCounts, modelSize: nextSize },
    nextCounts,
    nextSize,
    true
  );
  if (after.issues.length > 0)
    return {
      ...before,
      accepted: false,
      issues: [
        ...after.issues,
        issue('invalid-model-size', 'This transition would leave the unit with invalid equipment.')
      ]
    };
  return { ...after, accepted: true };
}
