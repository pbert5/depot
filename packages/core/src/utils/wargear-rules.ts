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
