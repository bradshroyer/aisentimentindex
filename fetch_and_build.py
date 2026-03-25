#!/usr/bin/env python3
"""AI Sentiment Index — fetch RSS headlines, score sentiment, generate static page."""

import json
import os
import time
from datetime import datetime, timezone
from statistics import mean

import feedparser
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RSS_FEEDS = {
    "TechCrunch": "https://techcrunch.com/feed/",
    "NYT Technology": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "The Verge": "https://www.theverge.com/rss/index.xml",
    "Ars Technica": "https://feeds.arstechnica.com/arstechnica/index",
    "Wired": "https://www.wired.com/feed/rss",
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

DATA_FILE = os.path.join(os.path.dirname(__file__) or ".", "data.json")
HTML_FILE = os.path.join(os.path.dirname(__file__) or ".", "index.html")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_ai_related(title: str) -> bool:
    t = f" {title.lower()} "
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


def load_data() -> dict:
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {"headlines": [], "daily_scores": {}}


def save_data(data: dict) -> None:
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

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
                if is_ai_related(title):
                    results.append({
                        "title": title,
                        "source": source,
                        "date": parse_date(entry),
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
        except Exception as e:
            print(f"Warning: failed to fetch {source}: {e}")
    return results

# ---------------------------------------------------------------------------
# Sentiment
# ---------------------------------------------------------------------------

def score_headlines(headlines: list[dict]) -> list[dict]:
    analyzer = SentimentIntensityAnalyzer()
    for h in headlines:
        h["score"] = round(analyzer.polarity_scores(h["title"])["compound"], 4)
    return headlines

# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def aggregate_daily(headlines: list[dict]) -> dict:
    by_day: dict[str, list[float]] = {}
    for h in headlines:
        by_day.setdefault(h["date"], []).append(h["score"])

    daily = {}
    for date, scores in sorted(by_day.items()):
        pos = sum(1 for s in scores if s > 0.05)
        neg = sum(1 for s in scores if s < -0.05)
        neu = len(scores) - pos - neg
        daily[date] = {
            "mean": round(mean(scores), 4),
            "count": len(scores),
            "pos": pos,
            "neg": neg,
            "neu": neu,
        }
    return daily

# ---------------------------------------------------------------------------
# HTML Generation
# ---------------------------------------------------------------------------

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Sentiment Index (Media Tone)</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         max-width: 900px; margin: 0 auto; padding: 2rem 1rem; color: #1a1a1a; background: #fafafa; }}
  h1 {{ font-size: 1.6rem; margin-bottom: 0.25rem; }}
  .subtitle {{ color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }}
  .chart-wrap {{ background: #fff; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 2rem; }}
  .stats {{ display: flex; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }}
  .stat {{ background: #fff; border-radius: 8px; padding: 1rem 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
  .stat-value {{ font-size: 1.4rem; font-weight: 700; }}
  .stat-label {{ font-size: 0.8rem; color: #666; }}
  h2 {{ font-size: 1.1rem; margin-bottom: 0.75rem; }}
  table {{ width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
  th, td {{ text-align: left; padding: 0.6rem 0.75rem; font-size: 0.85rem; }}
  th {{ background: #f5f5f5; font-weight: 600; }}
  tr:not(:last-child) td {{ border-bottom: 1px solid #eee; }}
  .pos {{ color: #16a34a; }} .neg {{ color: #dc2626; }} .neu {{ color: #666; }}
  footer {{ margin-top: 2rem; font-size: 0.75rem; color: #999; text-align: center; }}
</style>
</head>
<body>
<h1>AI Sentiment Index (Media Tone)</h1>
<p class="subtitle">Tracking how major tech outlets talk about AI &mdash; updated {updated}</p>

<div class="chart-wrap">
  <canvas id="chart"></canvas>
</div>

<div class="stats">
  <div class="stat"><div class="stat-value">{total_headlines}</div><div class="stat-label">Headlines analyzed</div></div>
  <div class="stat"><div class="stat-value">{days_tracked}</div><div class="stat-label">Days tracked</div></div>
  <div class="stat"><div class="stat-value {current_class}">{current_score}</div><div class="stat-label">Latest score</div></div>
</div>

<h2>Recent Headlines</h2>
<table>
<tr><th>Headline</th><th>Source</th><th>Score</th></tr>
{headline_rows}
</table>

<footer>Data from TechCrunch, NYT, The Verge, Ars Technica, Wired &middot; Sentiment via VADER</footer>

<script>
const ctx = document.getElementById('chart').getContext('2d');
const labels = {dates_json};
const data = {scores_json};

new Chart(ctx, {{
  type: 'line',
  data: {{
    labels,
    datasets: [{{
      label: 'Daily Mean Sentiment',
      data,
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.08)',
      fill: true,
      tension: 0.3,
      pointRadius: 4,
      pointHoverRadius: 6,
    }}]
  }},
  options: {{
    responsive: true,
    plugins: {{
      legend: {{ display: false }},
      tooltip: {{ callbacks: {{ label: item => 'Score: ' + item.parsed.y.toFixed(3) }} }}
    }},
    scales: {{
      y: {{
        min: -1, max: 1,
        title: {{ display: true, text: 'Sentiment (-1 neg / +1 pos)' }},
        grid: {{ color: ctx => ctx.tick.value === 0 ? '#666' : '#eee' }}
      }},
      x: {{ title: {{ display: true, text: 'Date' }} }}
    }}
  }}
}});
</script>
</body>
</html>"""


def generate_html(data: dict) -> None:
    daily = data["daily_scores"]
    dates = sorted(daily.keys())
    scores = [daily[d]["mean"] for d in dates]

    total = sum(daily[d]["count"] for d in dates) if dates else 0
    current = scores[-1] if scores else 0
    current_class = "pos" if current > 0.05 else ("neg" if current < -0.05 else "neu")

    recent = sorted(data["headlines"], key=lambda h: h["timestamp"], reverse=True)[:15]
    rows = []
    for h in recent:
        sc = h["score"]
        cls = "pos" if sc > 0.05 else ("neg" if sc < -0.05 else "neu")
        rows.append(f'<tr><td>{h["title"]}</td><td>{h["source"]}</td><td class="{cls}">{sc:+.3f}</td></tr>')

    html = HTML_TEMPLATE.format(
        updated=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        total_headlines=total,
        days_tracked=len(dates),
        current_score=f"{current:+.3f}",
        current_class=current_class,
        headline_rows="\n".join(rows),
        dates_json=json.dumps(dates),
        scores_json=json.dumps(scores),
    )

    with open(HTML_FILE, "w") as f:
        f.write(html)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    data = load_data()
    existing_titles = {h["title"] for h in data["headlines"]}

    new_headlines = fetch_headlines()
    new_headlines = [h for h in new_headlines if h["title"] not in existing_titles]

    if new_headlines:
        scored = score_headlines(new_headlines)
        data["headlines"].extend(scored)
        print(f"Added {len(scored)} new headlines")
    else:
        print("No new headlines found")

    data["daily_scores"] = aggregate_daily(data["headlines"])
    save_data(data)
    generate_html(data)
    print(f"Generated index.html with {len(data['daily_scores'])} days of data")


if __name__ == "__main__":
    main()
