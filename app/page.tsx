import { Suspense } from "react";
import { fetchDailyScores, fetchHeadlines } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";
import { RelativeTime } from "@/components/RelativeTime";

export const revalidate = 0; // Always fetch fresh data

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-40 bg-surface-alt rounded-lg" />
        <div className="h-8 w-28 bg-surface-alt rounded-lg ml-auto" />
      </div>
      <div className="bg-card border border-border rounded-lg p-5 h-[340px] sm:h-[540px]">
        <div className="h-full bg-surface-alt/50 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg px-5 py-4 h-24">
            <div className="h-6 w-16 bg-surface-alt rounded mb-2" />
            <div className="h-3 w-24 bg-surface-alt rounded" />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="bg-surface-alt border-b border-border h-10" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-border/50 flex items-center gap-4">
            <div className="h-4 flex-1 bg-surface-alt/50 rounded" />
            <div className="h-4 w-16 bg-surface-alt/50 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function Home() {
  const [dailyScores, headlines] = await Promise.all([
    fetchDailyScores(),
    fetchHeadlines(),
  ]);

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex items-start justify-between animate-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
            AI Sentiment Index
          </h1>
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full" />
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            How positive or negative are the world&rsquo;s top tech outlets when they write about AI?
            <br />
            A daily score from &minus;1.0 to +1.0, derived from headlines across 14 sources.
          </p>
          <p className="text-xs text-text-tertiary mt-2 font-mono tracking-wide uppercase">
            Tracking {"\u00B7"} 14 sources {"\u00B7"} updated{" "}
            <RelativeTime timestamp={headlines[0]?.timestamp || new Date().toISOString()} />
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ShareButton />
          <ThemeToggle />
        </div>
      </header>

      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard dailyScores={dailyScores} headlines={headlines} />
      </Suspense>
    </main>
  );
}
