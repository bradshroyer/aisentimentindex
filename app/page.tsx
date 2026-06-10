import { fetchDailyScores, fetchHeadlines, headlinesSince } from "@/lib/data";
import { Dashboard } from "@/components/Dashboard";
import { SiteHeader } from "@/components/SiteHeader";
import { DataFreshness } from "@/components/DataFreshness";
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
        // Canonical URL so Google recognizes the license (a repo blob URL reads
        // as "unspecified" in Dataset Search)
        license: "https://spdx.org/licenses/MIT.html",
        // Weekly export committed by .github/workflows/export.yml
        distribution: [
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl:
              "https://raw.githubusercontent.com/bradshroyer/aisentimentindex/main/data/export/daily_scores.json",
          },
          {
            "@type": "DataDownload",
            encodingFormat: "text/csv",
            contentUrl:
              "https://raw.githubusercontent.com/bradshroyer/aisentimentindex/main/data/export/headlines.csv",
          },
          {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl:
              "https://raw.githubusercontent.com/bradshroyer/aisentimentindex/main/data/export/headlines.json",
          },
        ],
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

export default async function Home() {
  const since = headlinesSince();
  const [dailyScores, headlines] = await Promise.all([
    fetchDailyScores(),
    fetchHeadlines(since),
  ]);

  const latestDate = dailyScores[dailyScores.length - 1]?.date ?? null;
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
      <SiteHeader
        tagline={
          <>
            How positive or negative are major news outlets when they write about AI? A daily score from &minus;1.0 to +1.0 across 14 sources.
          </>
        }
      >
        {latestDate && <DataFreshness latestDate={latestDate} />}
      </SiteHeader>

      <Dashboard dailyScores={dailyScores} initialHeadlines={headlines} initialSince={since} />
    </main>
  );
}
