import { fetchDailyScores, fetchHeadlines } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";

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
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          AI Sentiment Index
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tracking how major tech outlets talk about AI &mdash; updated{" "}
          {lastUpdated}
        </p>
      </header>

      <Dashboard dailyScores={dailyScores} headlines={headlines} />
    </main>
  );
}
