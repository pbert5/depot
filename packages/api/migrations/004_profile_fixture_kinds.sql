-- Repair profiles classified by 003 before the repository fixture backfill existed.
-- Restrict this to the exact repository-owned fixture identities and leave all
-- other main profiles unchanged.
UPDATE users
SET kind = 'e2e'
WHERE kind = 'main'
  AND (
    display_name ~ '^E2E chromium-desktop worker [0-9]+$'
    OR display_name ~ '^E2E chromium-mobile-390 worker [0-9]+$'
    OR display_name ~ '^E2E chromium-narrow-360 worker [0-9]+$'
    OR display_name = 'E2E isolation proof other worker'
  );
