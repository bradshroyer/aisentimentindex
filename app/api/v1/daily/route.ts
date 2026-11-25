import { apiMeta, json, round } from "@/lib/api";
import { fetchDailyScores } from "@/lib/data";

// The index itself: one row per day, all-time, with the per-outlet breakdown.
// Static + ISR — see lib/api.ts for why this must not read the request.
export const revalidate = 21600;

export async function GET() {
  const dailyScores = await fetchDailyScores();

  return json({
    ...apiMeta(),
    first_date: dailyScores[0]?.date ?? null,
    last_date: dailyScores[dailyScores.length - 1]?.date ?? null,
    count: dailyScores.length,
    data: dailyScores.map((d) => ({
      date: d.date,
      mean: round(d.mean),
      count: d.count,
      pos: d.pos,
      neg: d.neg,
      neu: d.neu,
      by_source: Object.fromEntries(
        Object.entries(d.by_source).map(([source, s]) => [
          source,
          { mean: round(s.mean), count: s.count },
        ])
      ),
    })),
  });
}
