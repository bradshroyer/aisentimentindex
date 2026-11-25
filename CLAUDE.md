# AI Sentiment Index

Tracks media sentiment about AI across major tech outlets. Next.js + Supabase + Vercel, with Python scripts for data ingestion.

Live: https://sentimentindex.ai (redirects from labs.bradshroyer.com)

## Architecture

```
Next.js 16 (App Router) → Vercel
Supabase (Postgres)     → headlines + daily_scores + feed_health tables
Python scripts          → fetch/score/export → write to Supabase
GitHub Actions          → ingest every 6h + weekly dataset export to data/export/
```

### Frontend
- `app/page.tsx` — Server component, fetches data from Supabase, emits JSON-LD (WebSite + Dataset)
- `app/methodology/page.tsx` — Static methodology page (scoring approach, Claude-vs-VADER, pipeline)
- `app/opengraph-image.tsx` — Edge OG image rendering the live index value + 30-day sparkline (static fallback on fetch failure)
- `components/Dashboard.tsx` — Client component, manages state (selectedDate, selectedSource, selectedRange)
- `components/SentimentChart.tsx` — Chart.js mixed line+bar chart with click-to-filter + 7-day moving average
- `components/HeadlinesTable.tsx` — Paginated headlines, filtered by day/source
- `components/FilterBar.tsx` — Source dropdown + time range buttons
- `components/LeaderboardView.tsx` — Outlet ranking; rows for every range are precomputed
  server-side (`lib/leaderboard.ts`) so the page doesn't ship full per-source history
- `components/DayDetail.tsx` — Click a day → score, source breakdown, top movers
- `components/content.tsx` — Server-only presentational pieces (breadcrumbs, source
  table, headline list, JSON-LD) shared by the content pages below

### Content pages (crawlable, zero client JS of their own)
- `app/day/[date]/page.tsx` — One page per day: reading, generated summary, outlet
  table, every headline. The dashboard's day panel links here ("Full day page").
- `app/monthly/page.tsx`, `app/monthly/[month]/page.tsx` — Monthly recaps: calendar
  linking to each day, outlet table with change vs the prior month, keyword themes
  (`lib/themes.ts`), the month's strongest headlines, curated events
  (`data/spike_annotations.json`).
- `app/data/page.tsx` — Data & API docs.
- `lib/recaps.ts` — aggregation + the generated sentences (every clause restates a
  number already on the page; thresholds stop it narrating noise). `lib/format.ts` —
  shared formatters/validators.
- Day and month pages use `generateStaticParams() → []` + `dynamicParams`: rendered on
  first request, then ISR-cached. Nothing is prebuilt, so the build doesn't issue a
  Supabase query per day. Links into them set `prefetch={false}` for the same reason
  (a month calendar would otherwise trigger ~30 renders on view).
- Days with fewer than 5 headlines are `noindex` and left out of the sitemap.
- `lib/og.tsx` — share cards for day/month pages (edge, plain REST fetch).

### Public API (`app/api/v1/*`, `app/feed.xml`)
`latest`, `daily`, `daily.csv`, `outlets`, plus an RSS feed. Every route is a **static
route handler** with `revalidate = 21600`: the CDN serves it, and Supabase sees at
most one query per route per 6h no matter how many clients call. That is the whole
cost model — **handlers must not read the request** (query params, headers), which
would make the route dynamic and put the database behind an open endpoint. Add a new
static route rather than a parameter. Shared envelope/headers in `lib/api.ts`; CORS is
also set in `next.config.ts` so cached responses carry it.

### Data layer
- `lib/supabase.ts` — Supabase client (isomorphic; NEXT_PUBLIC vars work in the browser)
- `lib/data.ts` — Server-side fetching (Supabase with local data.json fallback for dev)
- `lib/clientData.ts` — Browser-side on-demand headline slices + shared column list
- `lib/types.ts` — Shared TypeScript types

