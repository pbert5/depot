import assert from 'node:assert/strict';
import test from 'node:test';
import { profileFromRow, profilesFromRows, validateProfileKind } from './profile.js';

const row = {
  id: 'profile-id',
  display_name: 'League night',
  created_at: '2026-01-02T00:00:00.000Z'
};

test('legacy profile rows without kind are classified as main', () => {
  assert.equal(profileFromRow(row).kind, 'main');
});

test('normal profile creation kind defaults to main', () => {
  assert.equal(validateProfileKind(undefined), 'main');
});

test('explicit e2e profile creation retains e2e classification', () => {
  assert.equal(validateProfileKind('e2e'), 'e2e');
  assert.equal(profileFromRow({ ...row, kind: 'e2e' }).kind, 'e2e');
});

test('profile lists include the persisted kind', () => {
  assert.deepEqual(
    profilesFromRows([row, { ...row, id: 'e2e-profile', kind: 'e2e' }]).map(
      (profile) => profile.kind
    ),
    ['main', 'e2e']
  );
});

test('only supported profile kinds are accepted', () => {
  assert.throws(() => validateProfileKind('fixture'), /kind/);
});

test('selection and rename profile responses preserve kind', () => {
  const selected = profileFromRow({ ...row, kind: 'e2e' });
  const renamed = profileFromRow({ ...row, display_name: 'Renamed', kind: selected.kind });
  assert.equal(selected.kind, 'e2e');
  assert.equal(renamed.kind, 'e2e');
});
