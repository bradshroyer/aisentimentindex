#!/usr/bin/env python3
"""Rescore headlines in a date range with Claude, update in place.

Useful for replacing VADER scores with Claude scores in a specific window.

Usage:
    # Rescore everything in January 2025
    python scripts/rescore_range.py --start 2025-01-01 --end 2025-01-31
"""

import argparse
import os
import sys
import time

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=True)

sys.path.insert(0, os.path.dirname(__file__))
from fetch_and_build import (
    _get_claude_client,
    _score_one_claude,
    aggregate_daily,
    get_supabase,
    upsert_daily_scores,
)


def main():
    parser = argparse.ArgumentParser(description="Rescore headlines in a date range with Claude.")
    parser.add_argument("--start", required=True, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", required=True, help="End date (YYYY-MM-DD)")
    args = parser.parse_args()

    sb = get_supabase()
    claude = _get_claude_client()
    if not claude:
        sys.exit("ANTHROPIC_API_KEY not set — cannot rescore.")

    print(f"Loading headlines from {args.start} to {args.end}...")
    all_headlines = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            sb.table("headlines")
            .select("id,title,summary,score,score_raw,date")
            .gte("date", args.start)
            .lte("date", args.end)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not result.data:
            break
        all_headlines.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    print(f"Loaded {len(all_headlines)} headlines.")
    if not all_headlines:
        return

    # Score each with Claude (rate-limited to ~45/min to stay under 50 RPM)
    updates = []
    errors = 0
    batch_start = time.time()
    BATCH_SIZE = 45
    BATCH_WINDOW = 62

    for i, h in enumerate(all_headlines):
        text = h["title"]
        if h.get("summary"):
            text = f"{text}. {h['summary']}"

        score = _score_one_claude(claude, text)
        if score is not None:
            updates.append({"id": h["id"], "score": round(score, 4)})
        else:
            errors += 1

        if (i + 1) % 50 == 0:
            print(f"  Scored {i + 1}/{len(all_headlines)} ({errors} errors)...")

        if (i + 1) % BATCH_SIZE == 0:
            elapsed = time.time() - batch_start
            if elapsed < BATCH_WINDOW:
                wait = BATCH_WINDOW - elapsed
                print(f"  Rate limit pause: {wait:.0f}s...")
                time.sleep(wait)
            batch_start = time.time()

    print(f"\nScoring complete: {len(updates)} scored, {errors} errors.")

    print("Updating scores in Supabase...")
    updated = 0
    for row in updates:
        sb.table("headlines").update({"score": row["score"]}).eq("id", row["id"]).execute()
        updated += 1
        if updated % 100 == 0:
            print(f"  Updated {updated}/{len(updates)}...")

    print(f"Updated {updated} headline scores.")

    # Re-aggregate daily scores (need full DB for accuracy)
    print("Re-aggregating daily scores...")
    all_full = []
    offset = 0
    while True:
        result = sb.table("headlines").select("*").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        all_full.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    daily = aggregate_daily(all_full)
    count = upsert_daily_scores(sb, daily)
    print(f"Updated {count} daily score entries.")
    print("Done!")


if __name__ == "__main__":
    main()
