import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const port = Number(process.env.PORT ?? 8787);
const defaultUserId = process.env.DEPOT_USER_ID ?? '00000000-0000-0000-0000-000000000001';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const schemaVersion = 1;
const format = 'depot-user-data';

type Kind = 'rosters' | 'collections';
type Document = Record<string, unknown> & { id: string; name: string; factionId: string };
type Profile = { id: string; displayName: string; createdAt: string };
const profileCookie = 'depot_profile_id';
// Accept legacy/bootstrap UUIDs too (the local default is all zeroes); the
// database existence check is the authority for whether the profile exists.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
};
const text = (res: ServerResponse, status: number, body: string, headers: Record<string, string> = {}) => {
  res.writeHead(status, headers);
  res.end(body);
};

export const validateProfileName = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80) {
    throw new Error('displayName must be a nonblank string of at most 80 characters');
  }
  return value.trim();
};

const cookies = (req: IncomingMessage): Record<string, string> => Object.fromEntries(
  String(req.headers.cookie ?? '').split(';').map((part) => part.trim().split('='))
    .filter(([key, value]) => key && value).map(([key, ...value]) => {
      try { return [key, decodeURIComponent(value.join('='))]; } catch { return [key, '']; }
    })
);

const sameOrigin = (req: IncomingMessage): string | null => {
  const origin = req.headers.origin;
  if (!origin) return null;
  const expected = `${String(req.headers['x-forwarded-proto'] ?? 'http')}://${req.headers.host ?? 'localhost'}`;
  if (origin !== expected) throw Object.assign(new Error('request origin is not allowed'), { status: 403 });
  return origin;
};

async function requestProfile(req: IncomingMessage): Promise<string> {
  sameOrigin(req);
  const explicitHeader = req.headers['x-depot-profile-id'] !== undefined;
  const cookieId = cookies(req)[profileCookie];
  const requested = req.headers['x-depot-profile-id'] ?? cookieId ?? defaultUserId;
  const id = Array.isArray(requested) ? requested[0] : requested;
  if (!id || !uuidPattern.test(id)) throw Object.assign(new Error('invalid profile identity'), { status: 400 });
  const result = await pool.query('SELECT 1 FROM users WHERE id = $1', [id]);
  if (!result.rowCount) {
    if (!explicitHeader && cookieId) {
      const fallback = await pool.query('SELECT 1 FROM users WHERE id = $1', [defaultUserId]);
      if (fallback.rowCount) return defaultUserId;
    }
    throw Object.assign(new Error('profile not found'), { status: 404 });
  }
  return id;
}

async function profile(id: string): Promise<Profile> {
  const result = await pool.query('SELECT id, display_name, created_at FROM users WHERE id = $1', [id]);
  const row = result.rows[0];
  if (!row) throw Object.assign(new Error('profile not found'), { status: 404 });
  return { id: row.id, displayName: row.display_name, createdAt: new Date(row.created_at).toISOString() };
}

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

async function rows(kind: Kind, userId: string): Promise<Document[]> {
  const result = await pool.query(`SELECT document FROM ${kind} WHERE user_id = $1 ORDER BY updated_at DESC`, [userId]);
  return result.rows.map((row) => row.document as Document);
}

async function one(kind: Kind, id: string, userId: string): Promise<Document | null> {
  const result = await pool.query(`SELECT document FROM ${kind} WHERE user_id = $1 AND id = $2`, [userId, id]);
  return (result.rows[0]?.document as Document | undefined) ?? null;
}

