/** A deliberately small, framework-independent search result. */
export interface SearchResult<T> {
  item: T;
  score: number;
}

export interface SearchOptions<T> {
  /** Text used as the primary field. Defaults to `item.name` when present. */
  getText?: (item: T) => string;
  /** Additional, lower-priority fields such as faction or role labels. */
  getMetadata?: (item: T) => Record<string, unknown> | undefined;
  /** Stable identity used for the final tie break. */
  getKey?: (item: T, index: number) => string;
  limit?: number;
}

const METADATA_WEIGHT = 0.72;

/** Converts display text into comparable search text while retaining word boundaries. */
export const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const tokens = (value: string): string[] => normalizeSearchText(value).split(' ').filter(Boolean);

// Only remove ordinary plural endings, and protect words where the final `s` is
// clearly part of the stem (e.g. `boss`, `gas`, or `us`).
const pluralForms = (token: string): string[] => {
  const forms = new Set([token]);
  if (token.length > 3 && token.endsWith('ies')) forms.add(`${token.slice(0, -3)}y`);
  if (token.length > 4 && token.endsWith('es')) forms.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) forms.add(token.slice(0, -1));
  return [...forms];
};

const hasEquivalentToken = (left: string, right: string): boolean =>
  pluralForms(left).some((form) => pluralForms(right).includes(form));

const editDistance = (left: string, right: string): number => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = left[i - 1] === right[j - 1] ? diagonal : 1 + Math.min(diagonal, above, row[j - 1]);
      diagonal = above;
    }
  }
  return row[right.length];
};

const metadataText = (metadata: Record<string, unknown> | undefined): string[] => {
  if (!metadata) return [];
  const values: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') values.push(String(value));
    else if (Array.isArray(value)) value.forEach(visit);
  };
  Object.values(metadata).forEach(visit);
  return values;
};

const fieldScore = (query: string, field: string, allowFuzzy: boolean): number => {
  const normalized = normalizeSearchText(field);
  if (!normalized) return 0;
  if (normalized === query) return 1000;
  if (normalized.startsWith(query)) return 800;

  const queryTokens = tokens(query);
  const fieldTokens = tokens(normalized);
  let score = 0;
  for (const queryToken of queryTokens) {
    const equivalent = fieldTokens.some((fieldToken) => hasEquivalentToken(queryToken, fieldToken));
    const prefix = fieldTokens.some((fieldToken) =>
      pluralForms(fieldToken).some((form) => form.startsWith(queryToken))
    );
    if (equivalent) score += 760;
    else if (prefix) score += 680;
    else if (normalized.includes(queryToken)) score += 560;
    else if (allowFuzzy) {
      const distance = Math.min(...fieldTokens.map((fieldToken) => editDistance(queryToken, fieldToken)));
      const threshold = queryToken.length <= 5 ? 1 : 2;
      if (distance <= threshold) score += 300 - distance * 40;
    }
  }
  return score / queryTokens.length;
};

const defaultText = <T>(item: T): string => {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object' && 'name' in item && typeof item.name === 'string') return item.name;
  return String(item);
};

/** Rank items without imposing any domain or faction-specific knowledge. */
export const rankSearch = <T>(items: readonly T[], query: string, options: SearchOptions<T> = {}): SearchResult<T>[] => {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return items.map((item) => ({ item, score: 0 }));

  const queryTokens = tokens(normalizedQuery);
  const text = options.getText ?? defaultText;
  const ranked = items.flatMap((item, index) => {
    const primary = text(item);
    const metadata = metadataText(options.getMetadata?.(item));
    const fields = [primary, ...metadata];
    const direct = fields.some((field) => fieldScore(normalizedQuery, field, false) > 0);
    const score = fields.reduce(
      (sum, field, fieldIndex) => sum + fieldScore(normalizedQuery, field, !direct) * (fieldIndex === 0 ? 1 : METADATA_WEIGHT),
      0
    );
    const matchedTokens = queryTokens.every((token) =>
      fields.some((field) => fieldScore(token, field, false) > 0 || fieldScore(token, field, true) > 0)
    );
    if (score === 0 || (!matchedTokens && !direct)) return [];
    return [{ item, score, index, key: normalizeSearchText(options.getKey?.(item, index) ?? primary) }];
  });

  ranked.sort((left, right) => right.score - left.score || left.key.localeCompare(right.key) || left.index - right.index);
  const limit = options.limit === undefined ? ranked.length : Math.max(0, options.limit);
  return ranked.slice(0, limit).map(({ item, score }) => ({ item, score }));
};

/** Convenience form for callers that only need the ordered items. */
export const searchItems = <T>(items: readonly T[], query: string, options: SearchOptions<T> = {}): T[] =>
  rankSearch(items, query, options).map(({ item }) => item);
