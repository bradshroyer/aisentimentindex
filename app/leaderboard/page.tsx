import type { Metadata } from "next";
import { fetchDailyScores } from "@/lib/data";
import { LeaderboardView } from "@/components/LeaderboardView";
import { SiteHeader } from "@/components/SiteHeader";
import { MethodologyFooter } from "@/components/MethodologyFooter";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Leaderboard",
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
  const totalHeadlines = dailyScores.reduce((sum, d) => sum + d.count, 0);
  const daysTracked = dailyScores.length;

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SiteHeader
        pageTitle="Outlet Leaderboard"
        tagline={
          <>
            Outlet leaderboard &mdash; ranked by average sentiment toward AI across the selected range.
          </>
        }
      />

      <LeaderboardView dailyScores={dailyScores} />

      <MethodologyFooter
        totalHeadlines={totalHeadlines}
        daysTracked={daysTracked}
        firstDate={dailyScores[0]?.date ?? ""}
        lastDate={dailyScores[dailyScores.length - 1]?.date ?? ""}
      />
    </main>
  );
}
