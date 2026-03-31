#!/usr/bin/env python3
"""One-time rescore: pull all headlines from Supabase, score with Claude, update in place.

Usage:
    python scripts/rescore_all.py

Requires ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.
"""

import json
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
    sb = get_supabase()
    claude = _get_claude_client()
    if not claude:
        sys.exit("ANTHROPIC_API_KEY not set — cannot rescore.")

    # Pull all headlines from Supabase
    print("Loading all headlines from Supabase...")
    all_headlines = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            sb.table("headlines")
            .select("id,title,summary,score,score_raw")
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

    # Score each with Claude (rate-limited to ~45/min to stay under 50 RPM)
    updates = []
    errors = 0
    batch_start = time.time()
    BATCH_SIZE = 45  # requests per batch
    BATCH_WINDOW = 62  # seconds per batch (slight buffer over 60s)

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

        # Rate limit: pause at end of each batch if needed
        if (i + 1) % BATCH_SIZE == 0:
            elapsed = time.time() - batch_start
            if elapsed < BATCH_WINDOW:
                wait = BATCH_WINDOW - elapsed
                print(f"  Rate limit pause: {wait:.0f}s...")
                time.sleep(wait)
            batch_start = time.time()

    print(f"\nScoring complete: {len(updates)} scored, {errors} errors.")

    # Batch update scores in Supabase
    print("Updating scores in Supabase...")
    batch_size = 100
    updated = 0
    for i in range(0, len(updates), batch_size):
        batch = updates[i : i + batch_size]
        for row in batch:
            sb.table("headlines").update({"score": row["score"]}).eq(
                "id", row["id"]
            ).execute()
            updated += 1
        if (i + batch_size) % 500 == 0:
            print(f"  Updated {min(i + batch_size, len(updates))}/{len(updates)}...")

    print(f"Updated {updated} headline scores.")

    # Re-aggregate daily scores
    print("Re-aggregating daily scores...")
    all_headlines_full = []
    offset = 0
    while True:
        result = (
            sb.table("headlines").select("*").range(offset, offset + page_size - 1).execute()
        )
        if not result.data:
            break
        all_headlines_full.extend(result.data)
        if len(result.data) < page_size:
            break
        offset += page_size

    daily = aggregate_daily(all_headlines_full)
    count = upsert_daily_scores(sb, daily)
    print(f"Updated {count} daily score entries.")
    print("Done!")


if __name__ == "__main__":
    main()
