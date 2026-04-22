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

### Data layer
- `lib/supabase.ts` — Supabase client
- `lib/data.ts` — Data fetching (Supabase with local data.json fallback for dev)
- `lib/types.ts` — Shared TypeScript types

### Python scripts (in `scripts/`)
- `fetch_and_build.py` — RSS fetch + Claude/VADER scoring → upsert to Supabase
- `backfill_newsapi_ai.py` — Manual NewsAPI.ai backfill for historical gaps. Not on the cron; RSS coverage on a 6h cadence is sufficient for steady state
- `schema.sql` — Supabase table definitions + RLS policies
- `migrations/` — incremental SQL migrations applied via Supabase SQL editor

## Key Design Decisions

### Sentiment: Claude Haiku (primary) + VADER fallback
Headlines are scored using Claude Haiku (`claude-haiku-4-5-20251001`) for context-aware sentiment classification on a -1.0 to +1.0 scale (anti-AI to pro-AI). Claude scores the *stance toward AI*, not just word valence — e.g., "Anthropic Wins Court Order Pausing Ban" scores positive because it's a win for an AI company, even though words like "ban" and "court" sound negative.

If `ANTHROPIC_API_KEY` is not set, scoring falls back to VADER + domain-specific adjustments (`POSITIVE_BOOSTS`, `NEGATIVE_BOOSTS`, `CONTEXT_OVERRIDES` dicts with word-boundary regex matching). VADER compound score is always stored as `score_raw` regardless of which scorer is used.

Scores title + summary together (not just title) for better context.

**Why Claude over VADER:** VADER is lexicon-based and had a 62% direction agreement with Claude in testing. Key failures: substring matching ("ban" matched "bank", "banking"), context blindness (couldn't tell "wins court order pausing ban" is positive), and poor handling of news/legal language. Claude costs ~$0.01-0.02/day at ~60 headlines/day on Haiku.

### Data sources
14 RSS feeds — TechCrunch, NYT, The Verge, Ars Technica, Wired, BBC, Guardian, MIT Tech Review, Bloomberg, ZDNet AI, VentureBeat AI, CNBC Tech, NPR Technology, Fox News Tech

**NewsAPI.ai backfill (manual)**: `backfill_newsapi_ai.py` queries NewsAPI.ai (Event Registry) for the same 14 sources over a date window, scoring via the same pipeline as `fetch_and_build.py`. It was on the 6h cron originally, but over 14 days of routine operation it contributed zero headlines (RSS covers the 6h window fully) so it was retired from CI. Still kept in-repo for one-off historical backfills — run locally with `NEWSAPI_AI_KEY` set. Uses batched keyword queries to stay under the free plan's 15-item query limit.

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
- `ANTHROPIC_API_KEY` — Anthropic API key for Claude Haiku scoring (falls back to VADER if not set)
- `NEWSAPI_AI_KEY` — NewsAPI.ai API key (backfill only)

## Known Limitations

- RSS feeds only retain ~1 week of history; NewsAPI.ai backfill (manual, free tier limited to last 30 days) covers larger gaps if RSS ever misses a window
- Claude Haiku scoring adds ~$0.01-0.02/day API cost; falls back to VADER if API key not set or API errors
- VADER fallback uses word-boundary regex for domain adjustments but still lacks context awareness

## Future Directions (planned)

- Insights/observations panel (day-over-day, week-over-week trends, notable spikes)
- Explainability panel (click a day → source breakdown, top movers)
- Moving average overlay on chart
- Additional structured fields from Claude (future_outlook, topic category, etc.)
- Custom domain
