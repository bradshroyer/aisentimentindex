# AI Sentiment Index

**Live:** [bradshroyer.github.io/aisentimentindex](https://bradshroyer.github.io/aisentimentindex/)

I was curious: how does the media *actually* feel about AI right now? Not what Twitter thinks, not what VCs are pitching — what are the major outlets writing, and is the overall tone positive or negative?

So I built this. The AI Sentiment Index tracks daily media sentiment about AI across 14 major tech and news outlets, scores each headline, and plots the trend over time.

## How It Works

A Python script runs twice daily via GitHub Actions. It pulls RSS feeds from outlets like TechCrunch, NYT, BBC, Wired, The Verge, MIT Tech Review, and others — 14 sources in total. Each headline and summary is scored using [VADER](https://github.com/cjhutto/vaderSentiment) sentiment analysis with custom domain-specific adjustments (vanilla VADER thinks "AI breakthrough in cancer detection" is negative because of the word "cancer").

The script generates a static HTML page with a Chart.js chart. No backend, no database, no paid APIs. The whole thing runs on GitHub Pages for free.

**Stack:** Python, Chart.js, GitHub Actions, GitHub Pages.

## What You See

- A daily sentiment trend line showing how positive or negative AI coverage is
- Volume bars showing how many headlines were captured each day
- Filter by source to see how individual outlets differ
- Browse the actual headlines that make up each day's score

## Running It Yourself

```bash
pip install -r requirements.txt
python fetch_and_build.py
```

That's it. Opens `index.html` and you've got the latest data.

## What's Next

This project will keep evolving, but the goal is to always stay simple and clean. Some things on the radar:

- Better NLP models as they become cost-effective
- Broader source coverage
- Historical backfill for longer trend analysis
- UI/UX improvements

## Sponsors Welcome

If you find this interesting or useful, I'm looking for sponsors to help cover costs like article backfill (RSS feeds only go back about a week, so building long-term history requires paid data sources) and hosting improvements. Reach out if you'd like to support the project.

## License

MIT
