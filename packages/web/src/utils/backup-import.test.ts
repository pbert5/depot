import { getBackupFormat, getConflictIds, parseBackup } from './backup-import';

const valid = { format: 'depot-user-data', formatVersion: 1, rosters: [{ id: 'r1', name: 'Roster', factionId: 'f1' }], collections: [] };

describe('backup import validation', () => {
  it('parses JSON and YAML backups and reports their shape', () => {
    expect(parseBackup(JSON.stringify(valid), 'json').rosters).toHaveLength(1);
    expect(parseBackup('format: depot-user-data\nformatVersion: 1\nrosters:\n  - id: r1\n    name: Roster\n    factionId: f1\ncollections: []', 'yaml').collections).toEqual([]);
  });

  it('rejects unsupported versions, missing arrays, malformed documents, and unsafe tags', () => {
    expect(() => parseBackup(JSON.stringify({ ...valid, formatVersion: 2 }), 'json')).toThrow(/Unsupported/);
    expect(() => parseBackup(JSON.stringify({ ...valid, collections: undefined }), 'json')).toThrow(/collections/);
    expect(() => parseBackup(JSON.stringify({ ...valid, rosters: [{ id: 'r1' }] }), 'json')).toThrow(/name/);
    expect(() => parseBackup(JSON.stringify({ ...valid, collections: [{ id: 'r1', name: 'C', factionId: 'f1' }] }), 'json')).toThrow(/duplicate/i);
    expect(() => parseBackup('!!js/function >\n  alert(1)', 'yaml')).toThrow();
  });

  it('recognizes picker formats and counts IDs that would be replaced', () => {
    expect(getBackupFormat(new File(['{}'], 'backup.yml'))).toBe('yaml');
    expect(getBackupFormat(new File(['{}'], 'backup.json'))).toBe('json');
    expect(getConflictIds(parseBackup(JSON.stringify(valid), 'json'), new Set(['r1']))).toEqual(new Set(['r1']));
  });
});
