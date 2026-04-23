#!/usr/bin/env python3
"""AI Sentiment Index — fetch RSS headlines, score sentiment, write to Supabase."""

import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

import feedparser
from dotenv import load_dotenv
from supabase import create_client
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

try:
    from anthropic import Anthropic
except ImportError:
    Anthropic = None

load_dotenv()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Canonical source list lives in data/sources.json and is shared with the
# frontend (lib/types.ts). Python derives RSS_FEEDS (name→rss) here.
_SOURCES_PATH = Path(__file__).resolve().parent.parent / "data" / "sources.json"
with open(_SOURCES_PATH) as _f:
    SOURCES = json.load(_f)

RSS_FEEDS: dict[str, str] = {s["name"]: s["rss"] for s in SOURCES}

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
    "funding": 0.1, "investment": 0.05, "partnership": 0.1,
    "collaboration": 0.1,
}
NEGATIVE_BOOSTS = {
    "hype": -0.2, "bubble": -0.25, "overhyped": -0.3,
    "threat": -0.15, "replace jobs": -0.2, "job loss": -0.25,
    "surveillance": -0.2, "lawsuit": -0.2, "sued": -0.2,
    "ban": -0.15, "banned": -0.15, "banning": -0.15,
    "restrict": -0.1,
    "existential risk": -0.35, "existential crisis": -0.35,
    "existential threat": -0.35, "extinction": -0.35,
    "catastrophic": -0.3, "apocalyp": -0.3, "doomsday": -0.3,
    "superintelligence": -0.15,
    "hallucinate": -0.15, "hallucination": -0.15, "bias": -0.15,
    "layoff": -0.2, "copyright": -0.15, "plagiarism": -0.2,
    "scraping": -0.1, "deepfake": -0.2,
    "misinformation": -0.2, "disinformation": -0.2,
}
CONTEXT_OVERRIDES = {
    "cuts cost": 0.25, "cuts time": 0.25, "cut cost": 0.25,
    "cuts development": 0.25, "eliminates": 0.2, "disrupts": 0.1,
}

# Terms that need word-boundary matching to avoid substring false positives.
# e.g. "ban" must not match "bank", "hype" must not match "hyperscaler".
_WORD_BOUNDARY_TERMS = {"ban", "banned", "banning", "hype", "bias", "boost", "solve"}

DATA_START_DATE = "2026-02-28"

# Supabase connection
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Claude scoring
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-haiku-4-5-20251001"
CLAUDE_SCORING_PROMPT = """You are a sentiment classifier for AI/tech news headlines.

Given a headline (and optional summary), return a JSON object with:
- "sentiment": float from -1.0 (strongly anti-AI / negative about AI) to +1.0 (strongly pro-AI / positive about AI). 0.0 = neutral.

Scoring guidelines:
- Score the headline's STANCE toward AI, not the emotional valence of the words.
- "Anthropic Wins Court Order Pausing Ban" = POSITIVE for AI (company won), despite negative words like "ban".
- "AI replaces 500 jobs" = NEGATIVE for AI sentiment, even though it shows AI capability.
- Funding, launches, partnerships, breakthroughs = generally positive.
- Bans, lawsuits, safety failures, job losses, regulation = generally negative.
- Neutral reporting or mixed signals = near 0.0.
- Headlines unrelated to AI = 0.0.

Return ONLY valid JSON, no markdown fences."""

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text).strip()


def normalize_text(text: str) -> str:
    """Normalize curly quotes/dashes to ASCII equivalents for deduplication."""
    return (
        text.replace("\u2018", "'").replace("\u2019", "'")   # ' '
        .replace("\u201A", "'").replace("\u201B", "'")       # ‚ ‛
        .replace("\u201C", '"').replace("\u201D", '"')       # " "
        .replace("\u201E", '"').replace("\u201F", '"')       # „ ‟
        .replace("\u2013", "-").replace("\u2014", "--")       # – —
        .strip()
    )


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
                title = normalize_text(entry.get("title", "").strip())
                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)
                summary = normalize_text(strip_html(entry.get("summary", "")))
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

def _term_in_text(term: str, text: str) -> bool:
    """Check if *term* appears in *text*, using word boundaries for short
    terms that are prone to substring false-positives (e.g. 'ban' vs 'bank')."""
    if term in _WORD_BOUNDARY_TERMS:
        return bool(re.search(rf"\b{re.escape(term)}\b", text))
    return term in text


def domain_adjust(text: str, base_score: float) -> float:
    t = text.lower()
    adjustment = 0.0
    for term, boost in POSITIVE_BOOSTS.items():
        if _term_in_text(term, t):
            adjustment += boost
    for term, boost in NEGATIVE_BOOSTS.items():
        if _term_in_text(term, t):
            adjustment += boost
    for term, boost in CONTEXT_OVERRIDES.items():
        if _term_in_text(term, t):
            adjustment += boost
    adjusted = base_score + adjustment
    return max(-1.0, min(1.0, adjusted))


