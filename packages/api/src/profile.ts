export type ProfileKind = 'main' | 'e2e';

export type Profile = { id: string; displayName: string; createdAt: string; kind: ProfileKind };

export const validateProfileKind = (value: unknown): ProfileKind => {
  if (value === undefined || value === null || value === '') return 'main';
  if (value !== 'main' && value !== 'e2e') throw new Error('kind must be main or e2e');
  return value;
};

export const profileFromRow = (row: {
  id: string;
  display_name: string;
  created_at: string | Date;
  kind?: unknown;
}): Profile => ({
  id: row.id,
  displayName: row.display_name,
  createdAt: new Date(row.created_at).toISOString(),
  kind: validateProfileKind(row.kind)
});

export const profilesFromRows = (rows: Parameters<typeof profileFromRow>[0][]): Profile[] =>
  rows.map(profileFromRow);
