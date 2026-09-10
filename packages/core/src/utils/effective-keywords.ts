import type { Datasheet, DetachmentAbility, Keyword } from '../types/depot.js';

export interface KeywordGrant {
  targetKeyword: string;
  grantedKeyword: string;
  sourceAbilityId?: string;
  sourceText?: string;
}

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const stripMarkup = (value: string): string =>
  value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

/** Parse only explicit unit-keyword grants; uncertain prose produces no grant. */
export const parseKeywordGrants = (description: string, sourceAbilityId?: string): KeywordGrant[] => {
  const text = stripMarkup(description).toLocaleUpperCase();
  const grants: KeywordGrant[] = [];
  const pattern = /(?:GAIN|HAVE|BECOME|ARE TREATED AS HAVING)\s+(?:THE\s+)?([A-Z][A-Z0-9 -]{1,40}?)(?:\s+KEYWORD)?(?=\b|[.,;])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const prefix = text.slice(0, match.index);
    const target = prefix.match(/(?:ALL|ANY|FRIENDLY|YOUR)?\s*([A-Z][A-Z0-9 '&-]{1,48}?)\s+UNITS?\b[^.]{0,120}$/);
    const targetKeyword = target?.[1]?.replace(/\b(?:ALL|ANY|FRIENDLY|YOUR)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const grantedKeyword = match[1].trim();
    if (targetKeyword && grantedKeyword) grants.push({ targetKeyword, grantedKeyword, sourceAbilityId, sourceText: description });
  }
  return grants;
};

export const getDetachmentKeywordGrants = (
  abilities: Pick<DetachmentAbility, 'id' | 'description' | 'keywordGrants'>[]
): KeywordGrant[] => abilities.flatMap((ability) =>
  ability.keywordGrants?.length
    ? ability.keywordGrants.map((grant) => ({ ...grant, sourceAbilityId: grant.sourceAbilityId ?? ability.id, sourceText: grant.sourceText ?? ability.description }))
    : parseKeywordGrants(ability.description, ability.id)
);

export const getEffectiveKeywords = (
  datasheet: Pick<Datasheet, 'keywords'>,
  abilities: Pick<DetachmentAbility, 'id' | 'description' | 'keywordGrants'>[] = []
): Keyword[] => {
  const effective = new Map<string, Keyword>();
  datasheet.keywords.forEach((keyword) => effective.set(normalize(keyword.keyword), keyword));
  for (const grant of getDetachmentKeywordGrants(abilities)) {
    if (!effective.has(normalize(grant.targetKeyword))) continue;
    const key = normalize(grant.grantedKeyword);
    if (!effective.has(key)) effective.set(key, { datasheetId: datasheet.keywords[0]?.datasheetId ?? '', keyword: grant.grantedKeyword, model: '', isFactionKeyword: 'false' });
  }
  return [...effective.values()];
};
