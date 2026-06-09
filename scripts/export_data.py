#!/usr/bin/env python3
"""Export Supabase tables to data/export/ — backup and public dataset.

Run weekly by .github/workflows/export.yml, which commits the output. The
headlines table is the irreplaceable asset (RSS has no backfill), so the
committed export doubles as the only backup. Read-only; safe to run anytime:

    python scripts/export_data.py
"""

import csv
import json
from pathlib import Path

from fetch_and_build import get_supabase

EXPORT_DIR = Path(__file__).resolve().parent.parent / "data" / "export"

# Explicit column orders keep diffs stable and drop internal columns
# (title_normalized, created_at) from the public artifact.
HEADLINE_COLUMNS = [
    "id", "date", "timestamp", "source", "title", "summary", "url",
    "score", "score_raw", "scored_by",
]
DAILY_COLUMNS = ["date", "mean", "count", "pos", "neg", "neu", "sources", "by_source"]


def fetch_all(sb, table: str, order_col: str) -> list[dict]:
    rows = []
    offset = 0
    page_size = 1000
    while True:
        result = (
            sb.table(table)
            .select("*")
            .order(order_col, desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        data = result.data or []
        rows.extend(data)
        if len(data) < page_size:
            break
        offset += page_size
    return rows


def dump_json(path: Path, rows: list[dict], columns: list[str]) -> None:
    """JSON array, one row per line — valid JSON that still diffs cleanly."""
    with open(path, "w", encoding="utf-8") as f:
        f.write("[\n")
        last = len(rows) - 1
        for i, row in enumerate(rows):
            projected = {c: row.get(c) for c in columns}
            f.write(json.dumps(projected, ensure_ascii=False))
            f.write(",\n" if i < last else "\n")
        f.write("]\n")


def dump_csv(path: Path, rows: list[dict], columns: list[str]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main():
    sb = get_supabase()
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)

    daily = fetch_all(sb, "daily_scores", "date")
    dump_json(EXPORT_DIR / "daily_scores.json", daily, DAILY_COLUMNS)
    print(f"Exported {len(daily)} daily scores")

    headlines = fetch_all(sb, "headlines", "id")
    dump_json(EXPORT_DIR / "headlines.json", headlines, HEADLINE_COLUMNS)
    dump_csv(EXPORT_DIR / "headlines.csv", headlines, HEADLINE_COLUMNS)
    print(f"Exported {len(headlines)} headlines")


if __name__ == "__main__":
    main()
