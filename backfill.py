#!/usr/bin/env python3
"""Backfill historical AI headlines from NewsData.io archive API."""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import requests

# Load .env file if present (so API key persists across runs)
_env_path = os.path.join(os.path.dirname(__file__) or ".", ".env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _val = _line.split("=", 1)
                os.environ.setdefault(_key.strip(), _val.strip())

# Import shared functions from fetch_and_build
sys.path.insert(0, os.path.dirname(__file__) or ".")
from fetch_and_build import (
    DATA_FILE,
    is_ai_related,
    load_data,
    save_data,
    score_headlines,
    aggregate_daily,
    generate_html,
    strip_html,
)

PROGRESS_FILE = os.path.join(os.path.dirname(__file__) or ".", "backfill_progress.json")
API_BASE = "https://newsdata.io/api/1/archive"
CREDITS_PER_DAY = 200  # Free tier limit


def load_progress() -> dict:
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed_ranges": [], "credits_used_today": 0, "last_reset": ""}


def save_progress(progress: dict) -> None:
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


def reset_daily_credits(progress: dict) -> dict:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if progress.get("last_reset") != today:
        progress["credits_used_today"] = 0
        progress["last_reset"] = today
    return progress


def fetch_page(api_key: str, from_date: str, to_date: str, page=None) -> dict:
    """Fetch one page of results from NewsData.io archive API."""
    params = {
        "apikey": api_key,
        "q": '"artificial intelligence" OR AI',
        "category": "technology,science",
        "language": "en",
        "from_date": from_date,
        "to_date": to_date,
    }
    if page:
        params["page"] = page

    resp = requests.get(API_BASE, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def process_results(results: list[dict]) -> list[dict]:
    """Convert NewsData.io results to our headline format."""
    headlines = []
    for article in results:
        title = (article.get("title") or "").strip()
        if not title:
            continue
        summary = strip_html(article.get("description") or "")
        if not is_ai_related(title, summary):
            continue

        pub_date = article.get("pubDate", "")
        if pub_date:
            try:
                dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                date_str = dt.strftime("%Y-%m-%d")
                timestamp = dt.isoformat()
            except (ValueError, AttributeError):
                date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                timestamp = datetime.now(timezone.utc).isoformat()
        else:
            date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            timestamp = datetime.now(timezone.utc).isoformat()

        headlines.append({
            "title": title,
            "summary": summary,
            "url": article.get("link", ""),
            "source": article.get("source_name", article.get("source_id", "Unknown")),
            "date": date_str,
            "timestamp": timestamp,
            "backfill": True,
        })
    return headlines


def generate_month_ranges(from_date: str, to_date: str) -> list[tuple[str, str]]:
    """Generate (start, end) date pairs for each month in the range."""
    from datetime import date
    import calendar

    start = date.fromisoformat(from_date)
    end = date.fromisoformat(to_date)
    ranges = []

    current = start.replace(day=1)
    while current <= end:
        month_end_day = calendar.monthrange(current.year, current.month)[1]
        month_end = current.replace(day=month_end_day)
        range_start = max(current, start)
        range_end = min(month_end, end)
        ranges.append((range_start.isoformat(), range_end.isoformat()))

        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)

    return ranges


def backfill(api_key: str, from_date: str, to_date: str):
    data = load_data()
    existing_titles = {h["title"] for h in data["headlines"]}
    progress = load_progress()
    progress = reset_daily_credits(progress)
    completed = set(tuple(r) for r in progress["completed_ranges"])

    month_ranges = generate_month_ranges(from_date, to_date)
    total_new = 0

    for range_start, range_end in month_ranges:
        range_key = (range_start, range_end)
        if range_key in completed:
            print(f"Skipping {range_start} to {range_end} (already completed)")
            continue

        if progress["credits_used_today"] >= CREDITS_PER_DAY:
            print(f"Daily credit limit reached ({CREDITS_PER_DAY}). Resume tomorrow.")
            break

        print(f"Fetching {range_start} to {range_end}...")
        page_token = None
        range_new = 0

        while True:
            if progress["credits_used_today"] >= CREDITS_PER_DAY:
                print(f"  Credit limit reached mid-range. Will resume this range next run.")
                save_progress(progress)
                break

            try:
                result = fetch_page(api_key, range_start, range_end, page_token)
                progress["credits_used_today"] += 1
            except requests.exceptions.HTTPError as e:
                if e.response is not None and e.response.status_code == 429:
                    print(f"  Rate limited. Saving progress and stopping.")
                    save_progress(progress)
                    break
                raise
            except Exception as e:
                print(f"  Error: {e}. Skipping page.")
                break

            articles = result.get("results") or []
            if not articles:
                break

            headlines = process_results(articles)
            new_headlines = [h for h in headlines if h["title"] not in existing_titles]

            if new_headlines:
                scored = score_headlines(new_headlines)
                data["headlines"].extend(scored)
                for h in scored:
                    existing_titles.add(h["title"])
                range_new += len(scored)

            page_token = result.get("nextPage")
            if not page_token:
                break

            # Brief pause between pages
            time.sleep(0.5)

        if progress["credits_used_today"] < CREDITS_PER_DAY or not page_token:
            completed.add(range_key)
            progress["completed_ranges"] = [list(r) for r in sorted(completed)]

        total_new += range_new
        print(f"  Added {range_new} new headlines from this range")
        save_progress(progress)

    # Rebuild aggregates and HTML
    if total_new > 0:
        data["daily_scores"] = aggregate_daily(data["headlines"])
        save_data(data)
        generate_html(data)
        print(f"\nTotal: added {total_new} backfill headlines")
        print(f"Data now has {len(data['headlines'])} headlines across {len(data['daily_scores'])} days")
    else:
        print("\nNo new headlines added")

    save_progress(progress)
    print(f"Credits used today: {progress['credits_used_today']}/{CREDITS_PER_DAY}")


def main():
    parser = argparse.ArgumentParser(description="Backfill AI headlines from NewsData.io")
    parser.add_argument("--api-key", default=os.environ.get("NEWSDATA_API_KEY"),
                        help="NewsData.io API key (or set NEWSDATA_API_KEY env var)")
    parser.add_argument("--from", dest="from_date", required=True,
                        help="Start date (YYYY-MM-DD)")
    parser.add_argument("--to", dest="to_date", required=True,
                        help="End date (YYYY-MM-DD)")
    args = parser.parse_args()

    if not args.api_key:
        print("Error: provide --api-key or set NEWSDATA_API_KEY environment variable")
        sys.exit(1)

    backfill(args.api_key, args.from_date, args.to_date)


if __name__ == "__main__":
    main()