async function put(client: PoolClient, kind: Kind, doc: Document, userId: string, conflict: 'replace' | 'create' = 'replace') {
  const table = kind;
  if (conflict === 'create') {
    const existing = await client.query(`SELECT 1 FROM ${table} WHERE user_id = $1 AND id = $2`, [userId, doc.id]);
    if (existing.rowCount) throw Object.assign(new Error('id already exists'), { status: 409 });
  }
  await client.query(
    `INSERT INTO ${table}(id,user_id,name,faction_id,schema_version,document) VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, id) DO UPDATE SET name=EXCLUDED.name,faction_id=EXCLUDED.faction_id,schema_version=EXCLUDED.schema_version,document=EXCLUDED.document,updated_at=now()
     WHERE ${table}.user_id = $2`,
    [doc.id, userId, doc.name, doc.factionId, schemaVersion, doc]
  );
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (req.method === 'OPTIONS') {
    const origin = sameOrigin(req);
    return json(res, 204, null, { ...(origin ? { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } : {}), 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type, x-depot-profile-id' });
  }
  if (url.pathname === '/health' || url.pathname === '/ready' || url.pathname === '/api/health' || url.pathname === '/api/ready') {
    try { await pool.query('SELECT 1'); return json(res, 200, { ok: true }); } catch { return json(res, 503, { ok: false }); }
  }
  if (url.pathname === '/api/profiles' && req.method === 'GET') {
    const activeId = await requestProfile(req);
    const result = await pool.query('SELECT id, display_name, created_at FROM users ORDER BY created_at, id');
    return json(res, 200, { profiles: result.rows.map((row) => ({ id: row.id, displayName: row.display_name, createdAt: new Date(row.created_at).toISOString() })), active: await profile(activeId), activeProfileId: activeId }, { 'cache-control': 'no-store' });
  }
  if (url.pathname === '/api/profiles/active' && req.method === 'GET') {
    return json(res, 200, await profile(await requestProfile(req)), { 'cache-control': 'no-store' });
  }
  if (url.pathname === '/api/profiles' && req.method === 'POST') {
    sameOrigin(req);
    const body = await readBody(req);
    const displayName = validateProfileName(body && typeof body === 'object' ? (body as Record<string, unknown>).displayName : undefined);
    const id = randomUUID();
    await pool.query('INSERT INTO users (id, display_name) VALUES ($1, $2)', [id, displayName]);
    res.setHeader('set-cookie', `${profileCookie}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax`);
    return json(res, 201, await profile(id), { 'cache-control': 'no-store' });
  }
  const profileMatch = url.pathname.match(/^\/api\/profiles\/([^/]+)(?:\/(select))?$/);
  if (profileMatch) {
    const id = profileMatch[1];
    if (!uuidPattern.test(id)) throw Object.assign(new Error('invalid profile identity'), { status: 400 });
    if (profileMatch[2] === 'select' && req.method === 'POST') {
      sameOrigin(req);
      await requestProfile({ ...req, headers: { ...req.headers, 'x-depot-profile-id': id } } as unknown as IncomingMessage);
      res.setHeader('set-cookie', `${profileCookie}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax`);
      return json(res, 200, await profile(id), { 'cache-control': 'no-store' });
    }
    if (!profileMatch[2] && req.method === 'PATCH') {
      const requester = await requestProfile(req);
      if (requester !== id) throw Object.assign(new Error('profile may only rename itself'), { status: 403 });
      const body = await readBody(req);
      const displayName = validateProfileName(body && typeof body === 'object' ? (body as Record<string, unknown>).displayName : undefined);
      const result = await pool.query('UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, display_name, created_at', [displayName, id]);
      if (!result.rowCount) throw Object.assign(new Error('profile not found'), { status: 404 });
      return json(res, 200, await profile(id), { 'cache-control': 'no-store' });
    }
  }
  const userId = await requestProfile(req);
  const match = url.pathname.match(/^\/api\/(rosters|collections)(?:\/([^/]+))?$/);
  if (match) {
    const kind = match[1] as Kind;
    const id = match[2];
    if (req.method === 'GET') return json(res, 200, id ? await one(kind, id, userId) : await rows(kind, userId));
    if (req.method === 'DELETE' && id) { await pool.query(`DELETE FROM ${kind} WHERE user_id=$1 AND id=$2`, [userId, id]); return json(res, 204, null); }
    if ((req.method === 'POST' && !id) || (req.method === 'PUT' && !!id)) {
      const doc = validateDocument(await readBody(req));
      if (id && id !== doc.id) throw new Error('path and document ids differ');
      const client = await pool.connect();
      try { await client.query('BEGIN'); await put(client, kind, doc, userId, req.method === 'POST' ? (url.searchParams.get('conflict') as 'replace' | 'create' ?? 'replace') : 'replace'); await client.query('COMMIT'); return json(res, 200, doc); }
      catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    }
  }
  if (url.pathname === '/api/export' && req.method === 'GET') return json(res, 200, bundle(await rows('rosters', userId), await rows('collections', userId)));
  const singleExport = url.pathname.match(/^\/api\/(rosters|collections)\/([^/]+)\/export(?:\.yaml)?$/);
  if (singleExport && req.method === 'GET') {
    const kind = singleExport[1] as Kind;
    const document = await one(kind, singleExport[2], userId);
    if (!document) return json(res, 404, { error: 'not found' });
    const payload = kind === 'rosters' ? bundle([document], []) : bundle([], [document]);
    if (url.pathname.endsWith('.yaml')) return text(res, 200, stringifyYaml(payload), { 'content-type': 'application/yaml; charset=utf-8' });
    return json(res, 200, payload);
  }
  if (url.pathname === '/api/import' && req.method === 'POST') {
    const raw = await readBody(req);
    const parsed = typeof raw === 'object' && raw && 'content' in raw ? (raw as { content: string; format?: string }) : raw;
    let source: unknown;
    try {
      source = typeof parsed === 'string'
        ? parseYaml(parsed, { schema: 'core' })
        : typeof parsed === 'object' && parsed && 'format' in parsed && (parsed as { format?: string }).format === 'yaml'
          ? parseYaml((parsed as unknown as { content: string }).content, { schema: 'core' })
          : parsed;
    } catch {
      throw new Error('invalid YAML backup');
    }
    if (!source || typeof source !== 'object' || (source as Record<string, unknown>).format !== format || (source as Record<string, unknown>).formatVersion !== schemaVersion) throw new Error('unsupported depot export format or version');
    const input = source as { rosters?: unknown; collections?: unknown };
    if (!Array.isArray(input.rosters) || !Array.isArray(input.collections)) throw new Error('export must contain rosters and collections arrays');
    const rosters = input.rosters.map(validateDocument); const collections = input.collections.map(validateDocument);
    const requestedPolicy = url.searchParams.get('conflict') ?? 'replace';
    if (requestedPolicy !== 'create' && requestedPolicy !== 'replace') throw new Error('conflict policy must be create or replace');
    const policy = requestedPolicy;
    const client = await pool.connect();
    try { await client.query('BEGIN'); for (const doc of rosters) await put(client, 'rosters', doc, userId, policy); for (const doc of collections) await put(client, 'collections', doc, userId, policy); await client.query('COMMIT'); return json(res, 200, { rosters: rosters.length, collections: collections.length }); }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  if (url.pathname === '/api/export.yaml' && req.method === 'GET') return text(res, 200, stringifyYaml(bundle(await rows('rosters', userId), await rows('collections', userId))), { 'content-type': 'application/yaml; charset=utf-8' });
  return json(res, 404, { error: 'not found' });
}

const ensureDefaultProfile = async () => {
  await pool.query(
    'INSERT INTO users (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    [defaultUserId, defaultUserId === '00000000-0000-0000-0000-000000000001' ? 'Local User' : 'Depot User']
  );
};

const server = createServer((req, res) => { void handle(req, res).catch((error: unknown) => json(res, Number((error as { status?: number }).status ?? 400), { error: error instanceof Error ? error.message : 'request failed' })); });
void ensureDefaultProfile().then(() => server.listen(port, '0.0.0.0', () => console.log(`Depot API listening on ${port}`))).catch((error) => { console.error('Unable to seed default profile', error); process.exitCode = 1; });

export { bundle, validateDocument };
