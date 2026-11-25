import type { DailyScore } from "./types";
import {
  formatMagnitude,
  formatScore,
  joinList,
  longDate,
  monthEnd,
  monthLabel,
  shortDate,
  tone,
  weekday,
} from "./format";

// Aggregation + plain-language summaries behind the crawlable content pages
// (/day/[date], /monthly, /monthly/[month]) and the RSS feed. Everything here
// derives from `daily_scores` — the same rows the chart draws — so a recap can
// never disagree with the dashboard. Means are headline-weighted, matching the
// chart's week/month buckets (lib/bucketing.ts).

export interface SourceRow {
  source: string;
  mean: number;
  count: number;
}

export interface Aggregate {
  mean: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
  /** Per-outlet means over the slice, most positive first. */
  bySource: SourceRow[];
}

/** A day's or outlet's mean needs this many headlines before prose leans on it. */
export const MIN_HEADLINES_FOR_DAY_CALLOUT = 10;
export const MIN_HEADLINES_FOR_SOURCE_CALLOUT = 3;
export const MIN_HEADLINES_FOR_MONTH_SOURCE = 10;

export function aggregate(days: DailyScore[]): Aggregate {
  let count = 0, pos = 0, neg = 0, neu = 0, weighted = 0;
  const src = new Map<string, { weighted: number; count: number }>();

  for (const d of days) {
    count += d.count;
    pos += d.pos;
    neg += d.neg;
    neu += d.neu;
    weighted += d.mean * d.count;
    for (const [name, stats] of Object.entries(d.by_source)) {
      if (!stats || stats.count === 0) continue;
      const a = src.get(name) ?? { weighted: 0, count: 0 };
      a.weighted += stats.mean * stats.count;
      a.count += stats.count;
      src.set(name, a);
    }
  }

  const bySource = [...src.entries()]
    .map(([source, a]) => ({ source, mean: a.weighted / a.count, count: a.count }))
    .sort((a, b) => b.mean - a.mean);

  return { mean: count > 0 ? weighted / count : 0, count, pos, neg, neu, bySource };
}

// ── Months ──

export interface MonthSummary extends Aggregate {
  /** YYYY-MM */
  month: string;
  days: DailyScore[];
  /** Highest / lowest daily mean among days with enough headlines to trust. */
  best: DailyScore | null;
  worst: DailyScore | null;
  /** True for the month still in progress (data doesn't reach its last day). */
  partial: boolean;
}

/** One summary per calendar month in the data, oldest first. */
export function summarizeMonths(dailyScores: DailyScore[]): MonthSummary[] {
  const groups = new Map<string, DailyScore[]>();
  for (const d of dailyScores) {
    const key = d.date.slice(0, 7);
    const arr = groups.get(key);
    if (arr) arr.push(d);
    else groups.set(key, [d]);
  }

  const lastDate = dailyScores[dailyScores.length - 1]?.date ?? "";
  const lastMonth = lastDate.slice(0, 7);

  return [...groups.keys()].sort().map((month) => {
    const days = groups.get(month)!;
    const solid = days.filter((d) => d.count >= MIN_HEADLINES_FOR_DAY_CALLOUT);
    const pool = solid.length >= 2 ? solid : days;
    let best: DailyScore | null = null;
    let worst: DailyScore | null = null;
    for (const d of pool) {
      if (!best || d.mean > best.mean) best = d;
      if (!worst || d.mean < worst.mean) worst = d;
    }
    return {
      month,
      days,
      ...aggregate(days),
      best,
      worst: worst && best && worst.date !== best.date ? worst : null,
      partial: month === lastMonth && lastDate < monthEnd(month),
    };
  });
}

// ── Days ──

export interface DayContext {
  day: DailyScore;
  /** Adjacent days that have data (gaps in ingestion are skipped over). */
  prev: DailyScore | null;
  next: DailyScore | null;
  /** Headline-weighted mean of the 30 days of data before this one. */
  trailing: { mean: number; days: number } | null;
}

export function dayContext(dailyScores: DailyScore[], date: string): DayContext | null {
  const i = dailyScores.findIndex((d) => d.date === date);
  if (i === -1) return null;
  const before = dailyScores.slice(Math.max(0, i - 30), i);
  return {
    day: dailyScores[i],
    prev: i > 0 ? dailyScores[i - 1] : null,
    next: i < dailyScores.length - 1 ? dailyScores[i + 1] : null,
    trailing: before.length >= 7 ? { mean: aggregate(before).mean, days: before.length } : null,
  };
}

// ── Prose ──
// Generated sentences, not editorial: every clause restates a number that is
// also on the page. Thresholds keep it from narrating noise ("0.004 higher").

const FLAT = 0.02;

/** Readings just outside the neutral band shouldn't read as a verdict. */
const MILD = 0.15;

function toneWords(mean: number): string {
  const t = tone(mean);
  if (t === "neutral") return "close to neutral";
  const strength = Math.abs(mean) < MILD ? "mildly" : "net";
  return `${strength} ${t} toward AI`;
}

function compare(delta: number, flat: string, up: string, down: string): string {
  if (Math.abs(delta) < FLAT) return flat;
  return delta > 0 ? up : down;
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;
}

