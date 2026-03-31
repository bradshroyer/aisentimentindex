#!/usr/bin/env python3
"""Backfill missing headlines from NewsAPI.ai (Event Registry) into Supabase.

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

# Add parent dir to path so we can import from scripts/
sys.path.insert(0, os.path.dirname(__file__))

from fetch_and_build import (
    AI_KEYWORDS, DATA_START_DATE, is_ai_related, score_headlines,
    strip_html, get_supabase, upsert_headlines, upsert_daily_scores,
    aggregate_daily, load_existing_titles,
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

KEYWORD_BATCHES = [
    ["artificial intelligence", "machine learning", "deep learning"],
    ["ChatGPT", "OpenAI", "Anthropic", "GPT"],
    ["generative AI", "large language model", "neural network"],
    ["Copilot", "deepfake", "Midjourney", "Gemini AI"],
]

MAX_SUMMARY_CHARS = 500


def fetch_from_newsapi(date_start: str, date_end: str, max_per_batch: int = 2000) -> list[dict]:
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

    sb = get_supabase()
    existing_titles = load_existing_titles(sb)
    print(f"Existing headlines: {len(existing_titles)}")

    articles = fetch_from_newsapi(date_start, today)
    print(f"Fetched {len(articles)} articles from NewsAPI.ai")

    new_headlines = []
    skipped_not_ai = 0
    skipped_duplicate = 0
    skipped_is_duplicate_flag = 0

    for art in articles:
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
    print(f"  Skipped (already in Supabase): {skipped_duplicate}")
    print(f"  New headlines to add: {len(new_headlines)}")

    if not new_headlines:
        print("\nNo new headlines to backfill.")
        return

    scored = score_headlines(new_headlines)

    from collections import Counter
    by_date = Counter(h["date"] for h in scored)
    by_source = Counter(h["source"] for h in scored)
    print(f"\nNew headlines by date:")
    for date, count in sorted(by_date.items()):
        print(f"  {date}: {count}")
    print(f"\nNew headlines by source:")
    for source, count in by_source.most_common():
        print(f"  {source}: {count}")

    count = upsert_headlines(sb, scored)
    print(f"\nUpserted {count} headlines to Supabase")

    # Re-aggregate daily scores from all headlines
    all_headlines = []
    offset = 0
    page_size = 1000
    while True:
        result = sb.table("headlines").select("*").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        all_headlines.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    daily = aggregate_daily(all_headlines)
    daily_count = upsert_daily_scores(sb, daily)
    print(f"Updated {daily_count} daily score entries in Supabase")
    print(f"\nDone! Supabase now has {len(all_headlines) + count} headlines across {len(daily)} days")


if __name__ == "__main__":
    main()
