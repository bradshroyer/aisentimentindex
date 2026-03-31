#!/usr/bin/env python3
"""One-time migration: load data.json into Supabase tables."""

import json
import os
import sys

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise SystemExit("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "data.json")


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    with open(DATA_FILE) as f:
        data = json.load(f)

    headlines = data["headlines"]
    daily_scores = data["daily_scores"]

    # --- Migrate headlines ---
    print(f"Migrating {len(headlines)} headlines...")

    # Batch insert in chunks of 500
    batch_size = 500
    inserted = 0
    skipped = 0

    for i in range(0, len(headlines), batch_size):
        batch = headlines[i : i + batch_size]
        rows = []
        for h in batch:
            rows.append({
                "title": h["title"],
                "summary": h.get("summary", ""),
                "url": h.get("url", ""),
                "source": h["source"],
                "date": h["date"],
                "timestamp": h["timestamp"],
                "score_raw": h.get("score_raw", h["score"]),
                "score": h["score"],
            })

        result = sb.table("headlines").upsert(
            rows, on_conflict="title,source,date"
        ).execute()

        inserted += len(result.data) if result.data else 0
        print(f"  Batch {i // batch_size + 1}: inserted/updated {len(result.data) if result.data else 0} rows")

    print(f"Headlines done: {inserted} rows\n")

    # --- Migrate daily_scores ---
    print(f"Migrating {len(daily_scores)} daily score entries...")

    rows = []
    for date, scores in daily_scores.items():
        rows.append({
            "date": date,
            "mean": scores["mean"],
            "count": scores["count"],
            "pos": scores["pos"],
            "neg": scores["neg"],
            "neu": scores["neu"],
            "sources": scores.get("sources", []),
            "by_source": scores.get("by_source", {}),
        })

    result = sb.table("daily_scores").upsert(rows, on_conflict="date").execute()
    print(f"Daily scores done: {len(result.data) if result.data else 0} rows\n")

    print("Migration complete!")


if __name__ == "__main__":
    main()
