# AI Sentiment Index: 60% → 95% Quality Plan

## Context

The site works — data flows, chart renders, interactions exist. But it feels like a prototype, not a product. The chart (the whole point) is undersized and under-utilized. Rich data fields (`pos`, `neg`, `neu`, `by_source`, `summary`) are fetched but never shown. There are no trend indicators, no explainability, no "so what?" layer. The layout wastes space at wider viewports.

The good news: **most of the data needed for a 95% site is already in the client**. This is mostly a frontend presentation problem.

---

## Tier 1 — Make the Chart the Hero (Day 1, 60% → 75%)

### 1a. Widen layout + make chart taller
- **File:** `app/page.tsx`
- Change `max-w-6xl` → `max-w-[1400px]`
- **File:** `components/SentimentChart.tsx`
- Increase chart height from `h-[380px]` → `h-[500px]` (desktop), keep responsive
- Increase container `min-h-[420px]` → `min-h-[540px]`
- **Complexity:** S

### 1b. Replace gray bars with stacked positive/negative bars
- **File:** `components/SentimentChart.tsx`
- Currently: single gray bar dataset using `count`
- Change to: two bar datasets — green (`pos`) and red (`neg`) — stacked
- Data already available in `DailyScore.pos` and `DailyScore.neg`
- Configure `options.scales.y1.stacked: true` and set stack groups
- Color: green `rgba(22, 163, 74, 0.5)` / red `rgba(220, 38, 38, 0.4)`
- This immediately tells the story of "what kind of coverage" each day had
- **Complexity:** S

### 1c. Add 7-day moving average line
- **File:** `components/Dashboard.tsx` (compute) + `components/SentimentChart.tsx` (render)
- Simple sliding window average over `dailyScores[].mean`
- Render as a dashed, thinner line on the same left y-axis
- Color: lighter blue or gray, `borderDash: [6, 3]`, `borderWidth: 1.5`
- Helps users see the trend vs daily noise
- **Complexity:** S

### 1d. Better x-axis date formatting
- **File:** `components/SentimentChart.tsx`
- Change from full `YYYY-MM-DD` at 45° to `Mar 1`, `Mar 2` format
- Reduce rotation to 0° when space allows (auto-skip)
- Use `maxRotation: 45, autoSkip: true, maxTicksLimit: ~20`
- **Complexity:** S

### 1e. Enrich StatsBar with trends
- **File:** `components/StatsBar.tsx` + `components/Dashboard.tsx`
- Add to Dashboard: compute `dayOverDayDelta` (today's mean - yesterday's mean) and `weekOverWeekDelta` (avg of last 7d - avg of prior 7d)
- Pass these as new props to StatsBar
- Display: arrow icon (up/down) + percentage change next to "Latest score"
- Add a 4th stat card: "Sources today" showing count from latest `sources[]` array
- Use green/red coloring on deltas
- **Complexity:** S-M

### 1f. Add chart interaction hint
- **File:** `components/SentimentChart.tsx`
- Below the chart (when no day is selected): subtle text "Click a data point to explore that day's headlines"
- Disappears once user clicks a day
- **Complexity:** S

---

## Tier 2 — Explainability Panel (Day 2, 75% → 85%)

### 2a. Day Detail panel (new component)
- **New file:** `components/DayDetail.tsx`
- Appears between chart and headlines when a day is clicked (replaces/enhances the current "Showing headlines for [date]" text)
- **Content (all from existing data):**
  - Date header with overall score + delta from previous day
  - Horizontal bar showing pos/neg/neu distribution (from `DailyScore.pos`, `.neg`, `.neu`)
  - Source breakdown grid: each source's score from `by_source` as small colored cards
  - Top 3 most positive + top 3 most negative headlines (sorted from filtered headlines array)
- Slides in with a CSS transition
- "Close" button clears `selectedDate`
- **File also touched:** `components/Dashboard.tsx` (render DayDetail, pass props)
- **Complexity:** M

