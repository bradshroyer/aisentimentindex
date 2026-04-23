import { fetchDailyScores, fetchHeadlines } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";
import { SiteNav } from "@/components/SiteNav";

// Data refreshes every 6h via GitHub Actions, so match that cadence.
// Any shorter and we're paying ISR writes for data that hasn't changed.
export const revalidate = 21600;

function describeFreshness(latestDate: string | null) {
  if (!latestDate) return null;
  const today = new Date().toISOString().slice(0, 10);
  const latestMs = Date.parse(latestDate + "T00:00:00Z");
  const todayMs = Date.parse(today + "T00:00:00Z");
  const days = Math.max(0, Math.round((todayMs - latestMs) / 86400000));
  const dateLabel = new Date(latestDate + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const relative = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return { dateLabel, relative, stale: days >= 2 };
}

export default async function Home() {
  const [dailyScores, headlines] = await Promise.all([
    fetchDailyScores(),
    fetchHeadlines(),
  ]);

  const freshness = describeFreshness(dailyScores[dailyScores.length - 1]?.date ?? null);

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex items-start justify-between animate-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
            AI Sentiment Index
          </h1>
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full" />
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            How positive or negative are major news outlets when they write about AI? A daily score from &minus;1.0 to +1.0 across 14 sources.
          </p>
          {freshness && (
            <p className="text-[11px] font-mono mt-2 tabular-nums text-text-tertiary">
              Data through {freshness.dateLabel} ·{" "}
              <span className={freshness.stale ? "text-negative" : "text-text-secondary"}>
                {freshness.relative}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-3">
          <SiteNav />
          <div className="flex items-center gap-2">
            <ShareButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <Dashboard dailyScores={dailyScores} headlines={headlines} />
    </main>
  );
}
