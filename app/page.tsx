import { fetchDailyScores, fetchHeadlines } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";

// Data refreshes every 6h via GitHub Actions, so per-request fetches are wasteful.
// Revalidate every 10 min — plenty fresh, and it collapses traffic on Supabase.
export const revalidate = 600;

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
            How positive or negative are the world&rsquo;s top tech outlets when they write about AI? A daily score from &minus;1.0 to +1.0.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton />
          <ThemeToggle />
        </div>
      </header>

      <Dashboard dailyScores={dailyScores} headlines={headlines} />
    </main>
  );
}