### 2b. Enhanced Chart.js tooltip
- **File:** `components/SentimentChart.tsx`
- Custom tooltip callback showing:
  - Date (formatted nicely)
  - Score with +/- and color
  - Delta from previous day
  - `X positive, Y negative, Z neutral headlines`
  - Number of sources that day
- **Complexity:** S

### 2c. Trend summary sentence
- **File:** `components/Dashboard.tsx` or new inline in FilterBar area
- Computed text: "Sentiment is **up 12%** this week across **14 sources**" or "Sentiment **dropped** this week, driven by negative coverage from Bloomberg"
- Logic: compare last-7-day avg to prior-7-day avg, identify which source contributed most to the shift via `by_source` deltas
- Display near the header/filter area as a subtle insight line
- **Complexity:** M

---

## Tier 3 — Polish (Day 3, 85% → 92%)

### 3a. Card-based headlines when date-filtered
- **File:** `components/HeadlinesTable.tsx`
- When `selectedDate` is set, switch from table rows to cards
- Show the `summary` field (currently fetched but never rendered!)
- Card layout: headline title, source badge, score pill, summary snippet
- Keep table view for the unfiltered "Recent Headlines" mode
- **Complexity:** M

### 3b. Mobile responsiveness pass
- **Files:** `components/FilterBar.tsx`, `components/SentimentChart.tsx`, `components/HeadlinesTable.tsx`
- FilterBar: stack source dropdown above range buttons on mobile
- Chart: reduce height to `h-[280px]` on mobile via responsive class
- Headlines table: hide SOURCE column on `sm:` breakpoint, show as subtitle under headline
- StatsBar: 2x2 grid on mobile instead of single row
- **Complexity:** M

### 3c. Visual polish
- **Files:** various components
- Smooth transition on DayDetail panel appearance (`transition-all duration-300`)
- Chart point animation on hover
- Subtle gradient background on chart area (very light)
- Improve footer: link to sources, show methodology expandable section
- **Complexity:** S

---

## Tier 4 — Future (Backlog, 92% → 95%+)

- **Dark mode** — add `dark:` variants to all Tailwind classes, toggle in header
- **Shareable URLs** — encode `selectedDate`, `selectedSource`, `selectedRange` in URL search params via `useSearchParams`
- **Sentiment spike alerts** — email notification when daily score crosses threshold
- **Source comparison view** — side-by-side chart of two sources' sentiment over time
- **Better NLP** — fine-tuned transformer model replacing VADER

---

## Key Principle: Don't Add Complexity, Add Clarity

The site should stay simple. The recommendations above don't add pages, routes, or new data sources. They surface data that's already loaded but hidden. The chart gets bigger and tells a richer story. The stats tell you "so what." The day detail panel answers "why."

Width expansion to ~1400px is the right call — the chart IS the product. Give it room to breathe.

---

## Files to Modify (Priority Order)

1. `app/page.tsx` — widen container (1 line change)
2. `components/SentimentChart.tsx` — chart height, stacked bars, MA line, date format, tooltip, hint
3. `components/Dashboard.tsx` — compute trends, MA data, wire DayDetail
4. `components/StatsBar.tsx` — trend deltas, additional stat card
5. `components/DayDetail.tsx` — new explainability panel
6. `components/HeadlinesTable.tsx` — card mode for date-filtered view, mobile
7. `components/FilterBar.tsx` — mobile stacking, trend sentence
8. `app/globals.css` — any new theme tokens

## New Dependencies

- `chartjs-plugin-annotation` (optional, for sentiment zone bands on chart — can skip if keeping it lean)

## Verification

After each tier:
- `npm run dev` and visually verify at mobile (375px), tablet (768px), desktop (1280px), wide (1440px)
- Click chart data points to verify drill-down flow
- Check all 6 time ranges + source filter combinations
- Verify "All Sources" vs individual source views
- Check stacked bar math: `pos + neg + neu` should roughly equal `count`
