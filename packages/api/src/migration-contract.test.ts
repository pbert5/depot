import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrations = join(dirname(fileURLToPath(import.meta.url)), '../migrations');

test('profile migration preserves rows and scopes document identity per profile', async () => {
  const sql = await readFile(join(migrations, '002_profiles_and_scoped_documents.sql'), 'utf8');
  assert.match(sql, /DROP CONSTRAINT IF EXISTS rosters_pkey/);
  assert.match(sql, /PRIMARY KEY \(user_id, id\)/);
  assert.match(sql, /DROP CONSTRAINT IF EXISTS collections_pkey/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS rosters_id_idx/);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS collections_id_idx/);
  assert.doesNotMatch(sql, /DELETE\s+FROM/i);
});

test('migration runner discovers ordered SQL migrations', async () => {
  const source = await readFile(
    join(dirname(fileURLToPath(import.meta.url)), 'migrate.js'),
    'utf8'
  );
  assert.match(source, /readdir\(join\(here, '\.\.\/migrations'\)\)/);
  assert.match(source, /\.sort\(\)/);
});

test('profile kind migration backfills legacy users as main and constrains future values', async () => {
  const sql = await readFile(join(migrations, '003_profile_kinds.sql'), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS kind text/);
  assert.match(sql, /UPDATE users\s+SET kind = 'main'\s+WHERE kind IS NULL/i);
  assert.match(sql, /SET DEFAULT 'main'/i);
  assert.match(sql, /SET NOT NULL/i);
  assert.match(sql, /ADD CONSTRAINT users_kind_check/i);
  assert.match(sql, /CHECK \(kind IN \('main', 'e2e'\)\)/i);
  assert.doesNotMatch(sql, /DELETE\s+FROM/i);
});