def _get_claude_client():
    """Return an Anthropic client if the SDK and API key are available."""
    if Anthropic is None or not ANTHROPIC_API_KEY:
        return None
    return Anthropic(api_key=ANTHROPIC_API_KEY)


def _score_one_claude(client, text: str, retries: int = 2):
    """Score a single headline with Claude. Returns float or None on failure."""
    for attempt in range(retries + 1):
        try:
            resp = client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=100,
                system=CLAUDE_SCORING_PROMPT,
                messages=[
                    {"role": "user", "content": text},
                    {"role": "assistant", "content": "{"},
                ],
            )
            raw = "{" + resp.content[0].text.strip()
            # Truncate after first complete JSON object
            brace_depth = 0
            for idx, ch in enumerate(raw):
                if ch == "{":
                    brace_depth += 1
                elif ch == "}":
                    brace_depth -= 1
                    if brace_depth == 0:
                        raw = raw[: idx + 1]
                        break
            parsed = json.loads(raw)
            return max(-1.0, min(1.0, float(parsed["sentiment"])))
        except Exception as e:
            if "rate_limit" in str(e) and attempt < retries:
                time.sleep(15)
                continue
            if attempt == retries:
                print(f"  Claude scoring error: {e}")
            return None


def score_headlines(headlines: list[dict]) -> list[dict]:
    analyzer = SentimentIntensityAnalyzer()
    claude = _get_claude_client()

    if claude:
        print(f"Scoring {len(headlines)} headlines with Claude ({CLAUDE_MODEL})...")
    else:
        print(f"Scoring {len(headlines)} headlines with VADER (no ANTHROPIC_API_KEY)...")

    for i, h in enumerate(headlines):
        text = h["title"]
        if h.get("summary"):
            text = f"{text}. {h['summary']}"

        # Always compute VADER as baseline / score_raw
        base = analyzer.polarity_scores(text)["compound"]
        h["score_raw"] = round(base, 4)

        # Use Claude if available, fall back to VADER + domain adjustments.
        # Record which scorer actually produced `score` so we can audit
        # signal origins after model swaps.
        if claude:
            claude_score = _score_one_claude(claude, text)
            if claude_score is not None:
                h["score"] = round(claude_score, 4)
                h["scored_by"] = CLAUDE_MODEL
            else:
                h["score"] = round(domain_adjust(text, base), 4)
                h["scored_by"] = "vader"
            if (i + 1) % 10 == 0:
                print(f"  Scored {i + 1}/{len(headlines)}...")
        else:
            h["score"] = round(domain_adjust(text, base), 4)
            h["scored_by"] = "vader"

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
                "scored_by": h.get("scored_by"),
            }
            for h in batch
        ]
        result = sb.table("headlines").upsert(
            rows, on_conflict="title_normalized,source,date"
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
            "sources": scores.get("sources", []),
            "by_source": scores.get("by_source", {}),
        }
        for date, scores in daily.items()
    ]
    result = sb.table("daily_scores").upsert(rows, on_conflict="date").execute()
    return len(result.data) if result.data else 0


def load_existing_titles(sb) -> set[str]:
    """Load normalized titles from Supabase for dedup. Returns the same form
    that `normalize_text` produces, so callers should normalize before lookup."""
    titles = set()
    # Paginate through all headlines (1000 at a time)
    offset = 0
    page_size = 1000
    while True:
        result = sb.table("headlines").select("title_normalized").range(offset, offset + page_size - 1).execute()
        if not result.data:
            break
        for row in result.data:
            titles.add(row["title_normalized"])
        if len(result.data) < page_size:
            break
        offset += page_size
    return titles


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def reaggregate_dates(sb, dates: set[str]) -> int:
    """Recompute daily_scores for the given dates by fetching their headlines
    from Supabase. Scoped to avoid full-table rebuilds on every ingest run."""
    if not dates:
        return 0
    result = sb.table("headlines").select("*").in_("date", sorted(dates)).execute()
    day_rows = result.data or []
    daily = aggregate_daily(day_rows)
    return upsert_daily_scores(sb, daily)


def main():
    sb = get_supabase()

    existing_titles = load_existing_titles(sb)
    print(f"Existing headlines in Supabase: {len(existing_titles)}")

    new_headlines = fetch_headlines()
    new_headlines = [h for h in new_headlines if h["title"] not in existing_titles]

    dates_touched: set[str] = {h["date"] for h in new_headlines}

    if new_headlines:
        scored = score_headlines(new_headlines)
        count = upsert_headlines(sb, scored)
        print(f"Added {count} new headlines to Supabase")
    else:
        print("No new headlines found")

    if not dates_touched:
        print("No dates changed — skipping re-aggregation")
        return

    print(f"Re-aggregating {len(dates_touched)} date(s): {sorted(dates_touched)}")
    count = reaggregate_dates(sb, dates_touched)
    print(f"Updated {count} daily score entries in Supabase")


if __name__ == "__main__":
    main()
