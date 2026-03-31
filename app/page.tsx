import { Suspense } from "react";
import { fetchDailyScores, fetchHeadlines } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";

export const revalidate = 0; // Always fetch fresh data

export default async function Home() {
  const [dailyScores, headlines] = await Promise.all([
    fetchDailyScores(),
    fetchHeadlines(),
  ]);

  const lastUpdated = headlines[0]?.timestamp
    ? new Date(headlines[0].timestamp).toUTCString()
    : "N/A";

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex items-start justify-between animate-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
            AI Sentiment Index
          </h1>
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full" />
          <p className="text-xs text-text-secondary mt-2 font-mono tracking-wide uppercase">
            Tracking {"\u00B7"} 14 sources {"\u00B7"} updated{" "}
            {lastUpdated}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ShareButton />
          <ThemeToggle />
        </div>
      </header>

      <Suspense>
        <Dashboard dailyScores={dailyScores} headlines={headlines} />
      </Suspense>
    </main>
  );
}
