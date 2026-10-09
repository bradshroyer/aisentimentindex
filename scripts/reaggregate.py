#!/usr/bin/env python3
"""Rebuild daily_scores from the headlines table.

Run after changing what counts toward the index — e.g. retiring a source in
data/sources.json, which aggregate_daily() then leaves out. Dry run by default:

    python3 scripts/reaggregate.py                      # compare, write nothing
    python3 scripts/reaggregate.py --apply              # rewrite every date
    python3 scripts/reaggregate.py --since 2026-09-01   # limit the range
"""

import argparse
from typing import Optional

from fetch_and_build import aggregate_daily, get_supabase, upsert_daily_scores

PAGE = 1000


def fetch_all(sb, table: str, columns: str, since: Optional[str]) -> list[dict]:
    rows: list[dict] = []
    while True:
        q = sb.table(table).select(columns)
        if since:
            q = q.gte("date", since)
        order_col = "date" if table == "daily_scores" else "id"
        page = q.order(order_col).range(len(rows), len(rows) + PAGE - 1).execute().data or []
        rows.extend(page)
        if len(page) < PAGE:
            return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    parser.add_argument("--since", help="only rebuild dates >= YYYY-MM-DD")
    args = parser.parse_args()

    sb = get_supabase()
    headlines = fetch_all(sb, "headlines", "date,source,score,about_ai", args.since)
    current = {r["date"]: r for r in fetch_all(sb, "daily_scores", "date,mean,count", args.since)}
    rebuilt = aggregate_daily(headlines)
    print(f"{len(headlines)} headlines -> {len(rebuilt)} dates")

    changed = {
        d: v for d, v in rebuilt.items()
        if d not in current
        or current[d]["count"] != v["count"]
        or abs(current[d]["mean"] - v["mean"]) > 1e-4
    }
    shifts = [v["mean"] - current[d]["mean"] for d, v in changed.items() if d in current]
    print(f"{len(changed)} date(s) differ from daily_scores")
    if shifts:
        print(f"  mean shift: avg {sum(shifts) / len(shifts):+.4f}, "
              f"min {min(shifts):+.4f}, max {max(shifts):+.4f}")
    for d in sorted(changed)[:5]:
        old = current.get(d)
        print(f"  {d}: {old['mean'] if old else '—'} ({old['count'] if old else 0}) "
              f"-> {changed[d]['mean']} ({changed[d]['count']})")

    # Dates whose every headline came from a retired source would be left
    # with a stale row; report them rather than deleting silently.
    orphaned = sorted(set(current) - set(rebuilt))
    if orphaned:
        print(f"{len(orphaned)} daily_scores date(s) have no active-source headlines: {orphaned[:10]}")

    if not args.apply:
        print("Dry run complete — pass --apply to write.")
        return
    items = sorted(changed.items())
    written = 0
    for i in range(0, len(items), 200):
        written += upsert_daily_scores(sb, dict(items[i:i + 200]))
    print(f"Wrote {written} daily_scores row(s)")


if __name__ == "__main__":
    main()
