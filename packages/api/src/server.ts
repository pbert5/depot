import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Pool, type PoolClient } from 'pg';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const port = Number(process.env.PORT ?? 8787);
const userId = process.env.DEPOT_USER_ID ?? '00000000-0000-0000-0000-000000000001';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schemaVersion = 1;
const format = 'depot-user-data';

type Kind = 'rosters' | 'collections';
type Document = Record<string, unknown> & { id: string; name: string; factionId: string };

const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
};
const text = (res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) => {
  res.writeHead(status, headers);
  res.end(body);
};

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (body.length > 10_000_000) throw new Error('request too large');
  const contentType = String(req.headers['content-type'] ?? '');
  return contentType.includes('yaml') || contentType.includes('yml') ? body : JSON.parse(body || '{}');
};

const validateDocument = (value: unknown): Document => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('document must be an object');
  const doc = value as Record<string, unknown>;
  if (typeof doc.id !== 'string' || typeof doc.name !== 'string' || typeof doc.factionId !== 'string') {
    throw new Error('document requires string id, name and factionId');
  }
  return doc as Document;
};

const bundle = (rosters: Document[], collections: Document[]) => ({
  format,
  formatVersion: schemaVersion,
  exportedAt: new Date().toISOString(),
  source: { app: 'depot', appVersion: process.env.DEPOT_APP_VERSION ?? 'unknown' },
  rosters,
  collections,
  crusades: [],
  metadata: { schemaVersion }
});

async function rows(kind: Kind): Promise<Document[]> {
  const result = await pool.query(`SELECT document FROM ${kind} WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]);
  return result.rows.map((row) => row.document as Document);
}

async function one(kind: Kind, id: string): Promise<Document | null> {
  const result = await pool.query(`SELECT document FROM ${kind} WHERE user_id = $1 AND id = $2`, [userId, id]);
  return (result.rows[0]?.document as Document | undefined) ?? null;
}

async function put(client: PoolClient, kind: Kind, doc: Document, conflict: 'replace' | 'create' = 'replace') {
  const table = kind;
  if (conflict === 'create') {
    const existing = await client.query(`SELECT 1 FROM ${table} WHERE user_id = $1 AND id = $2`, [userId, doc.id]);
    if (existing.rowCount) throw Object.assign(new Error('id already exists'), { status: 409 });
  }
  await client.query(
    `INSERT INTO ${table}(id,user_id,name,faction_id,schema_version,document) VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,faction_id=EXCLUDED.faction_id,schema_version=EXCLUDED.schema_version,document=EXCLUDED.document,updated_at=now()
     WHERE ${table}.user_id = $2`,
    [doc.id, userId, doc.name, doc.factionId, schemaVersion, doc]
  );
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'OPTIONS') return json(res, 204, null, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' });
  if (url.pathname === '/health' || url.pathname === '/ready' || url.pathname === '/api/health' || url.pathname === '/api/ready') {
    try { await pool.query('SELECT 1'); return json(res, 200, { ok: true }); } catch { return json(res, 503, { ok: false }); }
  }
  const match = url.pathname.match(/^\/api\/(rosters|collections)(?:\/([^/]+))?$/);
  if (match) {
    const kind = match[1] as Kind;
    const id = match[2];
    if (req.method === 'GET') return json(res, 200, id ? await one(kind, id) : await rows(kind));
    if (req.method === 'DELETE' && id) { await pool.query(`DELETE FROM ${kind} WHERE user_id=$1 AND id=$2`, [userId, id]); return json(res, 204, null); }
    if ((req.method === 'POST' && !id) || (req.method === 'PUT' && !!id)) {
      const doc = validateDocument(await readBody(req));
      if (id && id !== doc.id) throw new Error('path and document ids differ');
      const client = await pool.connect();
      try { await client.query('BEGIN'); await put(client, kind, doc, req.method === 'POST' ? (url.searchParams.get('conflict') as 'replace' | 'create' ?? 'replace') : 'replace'); await client.query('COMMIT'); return json(res, 200, doc); }
      catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
  }
  if (url.pathname === '/api/export' && req.method === 'GET') return json(res, 200, bundle(await rows('rosters'), await rows('collections')));
  const singleExport = url.pathname.match(/^\/api\/(rosters|collections)\/([^/]+)\/export(?:\.yaml)?$/);
  if (singleExport && req.method === 'GET') {
    const kind = singleExport[1] as Kind;
    const document = await one(kind, singleExport[2]);
    if (!document) return json(res, 404, { error: 'not found' });
    const payload = kind === 'rosters' ? bundle([document], []) : bundle([], [document]);
    if (url.pathname.endsWith('.yaml')) return text(res, 200, stringifyYaml(payload), { 'content-type': 'application/yaml; charset=utf-8' });
    return json(res, 200, payload);
  }
  if (url.pathname === '/api/import' && req.method === 'POST') {
    const raw = await readBody(req);
    const parsed = typeof raw === 'object' && raw && 'content' in raw ? (raw as { content: string; format?: string }) : raw;
    const source = typeof parsed === 'string' ? parseYaml(parsed, { schema: 'core' }) : typeof parsed === 'object' && parsed && 'format' in parsed && (parsed as { format?: string }).format === 'yaml' ? parseYaml((parsed as unknown as { content: string }).content, { schema: 'core' }) : parsed;
    if (!source || typeof source !== 'object' || (source as Record<string, unknown>).format !== format || (source as Record<string, unknown>).formatVersion !== schemaVersion) throw new Error('unsupported depot export format or version');
    const input = source as { rosters?: unknown; collections?: unknown };
    if (!Array.isArray(input.rosters) || !Array.isArray(input.collections)) throw new Error('export must contain rosters and collections arrays');
    const rosters = input.rosters.map(validateDocument); const collections = input.collections.map(validateDocument);
    const requestedPolicy = url.searchParams.get('conflict') ?? 'replace';
    if (requestedPolicy !== 'create' && requestedPolicy !== 'replace') throw new Error('conflict policy must be create or replace');
    const policy = requestedPolicy;
    const client = await pool.connect();
    try { await client.query('BEGIN'); for (const doc of rosters) await put(client, 'rosters', doc, policy); for (const doc of collections) await put(client, 'collections', doc, policy); await client.query('COMMIT'); return json(res, 200, { rosters: rosters.length, collections: collections.length }); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  if (url.pathname === '/api/export.yaml' && req.method === 'GET') return text(res, 200, stringifyYaml(bundle(await rows('rosters'), await rows('collections'))), { 'content-type': 'application/yaml; charset=utf-8' });
  return json(res, 404, { error: 'not found' });
}

const server = createServer((req, res) => { void handle(req, res).catch((error: unknown) => json(res, Number((error as { status?: number }).status ?? 400), { error: error instanceof Error ? error.message : 'request failed' })); });
server.listen(port, '0.0.0.0', () => console.log(`Depot API listening on ${port}`));

export { bundle, validateDocument };
