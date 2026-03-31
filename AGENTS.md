# AI Sentiment Index

Tracks media sentiment about AI across major tech outlets. Next.js + Supabase + Vercel, with Python scripts for data ingestion.

Live: https://labs.bradshroyer.com

## Architecture

```
Next.js 15 (App Router) → Vercel
Supabase (Postgres)     → headlines + daily_scores tables
Python scripts          → fetch/score/backfill → write to Supabase
GitHub Actions          → runs Python scripts every 6h
```

### Frontend
- `app/page.tsx` — Server component, fetches data from Supabase
- `components/Dashboard.tsx` — Client component, manages state (selectedDate, selectedSource, selectedRange)
- `components/SentimentChart.tsx` — Chart.js mixed line+bar chart with click-to-filter
- `components/HeadlinesTable.tsx` — Paginated headlines, filtered by day/source
- `components/FilterBar.tsx` — Source dropdown + time range buttons
- `components/StatsBar.tsx` — Key metrics (headlines, days, latest score)

### Data layer
- `lib/supabase.ts` — Supabase client
- `lib/data.ts` — Data fetching (Supabase with local data.json fallback for dev)
- `lib/types.ts` — Shared TypeScript types

### Python scripts (in `scripts/`)
- `fetch_and_build.py` — RSS fetch + VADER scoring → upsert to Supabase
- `backfill_newsapi_ai.py` — NewsAPI.ai backfill → upsert to Supabase
- `migrate_to_supabase.py` — One-time migration from data.json
- `schema.sql` — Supabase table definitions + RLS policies

## Key Design Decisions

### Sentiment: VADER + domain-specific adjustments
Raw VADER misscores AI headlines badly ("AI breakthrough in cancer detection" scores -0.66 because "cancer" is negative). We add a domain-specific boost/penalty layer in `POSITIVE_BOOSTS`, `NEGATIVE_BOOSTS`, and `CONTEXT_OVERRIDES` dicts. Existential/catastrophic terms are weighted heavily negative (-0.3 to -0.35).

Scores title + summary together (not just title) for better context.

### Data sources
14 RSS feeds — TechCrunch, NYT, The Verge, Ars Technica, Wired, BBC, Guardian, MIT Tech Review, Bloomberg, ZDNet AI, VentureBeat AI, CNBC Tech, NPR Technology, Fox News Tech

**NewsAPI.ai backfill**: After each RSS fetch, `backfill_newsapi_ai.py` queries the NewsAPI.ai (Event Registry) API for the same 14 sources over the last 7 days, catching headlines that RSS feeds rotated out. Uses batched keyword queries to stay under the free plan's 15-item query limit. Requires `NEWSAPI_AI_KEY` env var (stored as GitHub Actions secret).

### Database (Supabase)
Two tables:
- `headlines` — id, title, summary, url, source, date, timestamp, score_raw, score (UNIQUE on title+source+date)
- `daily_scores` — date (PK), mean, count, pos, neg, neu, sources (JSONB), by_source (JSONB)

IMPORTANT: Don't `json.dumps()` JSONB fields before upserting — supabase-py handles serialization automatically. Double-encoding causes string-instead-of-object bugs.

### Chart interaction
Click a data point → filters headlines to that day, highlights the point red. Click again or click empty area to deselect. Source filter + time range interact with the selection.

## How to Run

```bash
# Install dependencies
npm install
pip install -r requirements.txt

# Dev server (uses Supabase if env vars set, falls back to data.json)
npm run dev

# Fetch new headlines
python scripts/fetch_and_build.py

# Backfill from NewsAPI.ai (last 7 days by default)
NEWSAPI_AI_KEY=your-key python scripts/backfill_newsapi_ai.py
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable key (safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase secret key (Python writes only)
- `NEWSAPI_AI_KEY` — NewsAPI.ai API key (backfill only)

## Known Limitations

- VADER is lexicon-based — domain adjustments help but aren't perfect
- RSS feeds only retain ~1 week of history; NewsAPI.ai backfill covers gaps but free tier limited to last 30 days

## Future Directions (planned)

- Insights/observations panel (day-over-day, week-over-week trends, notable spikes)
- Explainability panel (click a day → source breakdown, top movers, domain adjustments)
- Moving average overlay on chart
- More sophisticated NLP (fine-tuned transformer models if cost justified)
- Custom domain
