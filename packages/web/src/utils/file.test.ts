import { describe, expect, it } from 'vitest';
import { isoDate, isoTimestamp, sanitizeDownloadName } from './file';

describe('download filename helpers', () => {
  it('removes traversal and filesystem separators', () => {
    expect(sanitizeDownloadName('../my\\orks/:2026?.json')).toBe('my-orks--2026-.json');
  });

  it('uses a fallback for empty names', () => {
    expect(sanitizeDownloadName('...')).toBe('depot-backup');
  });

  it('creates stable date and timestamp components', () => {
    const date = new Date('2026-08-29T05:15:16.123Z');
    expect(isoDate(date)).toBe('2026-08-29');
    expect(isoTimestamp(date)).toBe('20260829T051516Z');
  });
});
