-- Migration: Fix overly permissive RLS policies
-- Run this in Supabase SQL Editor against the live database

-- 1. Drop overly permissive write policies on headlines and daily_scores
--    Service role bypasses RLS entirely, so these policies only opened
--    an unintended write hole for the anon role.
DROP POLICY IF EXISTS "Allow service role write on headlines" ON headlines;
DROP POLICY IF EXISTS "Allow service role write on daily_scores" ON daily_scores;

-- 2. Add column constraints to sponsor_inquiries (defense in depth)
ALTER TABLE sponsor_inquiries
  ALTER COLUMN email SET NOT NULL,
  ADD CONSTRAINT sponsor_inquiries_email_length CHECK (length(email) <= 320),
  ADD CONSTRAINT sponsor_inquiries_company_length CHECK (company IS NULL OR length(company) <= 200),
  ADD CONSTRAINT sponsor_inquiries_message_length CHECK (message IS NULL OR length(message) <= 5000);