### Page payload strategy (important)
The server prerenders only the last **35 days** of headlines (`headlinesSince()` in
`lib/data.ts`) — this matches the default 1M view, keeps the page ~1.3MB instead of
growing unboundedly with history, and still server-renders real content for crawlers.
When the user widens the range or selects an older day, `Dashboard` fetches the
missing `[neededSince, loadedSince)` slice from the browser via `fetchHeadlinesRange`
and merges it (dedupe by id). `daily_scores` stays all-time (it's one small row/day),
so the chart renders every range instantly.

Do NOT add `loading.tsx` to any prerendered route. A loading boundary makes Next ship
the skeleton as the visible HTML with the real content in a `<div hidden>` that an
inline script swaps in — crawlers that don't run JS (most AI crawlers, link
previewers) see only the skeleton, every page gets two `<h1>`s, first paint waits for
the whole document, and `notFound()` returns HTTP 200. The site had this until
2026-11; check with `curl -s <url> | grep -c 'hidden id="S:'` (must be 0). Static/ISR
pages gain nothing from a skeleton anyway.

Do NOT reintroduce `useSearchParams()` into the initial render path of any component
under `app/page.tsx` — combined with the implicit Suspense from `loading.tsx`, it
silently turns the prerendered HTML into the loading skeleton (no indexable content).
Deep-link params are applied in a post-mount effect in `Dashboard` instead.

### Refresh after ingest (optional)
`app/api/revalidate/route.ts` — `POST` with `Authorization: Bearer $REVALIDATE_SECRET`
marks every page and API route stale; the ingest workflow calls it after writing.
Inert until the secret exists in **both** Vercel (env var) and GitHub (repo secret);
without it pages simply wait out the 6h ISR window. The workflow step never fails
the run.

### Python scripts (in `scripts/`)
- `fetch_and_build.py` — RSS fetch + Claude/VADER scoring → upsert to Supabase
- `export_data.py` — dump both tables to `data/export/` (JSON + CSV); run weekly by
  `.github/workflows/export.yml`, which commits the output. This is the backup for
  `headlines` (RSS has no backfill) and the public dataset linked from /methodology.
- `rescore.py` — re-run Claude over `scored_by='vader'` fallback rows (default) or every
  row not on the current model (`--all`), then re-aggregate. Dry run by default; `--apply` to write.
- `reaggregate.py` — rebuild `daily_scores` from `headlines` (e.g. after retiring a
  source). Dry run by default; `--apply` to write, `--since` to limit.
- `schema.sql` — Supabase table definitions + RLS policies
- `migrations/` — incremental SQL migrations applied via Supabase SQL editor

### Pipeline guardrails
- `requirements.txt` is pinned — CI installs fresh 4×/day, so bump versions
  deliberately and test locally before committing.
- Feed health: feedparser doesn't raise on HTTP errors (a dead feed = zero entries),
  so `fetch_and_build.py` tracks consecutive zero-entry runs per source in the
  `feed_health` table and exits nonzero once a feed is dark ~2 days
  (`FEED_DARK_THRESHOLD`), firing the workflow's ingestion-failure issue. It also
  fails the run when a feed still returns entries but its newest one is older than
  `FEED_STALE_HOURS` (96; 48 false-alarmed on quiet holiday weekends) — a frozen mirror serving HTTP 200. Staleness works from
  in-memory data; the table (migrations 005/006) only adds the run counter and
  `last_entry_at`. Degrades to a warning if the table is missing.
- Claude scoring uses structured outputs (no prefill/temperature — Haiku 5.5 rejects both);
  the SDK retries 429/529/5xx (`max_retries=5`); other failures fall back to VADER for that
  headline (tracked via `scored_by`).

## Key Design Decisions

### Sentiment: Claude Haiku (primary) + VADER fallback
Headlines are scored using Claude Haiku (`claude-haiku-5-5`, effort `medium`, structured JSON output) for context-aware sentiment classification on a -1.0 to +1.0 scale (anti-AI to pro-AI). Claude scores the *stance toward AI*, not just word valence — e.g., "Anthropic Wins Court Order Pausing Ban" scores positive because it's a win for an AI company, even though words like "ban" and "court" sound negative.

If `ANTHROPIC_API_KEY` is not set, scoring falls back to VADER + domain-specific adjustments (`POSITIVE_BOOSTS`, `NEGATIVE_BOOSTS`, `CONTEXT_OVERRIDES` dicts with word-boundary regex matching). VADER compound score is always stored as `score_raw` regardless of which scorer is used.

Scores title + summary together (not just title) for better context.

