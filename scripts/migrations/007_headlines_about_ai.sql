-- Migration 007: Claude's relevance call per headline.
--
-- The RSS keyword filter lets through stories where AI is incidental (phone
-- reviews, buying guides, market wraps that mention AI once). The scorer now
-- also returns about_ai; rows marked false are kept for audit but left out of
-- daily_scores and hidden by the site. NULL = not judged (VADER fallback or
-- pre-migration rows) and counts as relevant.
-- Run in the Supabase SQL Editor before deploying the code that writes it.

ALTER TABLE headlines ADD COLUMN IF NOT EXISTS about_ai BOOLEAN;

-- Reverse:
-- ALTER TABLE headlines DROP COLUMN about_ai;
