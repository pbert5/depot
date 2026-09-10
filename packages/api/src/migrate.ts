import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const here = dirname(fileURLToPath(import.meta.url));
const migrations = (await readdir(join(here, '../migrations')))
  .filter((file) => /^\d+_.+\.sql$/.test(file))
  .sort();
for (const migration of migrations) {
  await pool.query(await readFile(join(here, '../migrations', migration), 'utf8'));
}
await pool.end();
