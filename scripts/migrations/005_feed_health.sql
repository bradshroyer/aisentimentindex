-- Migration 005: per-feed health tracking.
--
-- feedparser doesn't raise on HTTP errors — a dead feed just parses to zero
-- entries — so individual feed deaths were invisible until now (the workflow
-- alert only fires when the whole job fails). fetch_and_build.py records
-- consecutive zero-entry runs here and exits nonzero once a feed has been
-- dark for ~2 days, which fires the existing ingestion-failure issue.
--
-- The script tolerates this table being absent (prints a warning), so apply
-- whenever convenient. Run in the Supabase SQL Editor.

CREATE TABLE feed_health (
  source TEXT PRIMARY KEY,
  last_ok TIMESTAMPTZ,
  consecutive_failures INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE feed_health ENABLE ROW LEVEL SECURITY;

-- No policies: not publicly readable. Python writes with the service role
-- key, which bypasses RLS entirely.
