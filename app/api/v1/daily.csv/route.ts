import { API_HEADERS, round } from "@/lib/api";
import { fetchDailyScores } from "@/lib/data";

// Flat CSV of the daily series for spreadsheets and notebooks
// (`pd.read_csv(url)`). Per-outlet breakdowns live in the JSON endpoint.
export const revalidate = 21600;

export async function GET() {
  const dailyScores = await fetchDailyScores();

  const lines = ["date,mean,count,pos,neg,neu"];
  for (const d of dailyScores) {
    lines.push([d.date, round(d.mean), d.count, d.pos, d.neg, d.neu].join(","));
  }

  return new Response(lines.join("\n") + "\n", {
    headers: {
      ...API_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'inline; filename="ai-sentiment-index-daily.csv"',
    },
  });
}
