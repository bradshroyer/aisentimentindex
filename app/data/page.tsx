import type { Metadata } from "next";
import Link from "next/link";
import { getDailyScores } from "@/lib/data";
import { formatScore, longDate } from "@/lib/format";
import { ACTIVE_SOURCE_COUNT } from "@/lib/types";
import { SITE_HOST, SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { MethodologyFooter } from "@/components/MethodologyFooter";
import {
  Breadcrumbs,
  JsonLd,
  LINK_CLASS,
  SectionHeading,
  SectionLabel,
  breadcrumbJsonLd,
  type Crumb,
} from "@/components/content";

export const revalidate = 21600;

const DESCRIPTION = `Free JSON API, CSV, RSS feed and full dataset download for the AI Sentiment Index: daily media sentiment toward AI across ${ACTIVE_SOURCE_COUNT} outlets since January 2025. No key required.`;

export const metadata: Metadata = {
  title: "Data & API",
  description: DESCRIPTION,
  alternates: { canonical: "/data" },
  openGraph: {
    title: "Data & API · AI Sentiment Index",
    description: DESCRIPTION,
    url: "/data",
    siteName: "AI Sentiment Index",
    type: "website",
  },
};

const CRUMBS: Crumb[] = [{ label: "Dashboard", href: "/" }, { label: "Data & API" }];

const REPO = "https://github.com/bradshroyer/aisentimentindex";
const RAW = "https://raw.githubusercontent.com/bradshroyer/aisentimentindex/main/data/export";

const ENDPOINTS = [
  {
    path: "/api/v1/latest",
    title: "Latest reading",
    body: "The most recent day's index value, its change from the previous day, 7- and 30-day averages, and the per-outlet breakdown. Small enough for a badge or a status line.",
  },
  {
    path: "/api/v1/daily",
    title: "Full daily series",
    body: "Every day since January 2025: mean, headline count, positive / neutral / negative tallies, and each outlet's mean and count for that day.",
  },
  {
    path: "/api/v1/daily.csv",
    title: "Daily series as CSV",
    body: "The same series flattened to date, mean, count, pos, neg, neu — for spreadsheets and notebooks.",
  },
  {
    path: "/api/v1/outlets",
    title: "Outlet rankings",
    body: "Each outlet's average sentiment over the last 30 days, the last 365 days, and all time, ranked most positive to most critical.",
  },
  {
    path: "/feed.xml",
    title: "RSS feed",
    body: "One item per completed day with the index value and a one-paragraph summary, linking to that day's page.",
  },
];

const FIELDS = [
  ["date", "Calendar day, YYYY-MM-DD."],
  ["mean", "Headline-weighted mean score for the day, −1.0 (anti-AI) to +1.0 (pro-AI)."],
  ["count", "Headlines about AI scored that day."],
  ["pos / neg / neu", "Headlines scoring above +0.05, below −0.05, or in between."],
  ["by_source", "Per outlet: that outlet's mean and headline count for the day."],
  ["in_progress", "On /latest: true while the newest day is still being ingested."],
  ["mean_7d / mean_30d", "On /latest: simple average of the last 7 / 30 daily means — the chart's moving-average line."],
] as const;

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="rounded-lg border border-border bg-surface-alt px-4 py-3 overflow-x-auto text-[12px] leading-relaxed font-mono text-text-primary">
      <code>{children}</code>
    </pre>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.85em] text-text-primary bg-surface-alt rounded px-1.5 py-0.5 whitespace-nowrap">
      {children}
    </code>
  );
}

