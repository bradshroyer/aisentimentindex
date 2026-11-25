import { fetchDailyScores } from "@/lib/data";
import { formatScore, longDate } from "@/lib/format";
import { dayContext, daySummary } from "@/lib/recaps";
import { SITE_URL } from "@/lib/site";

// RSS feed of the index: one item per completed day, newest first, each
// linking to its /day page. Static + ISR like the JSON API (lib/api.ts).
export const revalidate = 21600;

const ITEMS = 30;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const dailyScores = await fetchDailyScores();
  const today = new Date().toISOString().slice(0, 10);
  // The in-progress day is left out: feed readers cache items by guid, so an
  // entry published at 02:00 UTC would freeze a quarter-day's reading.
  const completed = dailyScores.filter((d) => d.date < today);
  const recent = completed.slice(-ITEMS).reverse();

  const items = recent
    .map((d) => {
      const ctx = dayContext(dailyScores, d.date)!;
      const url = `${SITE_URL}/day/${d.date}`;
      const title = `AI Sentiment Index: ${formatScore(d.mean)} on ${longDate(d.date)}`;
      const description = daySummary(ctx, false).join(" ");
      // Noon UTC keeps the item on its own calendar day in every timezone.
      const pubDate = new Date(d.date + "T12:00:00Z").toUTCString();
      return `    <item>
      <title>${esc(title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${esc(description)}</description>
    </item>`;
    })
    .join("\n");

  const lastBuild = recent[0]
    ? new Date(recent[0].date + "T12:00:00Z").toUTCString()
    : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Sentiment Index</title>
    <link>${SITE_URL}</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>A daily index of media sentiment toward AI: how positive or negative major news outlets are when they write about AI, from −1 to +1.</description>
    <language>en</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
