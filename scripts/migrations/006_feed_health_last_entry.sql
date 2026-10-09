-- Migration 006: record the newest entry's publish time per feed.
--
-- A feed can freeze while still returning HTTP 200 with old items (VentureBeat
-- AI's Feedburner mirror did exactly this from 2026-09-03), which the
-- zero-entry counter in 005 can't see. fetch_and_build.py now also fails the
-- run when a feed's newest entry is older than FEED_STALE_HOURS, and stores
-- that timestamp here for inspection.
--
-- Optional: the script retries the upsert without this column if it's
-- missing, and staleness alerting works from in-memory data either way.
-- Run in the Supabase SQL Editor.

ALTER TABLE feed_health ADD COLUMN IF NOT EXISTS last_entry_at TIMESTAMPTZ;