/** Most positive and most critical outlet in a slice, if two qualify. */
function outletExtremes(rows: SourceRow[], minCount: number): [SourceRow, SourceRow] | null {
  const eligible = rows.filter((r) => r.count >= minCount);
  if (eligible.length < 2) return null;
  const top = eligible[0];
  const bottom = eligible[eligible.length - 1];
  if (top.mean - bottom.mean < FLAT) return null;
  return [top, bottom];
}

/** Sentences describing one day. `isLatest` marks a day still being ingested. */
export function daySummary(ctx: DayContext, isLatest: boolean): string[] {
  const { day, prev, trailing } = ctx;
  const out: string[] = [];
  const outlets = plural(day.sources.length, "outlet");

  out.push(
    `On ${weekday(day.date)}, ${longDate(day.date)}, coverage of AI across ${outlets} averaged ${formatScore(day.mean)} on the index's −1 to +1 scale — ${toneWords(day.mean)}.`
  );

  const comparisons: string[] = [];
  if (prev) {
    const delta = day.mean - prev.mean;
    comparisons.push(
      compare(
        delta,
        `about level with the previous day (${formatScore(prev.mean)})`,
        `${formatMagnitude(delta)} higher than the previous day (${formatScore(prev.mean)})`,
        `${formatMagnitude(delta)} lower than the previous day (${formatScore(prev.mean)})`
      )
    );
  }
  if (trailing) {
    const delta = day.mean - trailing.mean;
    comparisons.push(
      compare(
        delta,
        `in line with the trailing ${trailing.days}-day average of ${formatScore(trailing.mean)}`,
        `above the trailing ${trailing.days}-day average of ${formatScore(trailing.mean)}`,
        `below the trailing ${trailing.days}-day average of ${formatScore(trailing.mean)}`
      )
    );
  }
  if (comparisons.length > 0) out.push(`That is ${joinList(comparisons)}.`);

  out.push(
    `Of ${plural(day.count, "headline")}, ${day.pos} read as positive toward AI, ${day.neu} as neutral and ${day.neg} as negative.`
  );

  const extremes = outletExtremes(aggregate([day]).bySource, MIN_HEADLINES_FOR_SOURCE_CALLOUT);
  if (extremes) {
    const [top, bottom] = extremes;
    out.push(
      `${top.source} was the most upbeat outlet (${formatScore(top.mean)} across ${top.count} headlines) and ${bottom.source} the most critical (${formatScore(bottom.mean)} across ${bottom.count}).`
    );
  }

  if (isLatest) {
    out.push("This is the most recent day in the index; its numbers can still move as the remaining headlines are ingested.");
  }
  return out;
}

/** Sentences describing one month, compared with the month before it. */
export function monthSummary(m: MonthSummary, prev: MonthSummary | null): string[] {
  const out: string[] = [];
  const label = monthLabel(m.month);
  const outlets = plural(m.bySource.length, "outlet");
  const through = m.partial ? ` (through ${shortDate(m.days[m.days.length - 1].date)})` : "";

  out.push(
    m.partial
      ? `So far in ${label}${through}, ${plural(m.count, "headline")} about AI from ${outlets} have averaged ${formatScore(m.mean)} on the index's −1 to +1 scale — ${toneWords(m.mean)}.`
      : `In ${label}, ${plural(m.count, "headline")} about AI from ${outlets} averaged ${formatScore(m.mean)} on the index's −1 to +1 scale — ${toneWords(m.mean)}.`
  );

  if (prev) {
    const delta = m.mean - prev.mean;
    const prevLabel = monthLabel(prev.month);
    out.push(
      compare(
        delta,
        `That is essentially unchanged from ${prevLabel} (${formatScore(prev.mean)}).`,
        `That is ${formatMagnitude(delta)} higher than ${prevLabel} (${formatScore(prev.mean)}).`,
        `That is ${formatMagnitude(delta)} lower than ${prevLabel} (${formatScore(prev.mean)}).`
      )
    );
  }

  if (m.count > 0) {
    const pct = (n: number) => `${Math.round((n / m.count) * 100)}%`;
    out.push(
      `${pct(m.pos)} of headlines read as positive toward AI, ${pct(m.neg)} as negative and ${pct(m.neu)} as neutral.`
    );
  }

  if (m.best && m.worst) {
    out.push(
      `The most upbeat day was ${shortDate(m.best.date)} (${formatScore(m.best.mean)}); the most critical was ${shortDate(m.worst.date)} (${formatScore(m.worst.mean)}).`
    );
  }

  const extremes = outletExtremes(m.bySource, MIN_HEADLINES_FOR_MONTH_SOURCE);
  if (extremes) {
    const [top, bottom] = extremes;
    out.push(
      `Among outlets with at least ${MIN_HEADLINES_FOR_MONTH_SOURCE} headlines, ${top.source} was the most positive (${formatScore(top.mean)}) and ${bottom.source} the most critical (${formatScore(bottom.mean)}).`
    );
  }

  return out;
}

/** Trim generated prose to a meta-description length on a sentence boundary. */
export function metaDescription(sentences: string[], max = 160): string {
  let out = "";
  for (const s of sentences) {
    const next = out ? `${out} ${s}` : s;
    if (next.length > max && out) break;
    out = next;
  }
  return out;
}
