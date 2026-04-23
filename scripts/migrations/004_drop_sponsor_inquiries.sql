-- Migration: drop sponsor_inquiries.
--
-- The sponsor page was removed in commit 0d6f489. The table and its open
-- anonymous INSERT policy have persisted unused in the schema since then.
-- No UI writes to it and nothing reads from it.
--
-- Run in the Supabase SQL Editor. Review any existing rows before running:
--   SELECT count(*), max(created_at) FROM sponsor_inquiries;
-- If there is retained contact data you want to preserve, export it first.

BEGIN;

DROP POLICY IF EXISTS "Allow anonymous inserts on sponsor_inquiries"
  ON sponsor_inquiries;

DROP TABLE IF EXISTS sponsor_inquiries;

COMMIT;
