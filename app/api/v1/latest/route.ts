import { apiMeta, json, round } from "@/lib/api";
import { fetchDailyScores } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

// The current reading plus enough context to render a badge or a one-line
// status without pulling the full series.
export const revalidate = 21600;

/** Simple mean of the last `n` daily means — the chart's moving-average line. */
function trailingMean(means: number[], n: number): number | null {
  if (means.length === 0) return null;
  const window = means.slice(-n);
  return round(window.reduce((s, v) => s + v, 0) / window.length);
}

export async function GET() {
  const dailyScores = await fetchDailyScores();
  const latest = dailyScores[dailyScores.length - 1];

  if (!latest) {
    return json({ ...apiMeta(), date: null });
  }

  const previous = dailyScores[dailyScores.length - 2] ?? null;
  const means = dailyScores.map((d) => d.mean);
  const today = new Date().toISOString().slice(0, 10);

  return json({
    ...apiMeta(),
    date: latest.date,
    mean: round(latest.mean),
    count: latest.count,
    pos: latest.pos,
    neg: latest.neg,
    neu: latest.neu,
    // The newest day keeps filling in until the day's last ingest run.
    in_progress: latest.date >= today,
    previous: previous ? { date: previous.date, mean: round(previous.mean) } : null,
    change_1d: previous ? round(latest.mean - previous.mean) : null,
    mean_7d: trailingMean(means, 7),
    mean_30d: trailingMean(means, 30),
    by_source: Object.fromEntries(
      Object.entries(latest.by_source).map(([source, s]) => [
        source,
        { mean: round(s.mean), count: s.count },
      ])
    ),
    url: `${SITE_URL}/day/${latest.date}`,
  });
}