**Relevance:** the same call returns `about_ai` (migration 007). The RSS keyword filter lets
through stories where AI is incidental (phone reviews, buying guides); rows with
`about_ai = false` stay in `headlines` for audit but `aggregate_daily()` skips them and
`lib/data.ts` / `lib/clientData.ts` filter them out. NULL (VADER fallback, unjudged) counts as relevant.

**Model changes:** Haiku 4.5 → 5.5 happened 2026-10 after a 300-headline comparison against
Opus 5.5 as reference (5.5 sentiment MAE 0.08 vs 0.14; caught all off-topic rows). Haiku 5.5
rejects `temperature` and assistant prefill — use `output_config.format`. After changing the
model or prompt, run `python3 scripts/rescore.py --all` (dry run) then `--all --apply` to
rescore history (resumable; skips rows already on the current model) so the chart has no seam.

**Why Claude over VADER:** VADER is lexicon-based and had a 62% direction agreement with Claude in testing. Key failures: substring matching ("ban" matched "bank", "banking"), context blindness (couldn't tell "wins court order pausing ban" is positive), and poor handling of news/legal language. Claude costs under a cent/day on Haiku 5.5 (volume has grown from ~60 to ~100+ headlines/day since launch).

### Data sources
13 active RSS feeds — TechCrunch, NYT, The Verge, Ars Technica, Wired, BBC, Guardian, MIT Tech Review, Bloomberg, ZDNet AI, CNBC Tech, NPR Technology, Fox News Tech

**Retired:** VentureBeat AI (last data 2026-09-03). Its Feedburner feed froze (HTTP 200, stale items) and the direct venturebeat.com feeds sit behind a Vercel bot challenge. Retired sources are marked `"active": false, "retired": "YYYY-MM-DD"` in `data/sources.json` and are hidden from the site entirely: Python skips them at ingest *and* `aggregate_daily()` leaves them out of `daily_scores`; `lib/data.ts` / `lib/clientData.ts` filter their headlines out of every fetch; `SOURCES` in `lib/types.ts` is active-only. Raw rows stay in `headlines` and the public export. After retiring a source, run `python3 scripts/reaggregate.py` (dry run) then `--apply` to rebuild historical `daily_scores` without it (VentureBeat's removal shifted the index by −0.022 on average). To bring a source back, fix its `rss`, delete those two keys, and reaggregate.

Ingestion is RSS-only. A NewsAPI.ai (Event Registry) backfill script existed earlier for historical gaps but was removed — over 14 days of routine operation it contributed zero headlines (RSS covers the 6h window fully), so it wasn't worth the paid quota.

### Database (Supabase)
Three tables:
- `headlines` — id, title, summary, url, source, date, timestamp, score_raw, score, scored_by, about_ai (UNIQUE on title_normalized+source+date)
- `daily_scores` — date (PK), mean, count, pos, neg, neu, sources (JSONB), by_source (JSONB)
- `feed_health` — source (PK), last_ok, last_entry_at, consecutive_failures (per-feed dark/stale detection; migrations 005, 006)

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
```

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase publishable key (safe for browser)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase secret key (Python writes only)
- `REVALIDATE_SECRET` — optional; shared secret for `/api/revalidate` (Vercel env + GitHub secret)
- `ANTHROPIC_API_KEY` — Anthropic API key for Claude Haiku scoring (falls back to VADER if not set)

## Known Limitations

- RSS feeds only retain ~1 week of history, and there is no backfill source, so headlines are permanently lost if the 6h ingestion misses a window for longer than that. The weekly `data/export/` commit backs up what's already in the DB, but can't recover never-ingested headlines.
- Claude Haiku scoring adds a few cents/day in API cost; falls back to VADER if API key not set or API errors
- VADER fallback uses word-boundary regex for domain adjustments but still lacks context awareness

## Future Directions (planned)

- Additional structured fields from Claude (future_outlook, topic category, etc.)
- Per-source pos/neg/neu in `daily_scores.by_source` (would remove the dashboard's
  need for raw headlines when computing source-filtered stacked bars)

- Model-tagged topics at ingest, replacing the keyword themes in `lib/themes.ts`
  (needs a migration + a one-off backfill, roughly the cost of a full rescore)
- Per-topic pages once topics are model-tagged

Shipped from earlier versions of this list: per-day pages, monthly recaps, public
JSON/CSV API, RSS feed of the index, trend insights line, DayDetail
explainability panel, 7-day moving average, custom domain (sentimentindex.ai).
