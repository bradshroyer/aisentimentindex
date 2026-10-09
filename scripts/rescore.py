#!/usr/bin/env python3
"""Re-score headlines with the current Claude scorer.

Two jobs:
- VADER cleanup (default): when a Claude call fails mid-ingest that headline
  falls back to VADER (scored_by='vader') and the day mixes scorers. This
  re-runs Claude over those rows.
- Model/prompt migration (--all): every row not already scored by the current
  CLAUDE_MODEL, so a scorer change doesn't leave a step in the series.
  Resumable — rerunning skips rows already moved over.

Affected dates are re-aggregated afterwards so daily_scores stays consistent.
Dry run by default (scores a small sample, writes nothing):

    python3 scripts/rescore.py                  # VADER rows, dry run
    python3 scripts/rescore.py --all --apply    # migrate everything
"""

import argparse
from concurrent.futures import ThreadPoolExecutor

from fetch_and_build import (
    CLAUDE_MODEL,
    RSS_FEEDS,
    _get_claude_client,
    _score_one_claude,
    get_supabase,
    reaggregate_dates,
)

PAGE = 1000
DRY_RUN_SAMPLE = 20


def load_rows(sb, all_rows: bool, since) -> list[dict]:
    rows: list[dict] = []
    while True:
        q = sb.table("headlines").select("id,title,summary,source,date,score,about_ai,scored_by")
        if all_rows:
            # PostgREST's neq drops NULLs, so match them explicitly.
            q = q.or_(f"scored_by.is.null,scored_by.neq.{CLAUDE_MODEL}")
        else:
            q = q.eq("scored_by", "vader")
        if since:
            q = q.gte("date", since)
        page = q.order("id").range(len(rows), len(rows) + PAGE - 1).execute().data or []
        rows.extend(page)
        if len(page) < PAGE:
            break
    # Retired sources are out of the index; don't pay to rescore them.
    return [r for r in rows if r["source"] in RSS_FEEDS]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="write changes (default: dry run on a small sample)")
    parser.add_argument("--all", action="store_true",
                        help=f"rescore every row not scored by {CLAUDE_MODEL}")
    parser.add_argument("--since", help="only rows with date >= YYYY-MM-DD")
    parser.add_argument("--limit", type=int, default=None, help="max rows to rescore")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    claude = _get_claude_client()
    if claude is None:
        raise SystemExit("ANTHROPIC_API_KEY (and the anthropic package) are required to rescore.")

    sb = get_supabase()
    rows = load_rows(sb, args.all, args.since)
    if not args.apply:
        rows = rows[:DRY_RUN_SAMPLE]
    if args.limit:
        rows = rows[: args.limit]
    if not rows:
        print("Nothing to rescore.")
        return

    mode = "" if args.apply else f" (dry run, first {len(rows)})"
    print(f"Rescoring {len(rows)} row(s) with {CLAUDE_MODEL}{mode}")

    def work(row):
        text = row["title"]
        if row.get("summary"):
            text = f"{text}. {row['summary']}"
        result = _score_one_claude(claude, text)
        if result is None:
            return None
        score, about_ai = result
        if args.apply:
            sb.table("headlines").update({
                "score": round(score, 4),
                "about_ai": about_ai,
                "scored_by": CLAUDE_MODEL,
            }).eq("id", row["id"]).execute()
        return score, about_ai

    dates_touched: set[str] = set()
    failed = done = off_topic = 0
    with ThreadPoolExecutor(args.workers) as pool:
        for row, result in zip(rows, pool.map(work, rows)):
            if result is None:
                failed += 1
                continue
            done += 1
            off_topic += not result[1]
            dates_touched.add(row["date"])
            if not args.apply:
                flag = "" if result[1] else "  [not about AI]"
                print(f"  #{row['id']} {row['date']}  {row['score']:+.3f} -> {result[0]:+.3f}"
                      f"  {row['title'][:70]}{flag}")
            elif done % 500 == 0:
                print(f"  {done}/{len(rows)} rescored", flush=True)

    print(f"{done} rescored, {off_topic} judged not about AI, {failed} failed (left as-is)")
    if args.apply and dates_touched:
        print(f"Re-aggregating {len(dates_touched)} date(s)")
        reaggregate_dates(sb, dates_touched)
    elif not args.apply:
        print("Dry run complete — pass --apply to write.")


if __name__ == "__main__":
    main()
