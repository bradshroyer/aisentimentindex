import type { Headline, SourceSummary } from "./types";

const POS_THRESHOLD = 0.05;
const NEG_THRESHOLD = -0.05;

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime();
  return Math.round(ms / 86400000);
}

function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute per-source leaderboard stats.
 *
 * - `mean`, `count`, `posPct`, `negPct` reflect the most recent 30-day window
 *   (ending at the latest headline date). This keeps the leaderboard stable
 *   when the user flips the time-range filter on the main chart.
 * - `delta30` is last-30d mean minus prior-30d mean.
 * - `meanAllTime` / `countAllTime` give a long-arc reference.
 * - `recencyDays` is days since the most recent headline from that source.
 */
export function computeSourceLeaderboard(headlines: Headline[]): SourceSummary[] {
  if (headlines.length === 0) return [];

  const latestDate = headlines.reduce(
    (max, h) => (h.date > max ? h.date : max),
    headlines[0].date
  );
  const window30Start = shiftDate(latestDate, -29); // inclusive 30-day window
  const window60Start = shiftDate(latestDate, -59);

  const bySource = new Map<string, Headline[]>();
  for (const h of headlines) {
    const arr = bySource.get(h.source);
    if (arr) arr.push(h);
    else bySource.set(h.source, [h]);
  }

  const rows: SourceSummary[] = [];
  for (const [source, items] of bySource) {
    const last30 = items.filter((h) => h.date >= window30Start);
    const prior30 = items.filter(
      (h) => h.date >= window60Start && h.date < window30Start
    );

    const last30Mean =
      last30.length > 0
        ? last30.reduce((s, h) => s + h.score, 0) / last30.length
        : 0;
    const prior30Mean =
      prior30.length > 0
        ? prior30.reduce((s, h) => s + h.score, 0) / prior30.length
        : 0;

    const delta30 =
      last30.length > 0 && prior30.length > 0 ? last30Mean - prior30Mean : null;

    const pos = last30.filter((h) => h.score > POS_THRESHOLD).length;
    const neg = last30.filter((h) => h.score < NEG_THRESHOLD).length;
    const posPct = last30.length > 0 ? (pos / last30.length) * 100 : 0;
    const negPct = last30.length > 0 ? (neg / last30.length) * 100 : 0;

    const meanAllTime =
      items.length > 0 ? items.reduce((s, h) => s + h.score, 0) / items.length : 0;

    const mostRecent = items.reduce(
      (max, h) => (h.date > max ? h.date : max),
      items[0].date
    );
    const recencyDays = daysBetween(mostRecent, latestDate);

    rows.push({
      source,
      mean: last30Mean,
      count: last30.length,
      meanAllTime,
      countAllTime: items.length,
      delta30,
      recencyDays,
      posPct,
      negPct,
    });
  }

  return rows.sort((a, b) => b.mean - a.mean);
}
