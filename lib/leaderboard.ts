import type { DailyScore } from "./types";
import { TIME_RANGES } from "./types";
import { addDays } from "./bucketing";

export interface LeaderboardRow {
  source: string;
  mean: number;
  count: number;
  series: number[];
}

/** Range length in days (0 = all time) → ranked rows. */
export type LeaderboardByRange = Record<number, LeaderboardRow[]>;

function windowedScores(dailyScores: DailyScore[], rangeDays: number): DailyScore[] {
  if (rangeDays === 0 || dailyScores.length === 0) return dailyScores;
  const last = dailyScores[dailyScores.length - 1].date;
  const cutoffStr = addDays(last, -rangeDays);
  return dailyScores.filter((d) => d.date >= cutoffStr);
}

function computeLeaderboard(
  dailyScores: DailyScore[],
  rangeDays: number
): LeaderboardRow[] {
  const windowed = windowedScores(dailyScores, rangeDays);
  const agg = new Map<
    string,
    { sum: number; count: number; daily: { mean: number; count: number }[] }
  >();

  for (const d of windowed) {
    for (const [src, stats] of Object.entries(d.by_source)) {
      if (!stats || stats.count === 0) continue;
      let a = agg.get(src);
      if (!a) {
        a = { sum: 0, count: 0, daily: [] };
        agg.set(src, a);
      }
      a.sum += stats.mean * stats.count;
      a.count += stats.count;
      a.daily.push({ mean: stats.mean, count: stats.count });
    }
  }

  const rows: LeaderboardRow[] = [];
  for (const [source, a] of agg) {
    if (a.count === 0) continue;
    const target = 24;
    const step = Math.max(1, Math.ceil(a.daily.length / target));
    const series: number[] = [];
    for (let i = 0; i < a.daily.length; i += step) {
      const slice = a.daily.slice(i, i + step);
      const wSum = slice.reduce((s, x) => s + x.mean * x.count, 0);
      const wN = slice.reduce((s, x) => s + x.count, 0);
      series.push(wN > 0 ? Math.round((wSum / wN) * 1000) / 1000 : 0);
    }
    rows.push({ source, mean: a.sum / a.count, count: a.count, series });
  }

  rows.sort((a, b) => b.mean - a.mean);
  return rows;
}

/**
 * Rank every outlet for every range up front on the server, so the page ships
 * a few KB of rows instead of the full per-source daily history.
 */
export function computeLeaderboards(dailyScores: DailyScore[]): LeaderboardByRange {
  return Object.fromEntries(
    TIME_RANGES.map((r) => [r.days, computeLeaderboard(dailyScores, r.days)])
  );
}
