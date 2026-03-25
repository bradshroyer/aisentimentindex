#!/usr/bin/env python3
"""AI Sentiment Index — fetch RSS headlines, score sentiment, generate static page."""

import json
import os
import re
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

# Domain-specific terms that VADER consistently misscores in tech/AI context.
# Each value is added to VADER's compound score, then clamped to [-1, 1].
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
# Action verbs VADER reads as negative but are positive in tech context
CONTEXT_OVERRIDES = {
    "cuts cost": 0.25, "cuts time": 0.25, "cut cost": 0.25,
    "cuts development": 0.25, "eliminates": 0.2, "disrupts": 0.1,
}

MIN_SOURCES_PER_DAY = 10  # Only chart days with data from this many distinct sources

DATA_FILE = os.path.join(os.path.dirname(__file__) or ".", "data.json")
HTML_FILE = os.path.join(os.path.dirname(__file__) or ".", "index.html")

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
                summary = strip_html(entry.get("summary", ""))
                if is_ai_related(title, summary):
                    results.append({
                        "title": title,
                        "summary": summary,
                        "url": entry.get("link", ""),
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

def domain_adjust(text: str, base_score: float) -> float:
    """Adjust VADER score for AI/tech domain terms it consistently misscores."""
    t = text.lower()
    adjustment = 0.0
    for term, boost in POSITIVE_BOOSTS.items():
        if term in t:
            adjustment += boost
    for term, boost in NEGATIVE_BOOSTS.items():
        if term in t:
            adjustment += boost  # boost is already negative
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
  .filter-bar {{ margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }}
  .filter-bar label {{ font-size: 0.85rem; color: #666; }}
  .filter-bar select {{ padding: 0.4rem 0.6rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; background: #fff; }}
  .range-bar {{ display: flex; gap: 0.35rem; margin-left: auto; }}
  .range-btn {{ padding: 0.3rem 0.7rem; border: 1px solid #ddd; border-radius: 6px;
               font-size: 0.8rem; background: #fff; cursor: pointer; color: #666;
               transition: all 0.15s; }}
  .range-btn:hover {{ border-color: #2563eb; color: #2563eb; }}
  .range-btn.active {{ background: #2563eb; color: #fff; border-color: #2563eb; }}
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
  td a {{ color: #1a1a1a; text-decoration: none; }} td a:hover {{ text-decoration: underline; color: #2563eb; }}
  #showMore {{ display: block; margin: 1rem auto; padding: 0.5rem 1.5rem; background: #2563eb; color: #fff;
               border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }}
  #showMore:hover {{ background: #1d4ed8; }}
  footer {{ margin-top: 2rem; font-size: 0.75rem; color: #999; text-align: center; }}
  footer summary {{ cursor: pointer; }} footer summary:hover {{ color: #666; }}
  .source-list {{ list-style: none; margin-top: 0.5rem; text-align: left; display: inline-block; }}
  .source-list li {{ padding: 0.15rem 0; font-size: 0.75rem; }}
  .source-list a {{ color: #2563eb; text-decoration: none; }} .source-list a:hover {{ text-decoration: underline; }}
</style>
</head>
<body>
<h1>AI Sentiment Index (Media Tone)</h1>
<p class="subtitle">Tracking how major tech outlets talk about AI &mdash; updated {updated}</p>

<div class="filter-bar">
  <label for="sourceFilter">Filter by source:</label>
  <select id="sourceFilter">
    <option value="All">All Sources</option>
{source_options}
  </select>
  <div class="range-bar">
    <button class="range-btn" data-days="7">1W</button>
    <button class="range-btn active" data-days="30">1M</button>
    <button class="range-btn" data-days="90">3M</button>
    <button class="range-btn" data-days="180">6M</button>
    <button class="range-btn" data-days="365">1Y</button>
    <button class="range-btn" data-days="0">All</button>
  </div>
</div>

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
<thead><tr><th>Headline</th><th>Source</th><th>Score</th></tr></thead>
<tbody id="headlineBody"></tbody>
</table>
<button id="showMore" style="display:none;">Show more</button>

<footer>
  <details>
    <summary>Data from {source_count} sources &middot; Sentiment via VADER + domain adjustments</summary>
    <ul class="source-list">
{source_list_items}
    </ul>
  </details>
</footer>

<script>
const allHeadlines = {headlines_json};
const dailyScores = {daily_scores_json};
const dailyBySource = {daily_by_source_json};
const MIN_SOURCES = {min_sources};
const PAGE_SIZE = 25;
let currentPage = 0;
let currentRange = 30;

function scoreClass(s) {{
  return s > 0.05 ? 'pos' : (s < -0.05 ? 'neg' : 'neu');
}}

function escapeHtml(t) {{
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}}

function renderHeadlines(filtered) {{
  const tbody = document.getElementById('headlineBody');
  tbody.innerHTML = '';
  const end = Math.min((currentPage + 1) * PAGE_SIZE, filtered.length);
  for (let i = 0; i < end; i++) {{
    const h = filtered[i];
    const cls = scoreClass(h.score);
    const sign = h.score > 0 ? '+' : '';
    const title = escapeHtml(h.title);
    const titleCell = h.url
      ? '<a href="' + escapeHtml(h.url) + '" target="_blank" rel="noopener">' + title + '</a>'
      : title;
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + titleCell + '</td><td>' + escapeHtml(h.source) + '</td><td class="' + cls + '">' + sign + h.score.toFixed(3) + '</td>';
    tbody.appendChild(tr);
  }}
  document.getElementById('showMore').style.display = end < filtered.length ? 'block' : 'none';
}}

function getFilteredHeadlines() {{
  const src = document.getElementById('sourceFilter').value;
  return src === 'All' ? allHeadlines : allHeadlines.filter(function(h) {{ return h.source === src; }});
}}

function getChartData(source, rangeDays) {{
  const dates = Object.keys(dailyScores).sort();
  const allDates = [];
  const sentimentData = [];
  const countData = [];
  for (let i = 0; i < dates.length; i++) {{
    const d = dates[i];
    const ds = dailyScores[d];
    if (source === 'All') {{
      if ((ds.sources || []).length >= MIN_SOURCES) {{
        allDates.push(d);
        sentimentData.push(ds.mean);
        countData.push(ds.count || 0);
      }}
    }} else {{
      const srcData = (dailyBySource[d] || {{}})[source];
      if (srcData) {{
        allDates.push(d);
        sentimentData.push(srcData.mean);
        countData.push(srcData.count || 0);
      }}
    }}
  }}
  if (rangeDays > 0 && allDates.length > 0) {{
    const last = new Date(allDates[allDates.length - 1]);
    const cutoff = new Date(last);
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const startIdx = allDates.findIndex(function(d) {{ return d >= cutoffStr; }});
    if (startIdx > 0) {{
      return {{
        labels: allDates.slice(startIdx),
        sentiment: sentimentData.slice(startIdx),
        counts: countData.slice(startIdx)
      }};
    }}
  }}
  return {{ labels: allDates, sentiment: sentimentData, counts: countData }};
}}

const ctx = document.getElementById('chart').getContext('2d');
const initial = getChartData('All', currentRange);

const chart = new Chart(ctx, {{
  type: 'line',
  data: {{
    labels: initial.labels,
    datasets: [
      {{
        label: 'Headlines',
        type: 'bar',
        data: initial.counts,
        backgroundColor: 'rgba(209,213,219,0.4)',
        borderColor: 'rgba(209,213,219,0.6)',
        borderWidth: 1,
        yAxisID: 'y1',
        order: 2,
      }},
      {{
        label: 'Sentiment',
        data: initial.sentiment,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
        yAxisID: 'y',
        order: 1,
      }}
    ]
  }},
  options: {{
    responsive: true,
    plugins: {{
      legend: {{ display: true, position: 'top', labels: {{ usePointStyle: true, boxWidth: 8, font: {{ size: 11 }} }} }},
      tooltip: {{ callbacks: {{ label: function(item) {{
        if (item.dataset.type === 'bar') return item.dataset.label + ': ' + item.parsed.y;
        return item.dataset.label + ': ' + item.parsed.y.toFixed(3);
      }} }} }}
    }},
    scales: {{
      y: {{
        min: -1, max: 1,
        position: 'left',
        title: {{ display: true, text: 'Sentiment (-1 neg / +1 pos)' }},
        grid: {{ color: function(ctx) {{ return ctx.tick.value === 0 ? '#666' : '#eee'; }} }}
      }},
      y1: {{
        position: 'right',
        beginAtZero: true,
        title: {{ display: true, text: 'Headlines', font: {{ size: 11 }} }},
        grid: {{ drawOnChartArea: false }},
        ticks: {{ precision: 0 }}
      }},
      x: {{ title: {{ display: true, text: 'Date' }} }}
    }}
  }}
}});

function updateChart() {{
  const source = document.getElementById('sourceFilter').value;
  const chartData = getChartData(source, currentRange);
  chart.data.labels = chartData.labels;
  chart.data.datasets[0].data = chartData.counts;
  chart.data.datasets[1].data = chartData.sentiment;
  chart.update();
}}

document.getElementById('sourceFilter').addEventListener('change', function() {{
  updateChart();
  currentPage = 0;
  renderHeadlines(getFilteredHeadlines());
}});

document.querySelectorAll('.range-btn').forEach(function(btn) {{
  btn.addEventListener('click', function() {{
    document.querySelectorAll('.range-btn').forEach(function(b) {{ b.classList.remove('active'); }});
    btn.classList.add('active');
    currentRange = parseInt(btn.getAttribute('data-days'));
    updateChart();
  }});
}});

document.getElementById('showMore').addEventListener('click', function() {{
  currentPage++;
  renderHeadlines(getFilteredHeadlines());
}});

renderHeadlines(allHeadlines);
</script>
</body>
</html>"""


def generate_html(data: dict) -> None:
    daily = data["daily_scores"]
    all_dates = sorted(daily.keys())

    # Chart data filtered by minimum source threshold
    chart_dates = [d for d in all_dates if len(daily[d].get("sources", [])) >= MIN_SOURCES_PER_DAY]
    chart_scores = [daily[d]["mean"] for d in chart_dates]

    total = sum(daily[d]["count"] for d in all_dates) if all_dates else 0
    current = chart_scores[-1] if chart_scores else 0
    current_class = "pos" if current > 0.05 else ("neg" if current < -0.05 else "neu")

    # All headlines for client-side rendering
    all_headlines = sorted(data["headlines"], key=lambda h: h["timestamp"], reverse=True)
    headlines_for_js = [
        {"title": h["title"], "url": h.get("url", ""), "source": h["source"],
         "date": h["date"], "score": h["score"]}
        for h in all_headlines
    ]

    # Per-day per-source breakdown for JS chart filtering
    daily_by_source = {}
    for date in all_dates:
        entry = daily[date]
        day_data = {"All": {"mean": entry["mean"], "count": entry["count"]}}
        for src, stats in entry.get("by_source", {}).items():
            day_data[src] = stats
        daily_by_source[date] = day_data

    # Daily scores for JS (with source lists for threshold filtering)
    daily_scores_for_js = {
        d: {"mean": daily[d]["mean"], "count": daily[d]["count"],
            "sources": daily[d].get("sources", [])}
        for d in all_dates
    }

    # Source dropdown options
    source_names = sorted(RSS_FEEDS.keys())
    source_options = "\n".join(f'    <option value="{name}">{name}</option>' for name in source_names)

    # Footer source list
    source_items = []
    for name in sorted(RSS_FEEDS.keys()):
        url = RSS_FEEDS[name]
        source_items.append(f'      <li>{name}</li>')
    source_list_items = "\n".join(source_items)

    # Sanitize JSON to prevent </script> injection
    def safe_json(obj):
        return json.dumps(obj).replace("</", "<\\/")

    html = HTML_TEMPLATE.format(
        updated=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        total_headlines=total,
        days_tracked=len(chart_dates),
        current_score=f"{current:+.3f}",
        current_class=current_class,
        source_options=source_options,
        headlines_json=safe_json(headlines_for_js),
        daily_scores_json=safe_json(daily_scores_for_js),
        daily_by_source_json=safe_json(daily_by_source),
        min_sources=MIN_SOURCES_PER_DAY,
        source_count=len(RSS_FEEDS),
        source_list_items=source_list_items,
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
