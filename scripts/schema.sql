-- Run this in Supabase SQL Editor to create the tables.
-- For existing databases, apply migrations in scripts/migrations/ instead.

-- Normalize curly quotes, en/em dashes, then trim. Must stay in sync with
-- normalize_text() in scripts/fetch_and_build.py.
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

CREATE TABLE headlines (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  title_normalized TEXT GENERATED ALWAYS AS (normalize_title(title)) STORED,
  summary TEXT,
  url TEXT,
  source TEXT NOT NULL,
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  score_raw FLOAT NOT NULL,
  score FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(title_normalized, source, date)
);

CREATE TABLE daily_scores (
  date DATE PRIMARY KEY,
  mean FLOAT NOT NULL,
  count INT NOT NULL,
  pos INT NOT NULL,
  neg INT NOT NULL,
  neu INT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  by_source JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE sponsor_inquiries (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL CHECK (length(email) <= 320),
  company TEXT CHECK (company IS NULL OR length(company) <= 200),
  message TEXT CHECK (message IS NULL OR length(message) <= 5000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_headlines_date ON headlines(date);
CREATE INDEX idx_headlines_source ON headlines(source);
CREATE INDEX idx_headlines_date_source ON headlines(date, source);
CREATE INDEX idx_headlines_date_timestamp ON headlines(date, timestamp DESC);

-- Enable Row Level Security
ALTER TABLE headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsor_inquiries ENABLE ROW LEVEL SECURITY;

-- Public read access (anon + authenticated)
CREATE POLICY "Allow public read access on headlines"
  ON headlines FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on daily_scores"
  ON daily_scores FOR SELECT
  USING (true);

-- No write policies on headlines/daily_scores.
-- Python scripts use the service role key, which bypasses RLS entirely.

-- sponsor_inquiries: public contact form, anonymous inserts allowed
CREATE POLICY "Allow anonymous inserts on sponsor_inquiries"
  ON sponsor_inquiries FOR INSERT
  WITH CHECK (true);
