-- Classify existing and new profiles without changing users or documents.
ALTER TABLE users ADD COLUMN IF NOT EXISTS kind text;
UPDATE users
SET kind = 'e2e'
WHERE kind IS NULL
  AND (
    display_name ~ '^E2E chromium-desktop worker [0-9]+$'
    OR display_name ~ '^E2E chromium-mobile-390 worker [0-9]+$'
    OR display_name ~ '^E2E chromium-narrow-360 worker [0-9]+$'
    OR display_name = 'E2E isolation proof other worker'
  );
UPDATE users SET kind = 'main' WHERE kind IS NULL;
ALTER TABLE users ALTER COLUMN kind SET DEFAULT 'main';
ALTER TABLE users ALTER COLUMN kind SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_kind_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_kind_check CHECK (kind IN ('main', 'e2e'));
  END IF;
END $$;
