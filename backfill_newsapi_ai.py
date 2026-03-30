#!/usr/bin/env python3
"""Backfill missing headlines from NewsAPI.ai (Event Registry) into data.json.

Uses the same scoring pipeline as fetch_and_build.py so scores are consistent.
Deduplicates against existing headlines by title.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from eventregistry import (
    EventRegistry, QueryArticlesIter, QueryItems, ReturnInfo, ArticleInfoFlags,
)

# Import scoring/filtering functions from the main script
from fetch_and_build import (
    AI_KEYWORDS, DATA_START_DATE, is_ai_related, score_headlines,
    load_data, save_data, aggregate_daily, generate_html, strip_html,
)

load_dotenv()

API_KEY = os.getenv("NEWSAPI_AI_KEY")
if not API_KEY:
    raise SystemExit("Set NEWSAPI_AI_KEY in .env")

# Map EventRegistry source URIs → our source names (must match RSS_FEEDS keys)
SOURCE_MAP = {
    "techcrunch.com": "TechCrunch",
    "nytimes.com": "NYT Technology",
    "theverge.com": "The Verge",
    "arstechnica.com": "Ars Technica",
    "wired.com": "Wired",
    "bbc.co.uk": "BBC Technology",
    "bbc.com": "BBC Technology",
    "theguardian.com": "The Guardian",
    "technologyreview.com": "MIT Tech Review",
    "bloomberg.com": "Bloomberg",
    "zdnet.com": "ZDNet AI",
    "venturebeat.com": "VentureBeat AI",
    "cnbc.com": "CNBC Tech",
    "npr.org": "NPR Technology",
    "foxnews.com": "Fox News Tech",
}

# Free plan caps total query items (keywords + sources) at ~15.
# We batch: small keyword groups × all sources per query.
KEYWORD_BATCHES = [
    ["artificial intelligence", "machine learning", "deep learning"],
    ["ChatGPT", "OpenAI", "Anthropic", "GPT"],
    ["generative AI", "large language model", "neural network"],
    ["Copilot", "deepfake", "Midjourney", "Gemini AI"],
]

MAX_SUMMARY_CHARS = 500  # Truncate body to this length for summary field


def fetch_from_newsapi(date_start: str, date_end: str, max_per_batch: int = 2000) -> list[dict]:
    """Fetch AI-related articles in batches to stay under free-plan query limits."""
    er = EventRegistry(apiKey=API_KEY)
    seen_uris = set()
    articles = []

    for i, keywords in enumerate(KEYWORD_BATCHES):
        print(f"  Batch {i+1}/{len(KEYWORD_BATCHES)}: {keywords}")
        q = QueryArticlesIter(
            keywords=QueryItems.OR(keywords),
            sourceUri=QueryItems.OR(list(SOURCE_MAP.keys())),
            dateStart=date_start,
            dateEnd=date_end,
            lang="eng",
        )

        batch_count = 0
        for art in q.execQuery(
            er,
            sortBy="date",
            maxItems=max_per_batch,
            returnInfo=ReturnInfo(
                articleInfo=ArticleInfoFlags(
                    title=True, body=True, url=True,
                    date=True, dateTime=True,
                    source=True, sentiment=True,
                    isDuplicate=True,
                )
            ),
        ):
            uri = art.get("uri", "")
            if uri and uri in seen_uris:
                continue
            seen_uris.add(uri)
            articles.append(art)
            batch_count += 1

        print(f"    → {batch_count} new articles")

    return articles


def convert_article(art: dict) -> dict | None:
    """Convert a NewsAPI.ai article to our headline format, or None if filtered out."""
    title = (art.get("title") or "").strip()
    if not title:
        return None

    source_uri = art.get("source", {}).get("uri", "")
    source_name = SOURCE_MAP.get(source_uri)
    if not source_name:
        return None

    body = (art.get("body") or "").strip()
    summary = body[:MAX_SUMMARY_CHARS] if body else ""

    date = art.get("date", "")
    if not date or date < DATA_START_DATE:
        return None

    # Apply our AI keyword filter (EventRegistry keyword search is broader)
    if not is_ai_related(title, summary):
        return None

    return {
        "title": title,
        "summary": summary,
        "url": art.get("url", ""),
        "source": source_name,
        "date": date,
        "timestamp": art.get("dateTime", datetime.now(timezone.utc).isoformat()),
    }


def main():
    import argparse
    from datetime import timedelta

    parser = argparse.ArgumentParser(description="Backfill headlines from NewsAPI.ai")
    parser.add_argument("--days", type=int, default=7,
                        help="How many days back to search (default: 7)")
    parser.add_argument("--full", action="store_true",
                        help="Search from DATA_START_DATE instead of --days")
    args = parser.parse_args()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if args.full:
        date_start = DATA_START_DATE
    else:
        start = datetime.now(timezone.utc) - timedelta(days=args.days)
        date_start = max(start.strftime("%Y-%m-%d"), DATA_START_DATE)

    print(f"Backfilling from {date_start} to {today}")
    print(f"Searching {len(SOURCE_MAP)} sources in {len(KEYWORD_BATCHES)} keyword batches\n")

    # Load existing data
    data = load_data()
    existing_titles = {h["title"] for h in data["headlines"]}
    print(f"Existing headlines: {len(existing_titles)}")

    # Fetch from NewsAPI.ai
    articles = fetch_from_newsapi(date_start, today)
    print(f"Fetched {len(articles)} articles from NewsAPI.ai")

    # Convert and deduplicate
    new_headlines = []
    skipped_not_ai = 0
    skipped_duplicate = 0
    skipped_is_duplicate_flag = 0

    for art in articles:
        # Skip EventRegistry-flagged duplicates
        if art.get("isDuplicate", False):
            skipped_is_duplicate_flag += 1
            continue

        headline = convert_article(art)
        if headline is None:
            skipped_not_ai += 1
            continue

        if headline["title"] in existing_titles:
            skipped_duplicate += 1
            continue

        existing_titles.add(headline["title"])
        new_headlines.append(headline)

    print(f"\nFiltering results:")
    print(f"  Skipped (EventRegistry duplicate): {skipped_is_duplicate_flag}")
    print(f"  Skipped (not AI-related): {skipped_not_ai}")
    print(f"  Skipped (already in data.json): {skipped_duplicate}")
    print(f"  New headlines to add: {len(new_headlines)}")

    if not new_headlines:
        print("\nNo new headlines to backfill.")
        return

    # Score with VADER + domain adjustments (same as regular pipeline)
    scored = score_headlines(new_headlines)

    # Show per-day breakdown
    from collections import Counter
    by_date = Counter(h["date"] for h in scored)
    by_source = Counter(h["source"] for h in scored)
    print(f"\nNew headlines by date:")
    for date, count in sorted(by_date.items()):
        print(f"  {date}: {count}")
    print(f"\nNew headlines by source:")
    for source, count in by_source.most_common():
        print(f"  {source}: {count}")

    # Merge into data
    data["headlines"].extend(scored)
    data["daily_scores"] = aggregate_daily(data["headlines"])
    save_data(data)
    generate_html(data)

    total_days = len(data["daily_scores"])
    total_headlines = len(data["headlines"])
    print(f"\nDone! data.json now has {total_headlines} headlines across {total_days} days")


if __name__ == "__main__":
    main()
