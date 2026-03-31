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
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            AI Sentiment Index
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Tracking how major tech outlets talk about AI &mdash; updated{" "}
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
