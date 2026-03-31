# AI Sentiment Index

**Live:** [labs.bradshroyer.com](https://labs.bradshroyer.com)

I was curious: how does the media *actually* feel about AI right now? Not what Twitter thinks, not what VCs are pitching — what are the major outlets writing, and is the overall tone positive or negative?

So I built this. The AI Sentiment Index tracks daily media sentiment about AI across 14 major tech and news outlets, scores each headline, and plots the trend over time.

## How It Works

Python scripts run every 6 hours via GitHub Actions. They pull RSS feeds from 14 outlets — TechCrunch, NYT, BBC, Wired, The Verge, MIT Tech Review, Bloomberg, and more. Each headline and summary is scored using [VADER](https://github.com/cjhutto/vaderSentiment) sentiment analysis with custom domain-specific adjustments (vanilla VADER thinks "AI breakthrough in cancer detection" is negative because of the word "cancer"). Results are stored in Supabase (Postgres).

The frontend is a Next.js app deployed on Vercel. The chart is interactive — click any data point to drill into that day's headlines.

## Stack

- **Frontend:** Next.js 15, Tailwind CSS, Chart.js (react-chartjs-2)
- **Database:** Supabase (Postgres)
- **Data pipeline:** Python (VADER + domain adjustments), GitHub Actions (6h cron)
- **Hosting:** Vercel
- **Backfill:** NewsAPI.ai (Event Registry) for historical coverage

## What You See

- An interactive sentiment chart — click any day to drill into the headlines
- Volume bars showing headline count per day
- Filter by source to compare how individual outlets differ
- Filter by time range (1W, 1M, 3M, 6M, 1Y, All)
- Browse the actual headlines with sentiment scores

## Project Structure

```
app/                     → Next.js app (App Router)
components/              → React components (chart, table, filters, stats)
lib/                     → Supabase client, data fetching, types
scripts/
  fetch_and_build.py     → RSS fetch + VADER scoring → Supabase
  backfill_newsapi_ai.py → NewsAPI.ai backfill → Supabase
  migrate_to_supabase.py → One-time migration from data.json
  schema.sql             → Supabase table definitions
.github/workflows/       → GitHub Actions cron (every 6h)
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

# Run the Next.js dev server
npm run dev

# Fetch new headlines (writes to Supabase)
python scripts/fetch_and_build.py

# Backfill from NewsAPI.ai
NEWSAPI_AI_KEY=your-key python scripts/backfill_newsapi_ai.py
```

## What's Next

- Insights panel: automated observations (day-over-day, week-over-week trends)
- Explainability: click a day to see *why* sentiment moved (top headlines, source breakdown)
- Better NLP models as they become cost-effective
- Custom domain

## License

MIT
