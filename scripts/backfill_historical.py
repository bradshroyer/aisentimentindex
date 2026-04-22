#!/usr/bin/env python3
"""One-time historical backfill from NewsAPI.ai using Gregor's upgraded account.

Uses the complex query format from the NewsAPI.ai sandbox to fetch all AI-related
articles from 14 sources, 2025-01-01 to present. Processes month-by-month to avoid
API timeouts, with resume support via a progress file.

Usage:
    # Dry run — show article counts per month, no scoring or DB writes
    python scripts/backfill_historical.py --dry-run

    # Full backfill with Claude scoring
    python scripts/backfill_historical.py

    # Resume from where you left off (reads progress file)
    python scripts/backfill_historical.py --resume

    # Backfill a specific month
    python scripts/backfill_historical.py --month 2025-03
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Load .env BEFORE importing fetch_and_build — it reads ANTHROPIC_API_KEY at
# module level.  override=True is needed because Claude Code sets an empty
# ANTHROPIC_API_KEY in the environment.
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

from eventregistry import (
    EventRegistry, QueryArticlesIter, ReturnInfo, ArticleInfoFlags,
)

# Add parent dir to path so we can import from scripts/
sys.path.insert(0, os.path.dirname(__file__))

from fetch_and_build import (
    is_ai_related, score_headlines, normalize_text,
    get_supabase, upsert_headlines, upsert_daily_scores, aggregate_daily,
    load_existing_titles,
)

from backfill_newsapi_ai import SOURCE_MAP, convert_article, MAX_SUMMARY_CHARS

API_KEY = os.getenv("NEWSAPI_AI_KEY")
if not API_KEY:
    raise SystemExit("Set NEWSAPI_AI_KEY in .env")

PROGRESS_FILE = Path(__file__).parent / ".backfill_progress.json"

BACKFILL_START = "2025-01-01"
# --------------------------------------------------------------------------- #


# API counts every word including "or" toward a 15-word limit.
# "artificial intelligence or machine learning" = 5 words (not 2 keywords).
KEYWORD_BATCHES = [
    # 14 words: artificial(1) intelligence(2) or machine(3) learning(4) or deep(5)
    # learning(6) or ChatGPT(7) or OpenAI(8) or Anthropic(9) = 14 with "or"s
    ["artificial intelligence", "machine learning", "deep learning",
     "ChatGPT", "OpenAI", "Anthropic"],
    # 11 words
    ["GPT", "generative AI", "large language model", "neural network"],
    # 7 words
    ["Copilot", "deepfake", "Midjourney", "Gemini"],
]


def build_query(date_start: str, date_end: str, keywords: list[str]) -> dict:
    """Build a complex query dict for one keyword batch (max 15 keywords)."""
    return {
        "$query": {
            "$and": [
                {
                    "keyword": " or ".join(keywords),
                    "keywordLoc": "body",
                    "keywordSearchMode": "exact",
                },
                {
                    "$or": [{"sourceUri": uri} for uri in SOURCE_MAP.keys()]
                },
                {
                    "dateStart": date_start,
                    "dateEnd": date_end,
                },
            ]
        }
    }


def month_ranges(start: str, end: str) -> list[tuple[str, str]]:
    """Generate (month_start, month_end) pairs covering start..end."""
    ranges = []
    current = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end, "%Y-%m-%d")

    while current <= end_dt:
        month_start = current.strftime("%Y-%m-%d")
        # Last day of this month
        if current.month == 12:
            next_month = current.replace(year=current.year + 1, month=1, day=1)
        else:
            next_month = current.replace(month=current.month + 1, day=1)
        month_end = min(next_month - timedelta(days=1), end_dt).strftime("%Y-%m-%d")
        ranges.append((month_start, month_end))
        current = next_month

    return ranges


def fetch_month(date_start: str, date_end: str, max_items: int = 10000) -> list[dict]:
    """Fetch articles for one month, running each keyword batch separately."""
    er = EventRegistry(apiKey=API_KEY)
    articles = []
    seen_uris = set()

    for i, keywords in enumerate(KEYWORD_BATCHES):
        query = build_query(date_start, date_end, keywords)
        q = QueryArticlesIter.initWithComplexQuery(query)

        batch_count = 0
        for art in q.execQuery(
            er,
            sortBy="date",
            maxItems=max_items,
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

        print(f"    Batch {i+1}/{len(KEYWORD_BATCHES)} ({', '.join(keywords[:3])}...): {batch_count} articles")

    return articles


def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {"completed_months": [], "total_fetched": 0, "total_scored": 0}


def save_progress(progress: dict):
    PROGRESS_FILE.write_text(json.dumps(progress, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Historical backfill from NewsAPI.ai")
    parser.add_argument("--dry-run", action="store_true",
                        help="Only count articles per month, don't score or write")
    parser.add_argument("--resume", action="store_true",
                        help="Skip months already completed (reads progress file)")
    parser.add_argument("--month", type=str, default=None,
                        help="Backfill a single month, e.g. 2025-03")
    parser.add_argument("--max-items", type=int, default=10000,
                        help="Max articles per month (default: 10000)")
    args = parser.parse_args()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if args.month:
        # Single month mode
        dt = datetime.strptime(args.month, "%Y-%m")
        month_start = dt.strftime("%Y-%m-%d")
        if dt.month == 12:
            month_end = dt.replace(year=dt.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = dt.replace(month=dt.month + 1, day=1) - timedelta(days=1)
        month_end = min(month_end, datetime.strptime(today, "%Y-%m-%d")).strftime("%Y-%m-%d")
        months = [(month_start, month_end)]
    else:
        months = month_ranges(BACKFILL_START, today)

    progress = load_progress() if args.resume else {
        "completed_months": [], "total_fetched": 0, "total_scored": 0,
    }

    print(f"{'DRY RUN — ' if args.dry_run else ''}Historical backfill: {BACKFILL_START} → {today}")
    print(f"  {len(months)} months to process")
    print(f"  {len(SOURCE_MAP)} sources")
    print()

    if not args.dry_run:
        sb = get_supabase()
        existing_titles = load_existing_titles(sb)
        print(f"Existing headlines in Supabase: {len(existing_titles)}")
    else:
        existing_titles = set()

    grand_total_fetched = 0
    grand_total_new = 0
    grand_total_scored = 0

    for month_start, month_end in months:
        month_label = month_start[:7]

        if args.resume and month_label in progress["completed_months"]:
            print(f"[{month_label}] Already completed, skipping")
            continue

        print(f"[{month_label}] Fetching {month_start} → {month_end}...")
        articles = fetch_month(month_start, month_end, max_items=args.max_items)
        print(f"  Fetched {len(articles)} articles")
        grand_total_fetched += len(articles)

        if args.dry_run:
            # Show source breakdown
            from collections import Counter
            sources = Counter()
            for art in articles:
                src_uri = art.get("source", {}).get("uri", "unknown")
                sources[SOURCE_MAP.get(src_uri, src_uri)] += 1
            for src, count in sources.most_common():
                print(f"    {src}: {count}")
            print()
            continue

        # Convert & filter
        new_headlines = []
        skipped_dup_flag = 0
        skipped_convert = 0
        skipped_existing = 0

        for art in articles:
            if art.get("isDuplicate", False):
                skipped_dup_flag += 1
                continue

            headline = convert_article(art, min_date=BACKFILL_START)
            if headline is None:
                skipped_convert += 1
                continue

            if headline["title"] in existing_titles:
                skipped_existing += 1
                continue

            existing_titles.add(headline["title"])
            new_headlines.append(headline)

        print(f"  Skipped: {skipped_dup_flag} ER-duplicates, {skipped_convert} filtered, {skipped_existing} already in DB")
        print(f"  New headlines to score: {len(new_headlines)}")

        if new_headlines:
            scored = score_headlines(new_headlines)
            count = upsert_headlines(sb, scored)
            print(f"  Upserted {count} headlines")
            grand_total_new += len(new_headlines)
            grand_total_scored += count

        # Save progress
        progress["completed_months"].append(month_label)
        progress["total_fetched"] += len(articles)
        progress["total_scored"] += len(new_headlines)
        save_progress(progress)
        print()

    # Summary
    print("=" * 60)
    print(f"Total fetched:  {grand_total_fetched}")
    if not args.dry_run:
        print(f"Total new:      {grand_total_new}")
        print(f"Total upserted: {grand_total_scored}")

        # Re-aggregate daily scores
        print("\nRe-aggregating daily scores...")
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
        print(f"Updated {daily_count} daily score entries")
        print(f"Total headlines in DB: {len(all_headlines)}")

    # Clean up progress file on full completion
    if not args.dry_run and not args.month and PROGRESS_FILE.exists():
        PROGRESS_FILE.unlink()
        print("\nBackfill complete! Removed progress file.")


if __name__ == "__main__":
    main()
