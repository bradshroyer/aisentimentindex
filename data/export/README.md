# AI Sentiment Index — dataset

Every headline behind [sentimentindex.ai](https://sentimentindex.ai) and the daily
index computed from them. Coverage starts 2025-01-01. This folder is regenerated
weekly by [`scripts/export_data.py`](../../scripts/export_data.py); for the live
series use the [API](https://sentimentindex.ai/data).

| File | Rows | What |
|---|---|---|
| `daily_scores.json` | one per day | The index: daily mean, counts, per-outlet breakdown |
| `headlines.csv` | one per headline | Every scored headline |
| `headlines.json` | one per headline | The same rows as a JSON array (one row per line) |

## `headlines.*`

| Field | Type | Meaning |
|---|---|---|
| `id` | int | Stable row id |
| `date` | YYYY-MM-DD | Publication date (UTC) from the feed; ingest date if the feed gave none |
| `timestamp` | ISO 8601 | When the pipeline ingested the row (UTC) — not the publication time |
| `source` | string | Outlet name |
| `title` | string | Headline as published in the outlet's RSS feed |
| `summary` | string / null | Feed summary, when the feed provided one |
| `url` | string / null | Link to the article |
| `score` | float, −1.0 … +1.0 | Stance toward AI: −1 anti-AI, +1 pro-AI. **This is the index input.** |
| `score_raw` | float, −1.0 … +1.0 | VADER compound score for the same text, kept for comparison |
| `scored_by` | string / null | Model that produced `score` (e.g. `claude-haiku-5-5`); `vader` for lexicon fallback rows |
| `about_ai` | bool / null | `false` = the scorer judged AI incidental to the story; these rows are **excluded from the index**. `null` = not judged, counted as relevant |

`score` measures *stance toward AI*, not the tone of the words: "Anthropic Wins Court
Order Pausing Ban" is positive. Title and summary are scored together.

## `daily_scores.json`

| Field | Type | Meaning |
|---|---|---|
| `date` | YYYY-MM-DD | Day |
| `mean` | float | Mean `score` over the day's on-topic headlines from active outlets |
| `count` | int | Headlines in the mean |
| `pos` / `neg` / `neu` | int | Headlines above +0.05, below −0.05, in between |
| `sources` | string[] | Outlets with at least one headline that day |
| `by_source` | object | Per outlet: `{ "mean": float, "count": int }` |

## Things to know before using it

- **Headline-weighted.** Every headline counts once, so outlets that publish more
  move the daily mean more. Use `by_source` for a volume-neutral view.
- **Retired outlets.** VentureBeat AI rows (through 2026-09-03) are in `headlines.*`
  but are not part of `daily_scores` — its feed froze and the outlet was removed
  from the index. To reproduce the index, drop that source and rows with
  `about_ai = false`.
- **One model's judgment.** Each score is a single LLM reading. Aggregates are more
  trustworthy than any individual row.
- **No backfill.** RSS feeds keep about a week of history; a missed ingestion window
  is gone for good, so a few days are thinner than their neighbours.
- **Rescoring.** When the scoring model changes, the full history is rescored so
  the series has no seam. `scored_by` tells you which model produced each row.

Full methodology: <https://sentimentindex.ai/methodology>

## License and citation

Scores, aggregates and code: MIT. Headline titles and summaries remain the property
of their publishers and are included for research and reference.

> Shroyer, B. AI Sentiment Index: daily media sentiment toward AI. https://sentimentindex.ai
