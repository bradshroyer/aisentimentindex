-- Migration: speed up paginated headline fetch
-- Run this in Supabase SQL Editor against the live database.
--
-- Frontend queries filter by date >= cutoff and order by timestamp DESC.
-- The existing single-column (date) index forces a re-sort on timestamp;
-- a composite index lets the planner serve the ordered page directly.

CREATE INDEX IF NOT EXISTS idx_headlines_date_timestamp
  ON headlines(date, timestamp DESC);
