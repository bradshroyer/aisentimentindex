import type { DailyScore, Headline, SourceStats } from "./types";

export type Granularity = "day" | "week" | "month";

export function getGranularity(rangeDays: number): Granularity {
  if (rangeDays === 0 || rangeDays > 180) return "month";
  if (rangeDays > 30) return "week";
  return "day";
}

function parseDate(s: string): Date {
  return new Date(s + "T12:00:00");
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function bucketKey(dateStr: string, g: Granularity): string {
  if (g === "day") return dateStr;
  if (g === "month") return dateStr.slice(0, 7) + "-01";
  const d = parseDate(dateStr);
  const day = d.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return toISO(d);
}

export function bucketEnd(key: string, g: Granularity): string {
  if (g === "day") return key;
  if (g === "week") {
    const d = parseDate(key);
    d.setDate(d.getDate() + 6);
    return toISO(d);
  }
  const d = parseDate(key);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toISO(d);
}

export function bucketCenter(key: string, g: Granularity): string {
  if (g === "day") return key;
  const start = parseDate(key);
  const end = parseDate(bucketEnd(key, g));
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  return toISO(mid);
}

export function prevBucketKey(key: string, g: Granularity): string {
  const d = parseDate(key);
  if (g === "day") d.setDate(d.getDate() - 1);
  else if (g === "week") d.setDate(d.getDate() - 7);
  else d.setMonth(d.getMonth() - 1);
  return toISO(d);
}

const MONTHS_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function bucketLabel(key: string, g: Granularity): string {
  if (g === "day" || g === "week") {
    const [, m, d] = key.split("-");
    return `${MONTHS_SHORT[parseInt(m, 10)]} ${parseInt(d, 10)}`;
  }
  const [y, m] = key.split("-");
  return `${MONTHS_SHORT[parseInt(m, 10)]} ${y}`;
}

export function bucketLongLabel(key: string, g: Granularity): string {
  if (g === "day") {
    const [y, m, d] = key.split("-");
    return `${MONTHS_LONG[parseInt(m, 10)]} ${parseInt(d, 10)}, ${y}`;
  }
  if (g === "week") {
    const end = bucketEnd(key, "week");
    const [, sm, sd] = key.split("-");
    const [, em, ed] = end.split("-");
    return `Week of ${MONTHS_SHORT[parseInt(sm, 10)]} ${parseInt(sd, 10)} – ${MONTHS_SHORT[parseInt(em, 10)]} ${parseInt(ed, 10)}`;
  }
  const [y, m] = key.split("-");
  return `${MONTHS_LONG[parseInt(m, 10)]} ${y}`;
}

export interface ChartDayPoint {
  date: string;
  mean: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
}

export interface BucketPoint {
  date: string;
  label: string;
  mean: number;
  min: number;
  max: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
}

export function bucketChartData(points: ChartDayPoint[], g: Granularity): BucketPoint[] {
  if (g === "day") {
    return points.map((p) => ({
      date: p.date,
      label: bucketLabel(p.date, "day"),
      mean: p.mean,
      min: p.mean,
      max: p.mean,
      count: p.count,
      pos: p.pos,
      neg: p.neg,
      neu: p.neu,
    }));
  }
  const map = new Map<string, ChartDayPoint[]>();
  for (const p of points) {
    const k = bucketKey(p.date, g);
    const arr = map.get(k);
    if (arr) arr.push(p);
    else map.set(k, [p]);
  }
  const keys = [...map.keys()].sort();
  return keys.map((k) => {
    const pts = map.get(k)!;
    let count = 0, pos = 0, neg = 0, neu = 0, weighted = 0;
    let min = Infinity, max = -Infinity;
    for (const p of pts) {
      count += p.count;
      pos += p.pos;
      neg += p.neg;
      neu += p.neu;
      weighted += p.mean * p.count;
      if (p.mean < min) min = p.mean;
      if (p.mean > max) max = p.mean;
    }
    const mean = count > 0 ? weighted / count : 0;
    return {
      date: k,
      label: bucketLabel(k, g),
      mean,
      min: isFinite(min) ? min : mean,
      max: isFinite(max) ? max : mean,
      count,
      pos,
      neg,
      neu,
    };
  });
}

export interface Bucket {
  key: string;
  label: string;
  longLabel: string;
  granularity: Granularity;
  start: string;
  end: string;
  dates: string[];
  mean: number;
  min: number;
  max: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
  by_source: Record<string, SourceStats>;
  sources: string[];
}

export function buildBucket(
  dailyScores: DailyScore[],
  headlines: Headline[],
  g: Granularity,
  selectedSource: string,
  key: string
): Bucket | null {
  const end = bucketEnd(key, g);
  const inRange = dailyScores.filter((d) => d.date >= key && d.date <= end);
  if (inRange.length === 0) return null;

  let count = 0, pos = 0, neg = 0, neu = 0, weighted = 0;
  let min = Infinity, max = -Infinity;
  const sourceAgg: Record<string, { weighted: number; count: number }> = {};
  const dates: string[] = [];

  for (const d of inRange) {
    let dayMean: number, dayCount: number, dayPos: number, dayNeg: number, dayNeu: number;
    if (selectedSource === "All") {
      dayMean = d.mean;
      dayCount = d.count;
      dayPos = d.pos;
      dayNeg = d.neg;
      dayNeu = d.neu;
      for (const [src, stats] of Object.entries(d.by_source)) {
        if (!sourceAgg[src]) sourceAgg[src] = { weighted: 0, count: 0 };
        sourceAgg[src].weighted += stats.mean * stats.count;
        sourceAgg[src].count += stats.count;
      }
    } else {
      const src = d.by_source[selectedSource];
      if (!src) continue;
      dayMean = src.mean;
      dayCount = src.count;
      const dayHs = headlines.filter((h) => h.source === selectedSource && h.date === d.date);
      dayPos = dayHs.filter((h) => h.score > 0.05).length;
      dayNeg = dayHs.filter((h) => h.score < -0.05).length;
      dayNeu = dayHs.length - dayPos - dayNeg;
      if (!sourceAgg[selectedSource]) sourceAgg[selectedSource] = { weighted: 0, count: 0 };
      sourceAgg[selectedSource].weighted += src.mean * src.count;
      sourceAgg[selectedSource].count += src.count;
    }
    dates.push(d.date);
    count += dayCount;
    pos += dayPos;
    neg += dayNeg;
    neu += dayNeu;
    weighted += dayMean * dayCount;
    if (dayMean < min) min = dayMean;
    if (dayMean > max) max = dayMean;
  }

  if (count === 0) return null;

  const by_source: Record<string, SourceStats> = {};
  for (const [src, agg] of Object.entries(sourceAgg)) {
    by_source[src] = { mean: agg.count > 0 ? agg.weighted / agg.count : 0, count: agg.count };
  }

  return {
    key,
    label: bucketLabel(key, g),
    longLabel: bucketLongLabel(key, g),
    granularity: g,
    start: key,
    end,
    dates,
    mean: weighted / count,
    min: isFinite(min) ? min : weighted / count,
    max: isFinite(max) ? max : weighted / count,
    count,
    pos,
    neg,
    neu,
    by_source,
    sources: Object.keys(by_source),
  };
}
