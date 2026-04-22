-- Migration: add title_normalized to headlines, dedupe, swap UNIQUE constraint.
--
-- Background: duplicates that differ only by smart-quote / en-dash / em-dash
-- slip past UNIQUE(title, source, date). The frontend was doing an in-memory
-- dedupe on every page load. This migration moves dedup to write time.
--
-- Normalization rules (must match lib/data.ts and scripts.fetch_and_build.normalize_text):
--   U+2018 U+2019 U+201A U+201B  ->  '
--   U+201C U+201D U+201E U+201F  ->  "
--   U+2013                       ->  -
--   U+2014                       ->  --
--   then trim()
--
-- Run this in the Supabase SQL Editor. Each step is idempotent where
-- possible so a partial run can be re-tried.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. IMMUTABLE normalization function (shared with the generated column).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION normalize_title(t text) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $func$
  SELECT trim(
    replace(
      translate(
        t,
        U&'\2018\2019\201A\201B\201C\201D\201E\201F\2013',
        $$''''""""-$$
      ),
      U&'\2014',
      '--'
    )
  )
$func$;

-- ---------------------------------------------------------------------------
-- 2. Add the generated column. Postgres auto-populates it for every row.
-- ---------------------------------------------------------------------------
ALTER TABLE headlines
  ADD COLUMN IF NOT EXISTS title_normalized TEXT
  GENERATED ALWAYS AS (normalize_title(title)) STORED;

-- ---------------------------------------------------------------------------
-- 3. Report duplicates (run this separately before the DELETE to sanity-check).
--
-- SELECT count(*) AS duplicate_rows FROM headlines h
-- WHERE EXISTS (
--   SELECT 1 FROM headlines h2
--   WHERE h2.title_normalized = h.title_normalized
--     AND h2.source = h.source
--     AND h2.date = h.date
--     AND (h2.timestamp < h.timestamp
--          OR (h2.timestamp = h.timestamp AND h2.id < h.id))
-- );
--
-- SELECT count(*) AS total_rows FROM headlines;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 4. Delete duplicates, keeping the earliest row per (title_normalized, source, date).
--    Tie-break on id so the choice is deterministic.
-- ---------------------------------------------------------------------------
DELETE FROM headlines h
USING headlines h2
WHERE h.title_normalized = h2.title_normalized
  AND h.source = h2.source
  AND h.date = h2.date
  AND (h2.timestamp < h.timestamp
       OR (h2.timestamp = h.timestamp AND h2.id < h.id));

-- ---------------------------------------------------------------------------
-- 5. Swap the UNIQUE constraint.
--    Supabase autogenerates the old constraint name as
--    headlines_title_source_date_key.
-- ---------------------------------------------------------------------------
ALTER TABLE headlines
  DROP CONSTRAINT IF EXISTS headlines_title_source_date_key;

ALTER TABLE headlines
  ADD CONSTRAINT headlines_title_normalized_source_date_key
  UNIQUE (title_normalized, source, date);

COMMIT;

-- ---------------------------------------------------------------------------
-- Reverse (reversible for schema; deleted rows are not recoverable):
--
-- BEGIN;
-- ALTER TABLE headlines DROP CONSTRAINT headlines_title_normalized_source_date_key;
-- ALTER TABLE headlines ADD CONSTRAINT headlines_title_source_date_key
--   UNIQUE (title, source, date);
-- ALTER TABLE headlines DROP COLUMN title_normalized;
-- DROP FUNCTION normalize_title(text);
-- COMMIT;
-- ---------------------------------------------------------------------------
