CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (id, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Local user')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS rosters (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  faction_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collections (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  faction_id text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rosters_user_updated_idx ON rosters(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS collections_user_updated_idx ON collections(user_id, updated_at DESC);
