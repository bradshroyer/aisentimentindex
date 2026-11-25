import type { MetadataRoute } from "next";
import { fetchDailyScores } from "@/lib/data";
import { summarizeMonths } from "@/lib/recaps";
import { SITE_URL } from "@/lib/site";

const siteUrl = SITE_URL;

// Rebuilt on the ingest cadence so new day and month pages are listed as
// they appear.
export const revalidate = 21600;

/** Days with fewer headlines are noindexed (app/day/[date]) — keep them out. */
const MIN_HEADLINES_TO_LIST = 5;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const dailyScores = await fetchDailyScores();
  const months = summarizeMonths(dailyScores);
  const lastDate = dailyScores[dailyScores.length - 1]?.date;
  // Pages driven by the series change when the data does, not on every crawl.
  const dataModified = lastDate ? new Date(lastDate + "T12:00:00Z") : new Date();

  const core: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: dataModified, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/leaderboard`, lastModified: dataModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/monthly`, lastModified: dataModified, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/data`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/methodology`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const monthPages: MetadataRoute.Sitemap = [...months].reverse().map((m) => ({
    url: `${siteUrl}/monthly/${m.month}`,
    // A finished month stops changing on its last day.
    lastModified: new Date(m.days[m.days.length - 1].date + "T12:00:00Z"),
    changeFrequency: m.partial ? "daily" : "yearly",
    priority: m.partial ? 0.7 : 0.6,
  }));

  const dayPages: MetadataRoute.Sitemap = [...dailyScores]
    .reverse()
    .filter((d) => d.count >= MIN_HEADLINES_TO_LIST)
    .map((d) => ({
      url: `${siteUrl}/day/${d.date}`,
      lastModified: new Date(d.date + "T12:00:00Z"),
      changeFrequency: d.date === lastDate ? "daily" : "yearly",
      priority: 0.4,
    }));

  return [...core, ...monthPages, ...dayPages];
}
