-- Run this in Supabase SQL Editor to create the tables

CREATE TABLE headlines (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  source TEXT NOT NULL,
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  score_raw FLOAT NOT NULL,
  score FLOAT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(title, source, date)
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

-- Indexes for common queries
CREATE INDEX idx_headlines_date ON headlines(date);
CREATE INDEX idx_headlines_source ON headlines(source);
CREATE INDEX idx_headlines_date_source ON headlines(date, source);

-- Enable Row Level Security but allow public reads
ALTER TABLE headlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on headlines"
  ON headlines FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on daily_scores"
  ON daily_scores FOR SELECT
  USING (true);

-- Service role can insert/update (used by Python scripts)
CREATE POLICY "Allow service role write on headlines"
  ON headlines FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role write on daily_scores"
  ON daily_scores FOR ALL
  USING (true)
  WITH CHECK (true);
