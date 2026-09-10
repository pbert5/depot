-- Profiles are the existing users records. Keep the bootstrap user and all
-- existing documents; only change document identity from global to per-user.
ALTER TABLE rosters DROP CONSTRAINT IF EXISTS rosters_pkey;
ALTER TABLE rosters ADD CONSTRAINT rosters_pkey PRIMARY KEY (user_id, id);

ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_pkey;
ALTER TABLE collections ADD CONSTRAINT collections_pkey PRIMARY KEY (user_id, id);

CREATE INDEX IF NOT EXISTS rosters_id_idx ON rosters(id);
CREATE INDEX IF NOT EXISTS collections_id_idx ON collections(id);
