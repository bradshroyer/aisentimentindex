-- Migration: add scored_by column to headlines.
--
-- Preserves an audit trail of which scorer (and which Claude model version)
-- produced the stored `score`. Existing rows are left NULL — their origin is
-- unknown with certainty (the system has mixed VADER/Claude history), and
-- NULL is more honest than a guess.
--
-- Values written going forward:
--   'claude-haiku-4-5-20251001'  (or whatever CLAUDE_MODEL is set to)
--   'vader'                      (fallback path)

BEGIN;

ALTER TABLE headlines
  ADD COLUMN IF NOT EXISTS scored_by TEXT;

COMMIT;

-- Reverse:
-- BEGIN;
-- ALTER TABLE headlines DROP COLUMN scored_by;
-- COMMIT;
