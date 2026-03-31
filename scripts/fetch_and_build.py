#!/usr/bin/env python3
"""AI Sentiment Index — fetch RSS headlines, score sentiment, write to Supabase."""

import json
import os
import re
import time
from datetime import datetime, timezone
from statistics import mean

import feedparser
from dotenv import load_dotenv
from supabase import create_client
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RSS_FEEDS = {
    "TechCrunch": "https://techcrunch.com/feed/",
    "NYT Technology": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "The Verge": "https://www.theverge.com/rss/index.xml",
    "Ars Technica": "https://feeds.arstechnica.com/arstechnica/index",
    "Wired": "https://www.wired.com/feed/rss",
    "BBC Technology": "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "The Guardian": "https://www.theguardian.com/technology/rss",
    "MIT Tech Review": "https://www.technologyreview.com/feed/",
    "Bloomberg": "https://feeds.bloomberg.com/technology/news.rss",
    "ZDNet AI": "https://www.zdnet.com/topic/artificial-intelligence/rss.xml",
    "VentureBeat AI": "https://feeds.feedburner.com/venturebeat/SZYF",
    "CNBC Tech": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910",
    "NPR Technology": "https://feeds.npr.org/1019/rss.xml",
    "Fox News Tech": "https://moxie.foxnews.com/google-publisher/tech.xml",
}

AI_KEYWORDS = [
    "artificial intelligence", " ai ", " ai,", " ai.", " ai:", " ai'",
    " ai\u2019", "ai-powered", "ai-generated", "ai-driven",
    "chatgpt", "openai", "claude", "anthropic", "gemini", "gpt-",
    "llm", "large language model", "machine learning", "deep learning",
    "neural network", "generative ai", "gen ai", "copilot",
    "midjourney", "stable diffusion", "dall-e", "deepfake", "deepmind",
    "ai model", "ai startup", "ai regulation", "ai safety",
    "foundation model", "transformer model",
]

POSITIVE_BOOSTS = {
    "breakthrough": 0.3, "discovery": 0.25, "innovation": 0.2,
    "enables": 0.2, "empower": 0.2, "revolutioniz": 0.2,
    "adoption": 0.15, "advance": 0.15, "improve": 0.15,
    "boost": 0.15, "transform": 0.15, "solve": 0.15,
    "open source": 0.1, "open-source": 0.1,
}
NEGATIVE_BOOSTS = {
    "hype": -0.2, "bubble": -0.25, "overhyped": -0.3,
    "threat": -0.15, "replace jobs": -0.2, "job loss": -0.25,
    "surveillance": -0.2, "lawsuit": -0.2, "sued": -0.2,
    "ban": -0.15, "restrict": -0.1,
    "existential risk": -0.35, "existential crisis": -0.35,
    "existential threat": -0.35, "extinction": -0.35,
    "catastrophic": -0.3, "apocalyp": -0.3, "doomsday": -0.3,
    "superintelligence": -0.15,
    "hallucinate": -0.15, "hallucination": -0.15, "bias": -0.15,
}
CONTEXT_OVERRIDES = {
    "cuts cost": 0.25, "cuts time": 0.25, "cut cost": 0.25,
    "cuts development": 0.25, "eliminates": 0.2, "disrupts": 0.1,
}

DATA_START_DATE = "2026-02-28"

# Supabase connection
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def is_ai_related(title: str, summary: str = "") -> bool:
    t = f" {title.lower()} {summary.lower()} "
    return any(kw in t for kw in AI_KEYWORDS)


def parse_date(entry) -> str:
    for field in ("published_parsed", "updated_parsed"):
        parsed = entry.get(field)
        if parsed:
            try:
                return time.strftime("%Y-%m-%d", parsed)
            except Exception:
                pass
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Fetch & Filter
# ---------------------------------------------------------------------------