export default async function DataPage() {
  const dailyScores = await getDailyScores();
  const latest = dailyScores[dailyScores.length - 1] ?? null;
  const totalHeadlines = dailyScores.reduce((sum, d) => sum + d.count, 0);
  const year = new Date().getUTCFullYear();

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd(SITE_URL, CRUMBS, "/data")} />
      <SiteHeader
        className="mb-10"
        ownHeading
        tagline={<>Data &amp; API &mdash; take the index with you.</>}
      />

      <div className="max-w-2xl mx-auto space-y-14">
        <header className="animate-in space-y-5">
          <Breadcrumbs items={CRUMBS} />
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
            Data &amp; API
          </h1>
          <p className="font-serif italic text-xl sm:text-2xl text-text-secondary leading-snug">
            The index is free to use:{" "}
            <span className="text-text-primary">no key, no sign-up</span>, open
            to any origin. Cite it, chart it, build on it.
          </p>
          {latest && (
            <p className="text-sm text-text-secondary leading-relaxed">
              {dailyScores.length.toLocaleString("en-US")} days and{" "}
              {totalHeadlines.toLocaleString("en-US")} scored headlines so far.
              The latest reading is{" "}
              <Link prefetch={false} href={`/day/${latest.date}`} className={LINK_CLASS}>
                {formatScore(latest.mean)} on {longDate(latest.date)}
              </Link>
              .
            </p>
          )}
        </header>

        <section id="api" className="animate-in delay-1 scroll-mt-10">
          <SectionLabel>01 &middot; API</SectionLabel>
          <SectionHeading>Endpoints</SectionHeading>
          <p className="text-sm text-text-secondary leading-relaxed mb-5">
            Plain <Mono>GET</Mono> requests returning JSON, with CORS open to
            every origin so they work from a browser. Responses are cached and
            refresh every six hours, in step with ingestion &mdash; polling
            more often than that returns the same data.
          </p>

          <ul className="space-y-3">
            {ENDPOINTS.map((e) => (
              <li key={e.path} className="rounded-xl border border-border bg-card card-glow p-4 sm:p-5">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-tertiary mb-1.5">
                  {e.title}
                </p>
                <a
                  href={e.path}
                  className="font-mono text-sm text-text-primary hover:text-accent transition-colors break-all"
                >
                  <span className="text-text-tertiary">{SITE_HOST}</span>
                  {e.path}
                </a>
                <p className="text-xs text-text-secondary leading-relaxed mt-2">{e.body}</p>
              </li>
            ))}
          </ul>

          <div className="space-y-3 mt-6">
            <Code>{`curl ${SITE_URL}/api/v1/latest`}</Code>
            <Code>{`# Python
import pandas as pd
df = pd.read_csv("${SITE_URL}/api/v1/daily.csv", parse_dates=["date"])
df.set_index("date")["mean"].rolling(7).mean().plot()`}</Code>
            <Code>{`// JavaScript
const { date, mean } = await fetch("${SITE_URL}/api/v1/latest").then((r) => r.json());`}</Code>
          </div>
        </section>

        <section id="fields" className="animate-in delay-2 scroll-mt-10">
          <SectionLabel>02 &middot; Fields</SectionLabel>
          <SectionHeading>What the numbers mean</SectionHeading>
          <dl className="rounded-xl border border-border bg-card card-glow overflow-hidden">
            {FIELDS.map(([name, meaning]) => (
              <div
                key={name}
                className="grid sm:grid-cols-[11rem_1fr] gap-x-4 gap-y-1 px-4 py-3 border-b border-border last:border-b-0"
              >
                <dt className="font-mono text-xs text-text-primary">{name}</dt>
                <dd className="text-xs text-text-secondary leading-relaxed">{meaning}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-text-secondary leading-relaxed mt-4">
            Scores measure a headline&rsquo;s stance toward AI, not the tone of
            its words. How they are produced, and where the approach falls
            short, is on the{" "}
            <Link href="/methodology" className={LINK_CLASS}>
              methodology page
            </Link>
            .
          </p>
        </section>

        <section id="download" className="animate-in delay-3 scroll-mt-10">
          <SectionLabel>03 &middot; Download</SectionLabel>
          <SectionHeading>The full dataset</SectionHeading>
          <p className="text-sm text-text-secondary leading-relaxed">
            The API serves the daily aggregates. Every individual headline
            behind them &mdash; title, summary, outlet, date, score, and which
            model scored it &mdash; is exported weekly to the repository:
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              ["headlines.csv", "every scored headline, one row each"],
              ["headlines.json", "the same rows as JSON"],
              ["daily_scores.json", "the daily index with per-outlet breakdowns"],
            ].map(([file, what]) => (
              <li key={file} className="flex flex-wrap items-baseline gap-x-2">
                <a href={`${RAW}/${file}`} className={`font-mono text-xs ${LINK_CLASS}`}>
                  {file}
                </a>
                <span className="text-xs text-text-secondary">&mdash; {what}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-secondary leading-relaxed mt-4">
            Browse the folder on{" "}
            <a
              href={`${REPO}/tree/main/data/export`}
              className={LINK_CLASS}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            . Headlines the scorer judged not really about AI are included and
            flagged (<Mono>about_ai = false</Mono>) so you can audit the filter;
            they are excluded from the index.
          </p>
        </section>

        <section id="license" className="animate-in delay-4 scroll-mt-10">
          <SectionLabel>04 &middot; Terms</SectionLabel>
          <SectionHeading>License and citation</SectionHeading>
          <p className="text-sm text-text-secondary leading-relaxed">
            Scores, aggregates and code are released under the{" "}
            <a
              href={`${REPO}/blob/main/LICENSE`}
              className={LINK_CLASS}
              target="_blank"
              rel="noopener noreferrer"
            >
              MIT license
            </a>
            . Headline titles and summaries remain the property of their
            publishers and are included for research and reference. If you use
            the index, a link back is all that is asked:
          </p>
          <div className="mt-4">
            <Code>{`Shroyer, B. (${year}). AI Sentiment Index: daily media sentiment toward AI.
${SITE_URL}`}</Code>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed mt-4">
            There is no uptime guarantee and the schema may grow new fields;
            existing fields under <Mono>/api/v1</Mono> will not change meaning.
            Found a problem with the data?{" "}
            <a
              href={`${REPO}/issues`}
              className={LINK_CLASS}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open an issue
            </a>
            .
          </p>
        </section>
      </div>

      <MethodologyFooter
        totalHeadlines={totalHeadlines}
        daysTracked={dailyScores.length}
        firstDate={dailyScores[0]?.date ?? ""}
        lastDate={dailyScores[dailyScores.length - 1]?.date ?? ""}
      />
    </main>
  );
}
