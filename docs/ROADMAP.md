# Roadmap

Product-evolution ideas surfaced after we backfilled a year of data (2025-01-01 → 2026-04-21, ~22k headlines). Each item below is written as a self-contained brief — paste it into a fresh Claude Code session and it should have everything needed to act.

Ranked by leverage. Pick any one; they're independent.

## Context shared by all items

- Live site: https://labs.bradshroyer.com
- Stack: Next.js 15 App Router → Vercel, Supabase Postgres, Python ingestion scripts
- Key components: [Dashboard.tsx](../components/Dashboard.tsx), [SentimentChart.tsx](../components/SentimentChart.tsx), [FilterBar.tsx](../components/FilterBar.tsx), [StatsBar.tsx](../components/StatsBar.tsx)
- Data layer: [lib/data.ts](../lib/data.ts), [lib/types.ts](../lib/types.ts)
- See [CLAUDE.md](../CLAUDE.md) for architecture + scoring methodology

Signals from the year of data (cite these to anchor decisions):

- Mean sentiment trended from **+0.25 (Apr 2025)** to **+0.04 (Feb 2026)** — a real, gradual souring, with a partial recovery to +0.19 in Mar 2026
- Volume scaling: Q1 2025 averaged 43 headlines/day; Q1 2026 averaged 60; Apr 2026 on pace for 78
- Source stance is stable and large: VentureBeat AI +0.55, TechCrunch +0.36 vs. The Guardian −0.24, NPR Tech −0.14
- Biggest single-day swings: 2025-10-06 +0.76 jump, 2025-08-09 −0.65 drop, 2026-01-10 −0.54 drop
- 7-day rolling volatility has been declining (0.18 mid-2025 → 0.12 Apr 2026)

---

## 3. Range-aware insight headline

**Problem:** The "Sentiment up ~9% this week" line at the top of the chart is hardcoded to weekly comparison. At 1Y scale, the weekly framing feels trivial.

**Proposal:** Make the trend line adapt to `selectedRange`:
- 1W → day-over-day framing
- 1M → week-over-week (current)
- 3M/6M → month-over-month
- 1Y/All → "Down 0.18 over 12 months" + one-line "driven by X shift at Guardian"

**Files:**
- [components/Dashboard.tsx](../components/Dashboard.tsx) — the `trendData` memo and its consumer JSX

**Success criteria:** For every time range, the headline sentence describes something meaningful about that range.

**Watch out for:** Source attribution ("led by Fox News Tech") was a weekly comparison; at month/year scales, re-compute biggest mover over the matching window.

---

## 4. Year-in-review / 12-month delta hero stat

**Problem:** The fact that coverage sentiment fell from +0.25 to +0.04 over 10 months is a genuinely interesting finding, and nothing in the UI surfaces it. The StatsBar shows totals and a latest score but no long-arc narrative.

**Proposal:** Add a hero stat or ribbon above/below the chart:
- "12-month sentiment shift: **−0.16**" with a mini-sparkline
- Or a "Year in review" expandable card with: biggest mover (source), most negative month, most positive month, biggest single day

Alternative framing: a `/year-in-review` page that gets linked from the homepage — this is more work but a better shareable artifact.

**Files:**
- [components/StatsBar.tsx](../components/StatsBar.tsx) — simplest: add a 12-month delta tile
- Or new: `app/year-in-review/page.tsx` for the dedicated page
- [components/Dashboard.tsx](../components/Dashboard.tsx) — pass year-windowed stats down

**Success criteria:** The long-range story ("press got more skeptical of AI over 2025") is visible without any interaction.

**Watch out for:** Don't just add a number — the *why* is what makes it interesting. The curated spike annotations at `data/spike_annotations.json` can anchor the narrative for the 12-month delta.

---

## Nice-to-haves (lower priority)

- **Headlines/day trend chart** — volume is up 80% YoY. Its own small chart would tell that story cleanly.
- **Weekday / weekend effect** — with 476 days, there's enough data to check if sentiment has a day-of-week pattern worth surfacing.
- **Topic tagging** — extend the Claude scoring prompt to return a category (regulation, model-launch, labor, safety, business). Enables topic-filtered views down the line. See [fetch_and_build.py](../scripts/fetch_and_build.py) for the scoring prompt.
- **Moving average period selector** — 7/30/90-day toggle for the MA line.
