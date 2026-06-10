# AI Sentiment Index

**Live:** [sentimentindex.ai](https://sentimentindex.ai)

[![AI Sentiment Index — current value and 30-day trend](https://sentimentindex.ai/opengraph-image)](https://sentimentindex.ai)

I was curious: how does the media *actually* feel about AI right now? Not what Twitter thinks, not what VCs are pitching — what are the major outlets writing, and is the overall tone positive or negative?

So I built this. The AI Sentiment Index tracks daily media sentiment about AI across 14 major tech and news outlets, scores each headline, and plots the trend over time.

## How It Works

Python scripts run every 6 hours via GitHub Actions. They pull RSS feeds from 14 outlets — TechCrunch, NYT, BBC, Wired, The Verge, MIT Tech Review, Bloomberg, and more. Each headline and summary is scored using Claude Haiku for context-aware sentiment analysis. Claude scores the *stance toward AI* (not just word sentiment), so "Anthropic Wins Court Order Pausing Ban" correctly scores positive even though words like "ban" sound negative. VADER serves as a fallback when the API key isn't available. Results are stored in Supabase (Postgres).

The frontend is a Next.js app deployed on Vercel. The chart is interactive — click any data point to drill into that day's headlines.

Full details on the scoring approach — including how Claude compares to VADER and why lexicon-based scoring failed on news headlines — are on the [methodology page](https://sentimentindex.ai/methodology).

## Stack

- **Frontend:** Next.js 15, Tailwind CSS, Chart.js (react-chartjs-2)
- **Database:** Supabase (Postgres)
- **Data pipeline:** Python (Claude Haiku scoring, VADER fallback), GitHub Actions (6h cron)
- **Hosting:** Vercel

## What You See

- An interactive sentiment chart — click any day to drill into the headlines
- Volume bars showing headline count per day
- Filter by source to compare how individual outlets differ
- Filter by time range (1W, 1M, 3M, 6M, 1Y, All)
- Browse the actual headlines with sentiment scores

## Dataset

The full dataset — every scored headline and daily aggregate since January 2025 — is exported weekly to [`data/export/`](data/export):

- `daily_scores.json` — the index: one row per day with mean, counts, and per-source breakdowns
- `headlines.json` / `headlines.csv` — every scored headline (title, summary, source, date, score, which scorer produced it)

Free to use with attribution (MIT). The export doubles as the project's backup: RSS feeds have no backfill, so the database is otherwise the only copy.

## Project Structure

```
app/                     → Next.js app (App Router)
components/              → React components (chart, table, filters, stats)
lib/                     → Supabase client, data fetching, types
data/export/             → weekly dataset export (JSON + CSV)
scripts/
  fetch_and_build.py     → RSS fetch + Claude/VADER scoring → Supabase
  export_data.py         → dump both tables to data/export/
  rescore.py             → re-run Claude over VADER-fallback rows
  schema.sql             → Supabase table definitions
  migrations/            → SQL migrations applied via Supabase SQL editor
.github/workflows/       → GitHub Actions: 6h ingest cron + weekly export
```

## Running Locally

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Set environment variables in .env
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
ANTHROPIC_API_KEY=your-anthropic-key  # optional, falls back to VADER

# Run the Next.js dev server
npm run dev

# Fetch new headlines (writes to Supabase)
python scripts/fetch_and_build.py
```

## License

MIT
