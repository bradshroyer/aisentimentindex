import { apiMeta, json, round } from "@/lib/api";
import { fetchDailyScores } from "@/lib/data";
import { computeLeaderboards } from "@/lib/leaderboard";

// Per-outlet averages — the leaderboard as data. Same windows and the same
// headline-weighted math as /leaderboard, so the two can't disagree.
export const revalidate = 21600;

const WINDOWS = [
  { key: "last_30_days", days: 30 },
  { key: "last_365_days", days: 365 },
  { key: "all_time", days: 0 },
] as const;

export async function GET() {
  const dailyScores = await fetchDailyScores();
  const boards = computeLeaderboards(dailyScores);

  return json({
    ...apiMeta(),
    last_date: dailyScores[dailyScores.length - 1]?.date ?? null,
    // Each window is ranked most positive → most critical.
    windows: Object.fromEntries(
      WINDOWS.map((w) => [
        w.key,
        (boards[w.days] ?? []).map((row, i) => ({
          rank: i + 1,
          source: row.source,
          mean: round(row.mean),
          count: row.count,
        })),
      ])
    ),
  });
}
