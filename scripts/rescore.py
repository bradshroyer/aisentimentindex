#!/usr/bin/env python3
"""Re-score VADER-fallback rows with Claude.

When a Claude API call fails mid-ingest, that headline falls back to VADER
(scored_by='vader') and the day mixes scorers. This re-runs Claude over those
rows and re-aggregates the affected dates so daily_scores stays consistent.

Dry run by default:

    python scripts/rescore.py            # show what would change
    python scripts/rescore.py --apply    # write scores + re-aggregate
"""

import argparse

from fetch_and_build import (
    CLAUDE_MODEL,
    _get_claude_client,
    _score_one_claude,
    get_supabase,
    reaggregate_dates,
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true",
                        help="write changes (default: dry run)")
    parser.add_argument("--limit", type=int, default=None,
                        help="max rows to rescore")
    args = parser.parse_args()

    claude = _get_claude_client()
    if claude is None:
        raise SystemExit("ANTHROPIC_API_KEY (and the anthropic package) are required to rescore.")

    sb = get_supabase()
    query = (
        sb.table("headlines")
        .select("id,title,summary,date,score")
        .eq("scored_by", "vader")
        .order("id")
    )
    if args.limit:
        query = query.limit(args.limit)
    rows = query.execute().data or []
    if not rows:
        print("No vader-scored rows found — nothing to do.")
        return

    mode = "" if args.apply else " (dry run)"
    print(f"Rescoring {len(rows)} vader-scored row(s) with {CLAUDE_MODEL}{mode}")

    dates_touched: set[str] = set()
    failed = 0
    for row in rows:
        text = row["title"]
        if row.get("summary"):
            text = f"{text}. {row['summary']}"
        new_score = _score_one_claude(claude, text)
        if new_score is None:
            failed += 1
            continue
        print(f"  #{row['id']} {row['date']}  {row['score']:+.3f} -> {new_score:+.3f}  {row['title'][:70]}")
        if args.apply:
            sb.table("headlines").update(
                {"score": round(new_score, 4), "scored_by": CLAUDE_MODEL}
            ).eq("id", row["id"]).execute()
            dates_touched.add(row["date"])

    if failed:
        print(f"{failed} row(s) failed to score and were left as-is")
    if args.apply and dates_touched:
        print(f"Re-aggregating {len(dates_touched)} date(s)")
        reaggregate_dates(sb, dates_touched)
    elif not args.apply:
        print("Dry run complete — pass --apply to write.")


if __name__ == "__main__":
    main()
