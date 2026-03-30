# AI Sentiment Index

Tracks media sentiment about AI across major tech outlets. Zero-cost: Python script generates a static HTML page with Chart.js, hosted on GitHub Pages, updated by GitHub Actions cron.

Live: https://bradshroyer.github.io/aisentimentindex/

## Architecture

```
fetch_and_build.py       → fetches 14 RSS feeds, scores sentiment, generates index.html
backfill_newsapi_ai.py   → backfills missing headlines from NewsAPI.ai (Event Registry)
data.json                → all headlines + daily aggregated scores (auto-generated)
index.html               → static page with Chart.js chart (auto-generated)
.github/workflows/update.yml → runs fetch_and_build.py + backfill every 6h
```

Cost: ~$0/month. Public GitHub repo, GitHub Pages, GitHub Actions free tier, NewsAPI.ai free tier (2,000 tokens/month).

## Key Design Decisions

### Sentiment: VADER + domain-specific adjustments
Raw VADER misscores AI headlines badly ("AI breakthrough in cancer detection" scores -0.66 because "cancer" is negative). We add a domain-specific boost/penalty layer in `POSITIVE_BOOSTS`, `NEGATIVE_BOOSTS`, and `CONTEXT_OVERRIDES` dicts. Existential/catastrophic terms are weighted heavily negative (-0.3 to -0.35).

Scores title + summary together (not just title) for better context.

### Data sources
14 RSS feeds — TechCrunch, NYT, The Verge, Ars Technica, Wired, BBC, Guardian, MIT Tech Review, Bloomberg, ZDNet AI, VentureBeat AI, CNBC Tech, NPR Technology, Fox News Tech

**NewsAPI.ai backfill**: After each RSS fetch, `backfill_newsapi_ai.py` queries the NewsAPI.ai (Event Registry) API for the same 14 sources over the last 7 days, catching headlines that RSS feeds rotated out. Uses batched keyword queries to stay under the free plan's 15-item query limit. Requires `NEWSAPI_AI_KEY` env var (stored as GitHub Actions secret).

### Chart
- Blue line = daily mean sentiment score
- Gray bars = headline volume
- DATA_START_DATE = "2026-02-28": all data before this date is excluded (backfilled via NewsAPI.ai)

### Client-side interactivity
All filtering/pagination runs in the browser (no server):
- Source filter dropdown (updates chart + headlines)
- "Show more" pagination (25 headlines at a time)
- Expandable footer with source list

## How to Run

```bash
# Install dependencies
pip3 install -r requirements.txt

# Daily RSS fetch + rebuild (also what GitHub Actions runs)
python3 fetch_and_build.py

# Backfill from NewsAPI.ai (last 7 days by default)
NEWSAPI_AI_KEY=your-key python3 backfill_newsapi_ai.py

# Full backfill from DATA_START_DATE
NEWSAPI_AI_KEY=your-key python3 backfill_newsapi_ai.py --full

# Custom lookback
NEWSAPI_AI_KEY=your-key python3 backfill_newsapi_ai.py --days 14
```

## Known Limitations

- VADER is lexicon-based — domain adjustments help but aren't perfect
- RSS feeds only retain ~1 week of history; NewsAPI.ai backfill covers gaps but free tier limited to last 30 days

## Future Directions (discussed but not yet implemented)

- UI/UX redesign (deferred — current focus is data quality)
- Volume tracking alongside sentiment (days with 2 vs 30 headlines tell different stories)
- More sophisticated NLP (fine-tuned transformer models if cost justified)
- Custom domain