def fetch_headlines() -> list[dict]:
    seen_titles: set[str] = set()
    results = []
    for source, url in RSS_FEEDS.items():
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries:
                title = entry.get("title", "").strip()
                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)
                summary = strip_html(entry.get("summary", ""))
                date = parse_date(entry)
                if date < DATA_START_DATE:
                    continue
                if is_ai_related(title, summary):
                    results.append({
                        "title": title,
                        "summary": summary,
                        "url": entry.get("link", ""),
                        "source": source,
                        "date": date,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
        except Exception as e:
            print(f"Warning: failed to fetch {source}: {e}")
    return results


# ---------------------------------------------------------------------------
# Sentiment
# ---------------------------------------------------------------------------

def domain_adjust(text: str, base_score: float) -> float:
    t = text.lower()
    adjustment = 0.0
    for term, boost in POSITIVE_BOOSTS.items():
        if term in t:
            adjustment += boost
    for term, boost in NEGATIVE_BOOSTS.items():
        if term in t:
            adjustment += boost
    for term, boost in CONTEXT_OVERRIDES.items():
        if term in t:
            adjustment += boost
    adjusted = base_score + adjustment
    return max(-1.0, min(1.0, adjusted))


def score_headlines(headlines: list[dict]) -> list[dict]:
    analyzer = SentimentIntensityAnalyzer()
    for h in headlines:
        text = h["title"]
        if h.get("summary"):
            text = f"{text}. {h['summary']}"
        base = analyzer.polarity_scores(text)["compound"]
        h["score_raw"] = round(base, 4)
        h["score"] = round(domain_adjust(text, base), 4)
    return headlines


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def aggregate_daily(headlines: list[dict]) -> dict:
    by_day: dict[str, list[dict]] = {}
    for h in headlines:
        by_day.setdefault(h["date"], []).append(h)

    daily = {}
    for date, day_headlines in sorted(by_day.items()):
        scores = [h["score"] for h in day_headlines]
        pos = sum(1 for s in scores if s > 0.05)
        neg = sum(1 for s in scores if s < -0.05)
        neu = len(scores) - pos - neg
        sources = sorted(set(h["source"] for h in day_headlines))

        by_source: dict[str, list[float]] = {}
        for h in day_headlines:
            by_source.setdefault(h["source"], []).append(h["score"])
        source_stats = {}
        for src, src_scores in by_source.items():
            source_stats[src] = {
                "mean": round(mean(src_scores), 4),
                "count": len(src_scores),
            }

        daily[date] = {
            "mean": round(mean(scores), 4),
            "count": len(scores),
            "pos": pos,
            "neg": neg,
            "neu": neu,
            "sources": sources,
            "by_source": source_stats,
        }
    return daily


# ---------------------------------------------------------------------------
# Supabase writes
# ---------------------------------------------------------------------------

def upsert_headlines(sb, headlines: list[dict]) -> int:
    """Upsert headlines to Supabase. Returns count of rows upserted."""
    if not headlines:
        return 0

    batch_size = 500
    total = 0

    for i in range(0, len(headlines), batch_size):
        batch = headlines[i : i + batch_size]
        rows = [
            {
                "title": h["title"],
                "summary": h.get("summary", ""),
                "url": h.get("url", ""),
                "source": h["source"],
                "date": h["date"],
                "timestamp": h["timestamp"],
                "score_raw": h.get("score_raw", h["score"]),
                "score": h["score"],
            }
            for h in batch
        ]
        result = sb.table("headlines").upsert(
            rows, on_conflict="title,source,date"
        ).execute()
        total += len(result.data) if result.data else 0

    return total


def upsert_daily_scores(sb, daily: dict) -> int:
    """Upsert daily score aggregates to Supabase. Returns count of rows upserted."""
    rows = [
        {
            "date": date,
            "mean": scores["mean"],
            "count": scores["count"],
            "pos": scores["pos"],
            "neg": scores["neg"],
            "neu": scores["neu"],
            "sources": json.dumps(scores.get("sources", [])),
            "by_source": json.dumps(scores.get("by_source", {})),
        }
        for date, scores in daily.items()
    ]
    result = sb.table("daily_scores").upsert(rows, on_conflict="date").execute()
    return len(result.data) if result.data else 0


def load_existing_titles(sb) -> set[str]:
    """Load all existing headline titles from Supabase for dedup."""
    titles = set()
    # Paginate through all headlines (1000 at a time)
    offset = 0
    page_size = 1000
    while True:
        result = sb.table("headlines").select("title").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        for row in result.data:
            titles.add(row["title"])
        if len(result.data) < page_size:
            break
        offset += page_size
    return titles


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    sb = get_supabase()

    existing_titles = load_existing_titles(sb)
    print(f"Existing headlines in Supabase: {len(existing_titles)}")

    new_headlines = fetch_headlines()
    new_headlines = [h for h in new_headlines if h["title"] not in existing_titles]

    if new_headlines:
        scored = score_headlines(new_headlines)
        count = upsert_headlines(sb, scored)
        print(f"Added {count} new headlines to Supabase")
    else:
        print("No new headlines found")

    # Re-aggregate from all headlines in Supabase
    # Fetch all headlines to compute daily aggregates
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

    print(f"Total headlines in Supabase: {len(all_headlines)}")

    daily = aggregate_daily(all_headlines)
    count = upsert_daily_scores(sb, daily)
    print(f"Updated {count} daily score entries in Supabase")


if __name__ == "__main__":
    main()
