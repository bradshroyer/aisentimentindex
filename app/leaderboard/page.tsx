import type { Metadata } from "next";
import { fetchDailyScores } from "@/lib/data";
import { LeaderboardView } from "@/components/LeaderboardView";
import { SiteNav } from "@/components/SiteNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Leaderboard · AI Sentiment Index",
  description:
    "How 14 major news outlets rank on sentiment toward AI, from most positive to most critical.",
  alternates: { canonical: "/leaderboard" },
  openGraph: {
    title: "Leaderboard · AI Sentiment Index",
    description:
      "How 14 major news outlets rank on sentiment toward AI, from most positive to most critical.",
    url: "/leaderboard",
    siteName: "AI Sentiment Index",
    type: "website",
  },
};

export default async function LeaderboardPage() {
  const dailyScores = await fetchDailyScores();

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex items-start justify-between animate-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
            AI Sentiment Index
          </h1>
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full" />
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            Outlet leaderboard &mdash; ranked by average sentiment toward AI across the selected range.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <SiteNav />
          <div className="flex items-center gap-2">
            <ShareButton />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <LeaderboardView dailyScores={dailyScores} />
    </main>
  );
}
