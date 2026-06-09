import { fetchDailyScores, fetchHeadlines, headlinesSince } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";
import { SiteNav } from "@/components/SiteNav";
import { SITE_URL } from "@/lib/site";

// Dataset markup gets the index into Google Dataset Search; WebSite ties the
// pages together for regular search. Rebuilt on each ISR revalidation so the
// temporal coverage tracks the data.
function buildJsonLd(firstDate: string | null, lastDate: string | null) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "AI Sentiment Index",
        description:
          "A daily index of media sentiment toward AI across 14 major news outlets.",
        publisher: {
          "@type": "Person",
          name: "Brad Shroyer",
          url: "https://bradshroyer.com",
        },
      },
      {
        "@type": "Dataset",
        name: "AI Sentiment Index — daily media sentiment toward AI",
        description:
          "Daily mean sentiment scores (−1.0 anti-AI to +1.0 pro-AI) for AI news coverage across 14 major outlets including NYT, TechCrunch, The Verge, Wired, Bloomberg and BBC. Each headline is scored for its stance toward AI by Claude Haiku; updated every 6 hours.",
        url: SITE_URL,
        sameAs: "https://github.com/bradshroyer/aisentimentindex",
        creator: {
          "@type": "Person",
          name: "Brad Shroyer",
          url: "https://bradshroyer.com",
        },
        ...(firstDate && lastDate
          ? { temporalCoverage: `${firstDate}/${lastDate}` }
          : {}),
        isAccessibleForFree: true,
        keywords: [
          "AI sentiment",
          "media sentiment analysis",
          "AI news coverage",
          "artificial intelligence",
          "news sentiment index",
        ],
        measurementTechnique:
          "LLM-based stance classification (Claude Haiku) with lexicon fallback",
        variableMeasured: {
          "@type": "PropertyValue",
          name: "Mean daily sentiment toward AI",
          minValue: -1,
          maxValue: 1,
        },
      },
    ],
  };
}

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
  const since = headlinesSince();
  const [dailyScores, headlines] = await Promise.all([
    fetchDailyScores(),
    fetchHeadlines(since),
  ]);

  const freshness = describeFreshness(dailyScores[dailyScores.length - 1]?.date ?? null);
  const jsonLd = buildJsonLd(
    dailyScores[0]?.date ?? null,
    dailyScores[dailyScores.length - 1]?.date ?? null
  );

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* JSON-LD is built from our own constants and DB dates; `<` is escaped
          so no value can ever close the script tag early. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
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

      <Dashboard dailyScores={dailyScores} initialHeadlines={headlines} initialSince={since} />
    </main>
  );
}
