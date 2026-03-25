#!/usr/bin/env python3
"""Backfill historical AI headlines from GDELT DOC 2.0 API (free, no key needed)."""

import argparse
import calendar
import json
import os
import sys
import time
from datetime import date, datetime, timezone

import subprocess
import urllib.parse

import requests

# Import shared functions from fetch_and_build
sys.path.insert(0, os.path.dirname(__file__) or ".")
from fetch_and_build import (
    is_ai_related,
    load_data,
    save_data,
    score_headlines,
    aggregate_daily,
    generate_html,
    strip_html,
)

PROGRESS_FILE = os.path.join(os.path.dirname(__file__) or ".", "backfill_progress.json")
GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc"
MAX_RECORDS = 250  # GDELT max per request
REQUEST_DELAY = 10  # GDELT rate limit: 1 request per 5 seconds (generous buffer)


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    return {"completed_ranges": []}


def save_progress(progress):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, indent=2)


def generate_week_ranges(from_date, to_date):
    """Generate (start, end) date pairs for each week in the range."""
    start = date.fromisoformat(from_date)
    end = date.fromisoformat(to_date)
    ranges = []
    from datetime import timedelta

    current = start
    while current <= end:
        week_end = min(current + timedelta(days=6), end)
        ranges.append((current.isoformat(), week_end.isoformat()))
        current = week_end + timedelta(days=1)

    return ranges


def fetch_gdelt(from_date, to_date):
    """Fetch articles from GDELT for a date range. Returns list of article dicts."""
    start_dt = from_date.replace("-", "") + "000000"
    end_dt = to_date.replace("-", "") + "235959"

    params = {
        "query": '("artificial intelligence" OR "machine learning" OR "generative AI") sourcelang:english',
        "mode": "ArtList",
        "maxrecords": str(MAX_RECORDS),
        "format": "json",
        "startdatetime": start_dt,
        "enddatetime": end_dt,
        "sort": "DateDesc",
    }

    query_string = urllib.parse.urlencode(params)
    url = f"{GDELT_API}?{query_string}"

    result = subprocess.run(
        ["curl", "-s", "--max-time", "30", url],
        capture_output=True, text=True, timeout=35,
    )

    body = result.stdout.strip()
    if not body:
        return []
    if "Please limit requests" in body:
        raise requests.exceptions.HTTPError(response=type("R", (), {"status_code": 429})())

    data = json.loads(body)
    return data.get("articles", [])


def process_gdelt_articles(articles):
    """Convert GDELT articles to our headline format."""
    headlines = []
    for article in articles:
        title = (article.get("title") or "").strip()
        if not title:
            continue

        # GDELT doesn't provide summaries, so use empty string
        if not is_ai_related(title, ""):
            continue

        seen_date = article.get("seendate", "")
        if seen_date:
            try:
                # Format: 20250108T094500Z
                dt = datetime.strptime(seen_date, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
                date_str = dt.strftime("%Y-%m-%d")
                timestamp = dt.isoformat()
            except (ValueError, AttributeError):
                continue
        else:
            continue

        domain = article.get("domain", "")
        source_name = domain.replace("www.", "").split(".")[0].title() if domain else "Unknown"

        headlines.append({
            "title": title,
            "summary": "",
            "url": article.get("url", ""),
            "source": f"{source_name} (GDELT)",
            "date": date_str,
            "timestamp": timestamp,
            "backfill": True,
        })
    return headlines


def backfill(from_date, to_date):
    data = load_data()
    existing_titles = {h["title"] for h in data["headlines"]}
    progress = load_progress()
    completed = set(tuple(r) for r in progress["completed_ranges"])

    week_ranges = generate_week_ranges(from_date, to_date)
    total_new = 0
    requests_made = 0

    print(f"Backfilling {from_date} to {to_date} ({len(week_ranges)} weeks)")
    print(f"GDELT API: free, no key, ~{REQUEST_DELAY}s between requests\n")

    for range_start, range_end in week_ranges:
        range_key = (range_start, range_end)
        if range_key in completed:
            continue

        print(f"Fetching {range_start} to {range_end}...", end=" ", flush=True)

        if requests_made > 0:
            time.sleep(REQUEST_DELAY)

        try:
            articles = fetch_gdelt(range_start, range_end)
            requests_made += 1
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code == 429:
                print("rate limited, waiting 60s...")
                time.sleep(60)
                try:
                    articles = fetch_gdelt(range_start, range_end)
                    requests_made += 1
                except Exception:
                    print("still failing, skipping")
                    continue
            else:
                print(f"HTTP error: {e}")
                continue
        except Exception as e:
            print(f"error: {e}")
            continue

        headlines = process_gdelt_articles(articles)
        new_headlines = [h for h in headlines if h["title"] not in existing_titles]

        if new_headlines:
            scored = score_headlines(new_headlines)
            data["headlines"].extend(scored)
            for h in scored:
                existing_titles.add(h["title"])
            total_new += len(scored)
            print(f"{len(articles)} articles, {len(scored)} new AI headlines")
        else:
            print(f"{len(articles)} articles, 0 new")

        completed.add(range_key)
        progress["completed_ranges"] = [list(r) for r in sorted(completed)]
        save_progress(progress)

    # Rebuild aggregates and HTML
    if total_new > 0:
        data["daily_scores"] = aggregate_daily(data["headlines"])
        save_data(data)
        generate_html(data)
        print(f"\nDone: added {total_new} backfill headlines")
        print(f"Data now has {len(data['headlines'])} headlines across {len(data['daily_scores'])} days")
    else:
        print("\nNo new headlines added")


def main():
    parser = argparse.ArgumentParser(
        description="Backfill AI headlines from GDELT (free, no API key needed)")
    parser.add_argument("--from", dest="from_date", required=True,
                        help="Start date (YYYY-MM-DD)")
    parser.add_argument("--to", dest="to_date", required=True,
                        help="End date (YYYY-MM-DD)")
    args = parser.parse_args()

    backfill(args.from_date, args.to_date)


if __name__ == "__main__":
    main()
