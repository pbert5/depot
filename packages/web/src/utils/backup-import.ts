import { parse as parseYaml } from 'yaml';

export type BackupFormat = 'json' | 'yaml';
export type ConflictPolicy = 'create' | 'replace';

export interface BackupDocument {
  id: string;
  name: string;
  factionId: string;
  [key: string]: unknown;
}

export interface BackupBundle {
  format: 'depot-user-data';
  formatVersion: 1;
  rosters: BackupDocument[];
  collections: BackupDocument[];
  [key: string]: unknown;
}

export interface BackupPreview {
  bundle: BackupBundle;
  format: BackupFormat;
  version: number;
  rosters: number;
  collections: number;
  conflicts: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const documents = (value: unknown, label: string): BackupDocument[] => {
  if (!Array.isArray(value)) throw new Error(`The backup is missing a ${label} array.`);
  return value.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id || typeof entry.name !== 'string' || !entry.name || typeof entry.factionId !== 'string' || !entry.factionId) {
      throw new Error(`${label} item ${index + 1} must have an id, name, and factionId.`);
    }
    return entry as BackupDocument;
  });
};

export const parseBackup = (content: string, format: BackupFormat): BackupBundle => {
  let value: unknown;
  try {
    value = format === 'yaml' ? parseYaml(content, { schema: 'core' }) : JSON.parse(content);
  } catch {
    throw new Error(`Could not parse this ${format.toUpperCase()} backup.`);
  }
  if (!isRecord(value) || value.format !== 'depot-user-data' || value.formatVersion !== 1) {
    throw new Error('Unsupported Depot backup format or version.');
  }
  const rosters = documents(value.rosters, 'rosters');
  const collections = documents(value.collections, 'collections');
  const ids = new Set<string>();
  for (const document of [...rosters, ...collections]) {
    if (ids.has(document.id)) throw new Error(`The backup contains duplicate ID "${document.id}".`);
    ids.add(document.id);
  }
  return { ...value, format: 'depot-user-data', formatVersion: 1, rosters, collections } as BackupBundle;
};

export const getBackupFormat = (file: File): BackupFormat | null => {
  const name = file.name.toLowerCase();
  if (name.endsWith('.yaml') || name.endsWith('.yml') || file.type.includes('yaml')) return 'yaml';
  if (name.endsWith('.json') || file.type.includes('json')) return 'json';
  return null;
};

export const getConflictIds = (bundle: BackupBundle, existingIds: Set<string>): Set<string> => {
  const ids = new Set<string>();
  [...bundle.rosters, ...bundle.collections].forEach((document) => {
    if (existingIds.has(document.id)) ids.add(document.id);
  });
  return ids;
};
