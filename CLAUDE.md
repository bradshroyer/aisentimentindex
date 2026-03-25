# AI Sentiment Index

Tracks media sentiment about AI across major tech outlets. Zero-cost: Python script generates a static HTML page with Chart.js, hosted on GitHub Pages, updated by GitHub Actions cron.

Live: https://bradshroyer.github.io/aisentimentindex/

## Architecture

```
fetch_and_build.py  → fetches 10 RSS feeds, scores sentiment, generates index.html
backfill.py         → one-time tool: pulls historical data from GDELT API
data.json           → all headlines + daily aggregated scores (auto-generated)
index.html          → static page with Chart.js chart (auto-generated)
.github/workflows/update.yml → runs fetch_and_build.py at 8am + 8pm UTC
```

Cost: $0/month. Public GitHub repo, GitHub Pages, GitHub Actions free tier, no paid APIs.

## Key Design Decisions

### Sentiment: VADER + domain-specific adjustments
Raw VADER misscores AI headlines badly ("AI breakthrough in cancer detection" scores -0.66 because "cancer" is negative). We add a domain-specific boost/penalty layer in `POSITIVE_BOOSTS`, `NEGATIVE_BOOSTS`, and `CONTEXT_OVERRIDES` dicts. Existential/catastrophic terms are weighted heavily negative (-0.3 to -0.35).

Scores title + summary together (not just title) for better context.

### Data sources
- **Live (RSS):** 10 feeds — TechCrunch, NYT, The Verge, Ars Technica, Wired, BBC, Guardian, MIT Tech Review, Bloomberg, ZDNet AI
- **Backfill (GDELT):** Free DOC 2.0 API, no key needed, history back to 2017. Uses curl subprocess (Python requests gets rate-limited by GDELT). Queried by week chunks with 10s delay between requests.

### Chart: dual-line for data provenance
- Solid blue = live RSS data (reliable, consistent sources)
- Dashed gray = GDELT backfill (broader but less curated)
- Headlines table shows "backfill" tag on historical entries
- MIN_SOURCES_PER_DAY = 3: chart only shows days with data from 3+ distinct sources

### Client-side interactivity
All filtering/pagination runs in the browser (no server):
- Source filter dropdown (updates chart + headlines)
- "Show more" pagination (25 headlines at a time)
- Expandable footer with source list

## How to Run

```bash
# Daily RSS fetch + rebuild (also what GitHub Actions runs)
python3 fetch_and_build.py

# Historical backfill (free, no API key)
python3 backfill.py --from 2024-03-25 --to 2026-03-24

# Install dependencies
pip3 install -r requirements.txt  # feedparser, vaderSentiment, requests
```

## Known Limitations

- VADER is lexicon-based — domain adjustments help but aren't perfect
- GDELT backfill sources differ from RSS sources (labeled separately on chart)
- RSS feeds only retain ~1 week of history; data accumulates over time
- No deduplication across RSS and GDELT (same story from different sources counts twice)

## Future Directions (discussed but not yet implemented)

- UI/UX redesign (deferred — current focus is data quality)
- Volume tracking alongside sentiment (days with 2 vs 30 headlines tell different stories)
- More sophisticated NLP (fine-tuned transformer models if cost justified)
- Custom domain
