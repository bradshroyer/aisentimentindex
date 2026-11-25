import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDailyScores, fetchHeadlinesBetween } from "@/lib/data";
import { SPIKE_ANNOTATIONS } from "@/lib/annotations";
import {
  formatScore,
  isValidDate,
  longDate,
  monthLabel,
  shortDate,
  toneClass,
  weekday,
} from "@/lib/format";
import {
  aggregate,
  dayContext,
  daySummary,
  metaDescription,
  type DayContext,
} from "@/lib/recaps";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { MethodologyFooter } from "@/components/MethodologyFooter";
import {
  Breadcrumbs,
  DistributionBar,
  HeadlineList,
  JsonLd,
  LINK_CLASS,
  PrevNext,
  SectionHeading,
  SectionLabel,
  SourceTable,
  breadcrumbJsonLd,
  type Crumb,
} from "@/components/content";

// One crawlable, shareable page per day of the index. The dashboard's
// ?date= deep link is applied after hydration (see CLAUDE.md on
// useSearchParams), so it never had indexable content of its own — this is
// the permalink the dashboard's day panel now points at.
//
// Rendered on first request and cached (ISR): nothing is prebuilt, so the
// build doesn't issue one Supabase query per day of history.
export const revalidate = 21600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

/** Below this, a day's mean is too thin to be worth a search result. */
const MIN_HEADLINES_TO_INDEX = 5;

type Props = { params: Promise<{ date: string }> };

async function loadDay(date: string): Promise<{ ctx: DayContext; isLatest: boolean } | null> {
  if (!isValidDate(date)) return null;
  const dailyScores = await getDailyScores();
  const ctx = dayContext(dailyScores, date);
  if (!ctx) return null;
  return { ctx, isLatest: ctx.next === null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const loaded = await loadDay(date);
  if (!loaded) return { title: "Day not found" };

  const { ctx, isLatest } = loaded;
  const title = `AI news sentiment on ${longDate(date)}`;
  const description = metaDescription(daySummary(ctx, isLatest));

  return {
    title,
    description,
    alternates: { canonical: `/day/${date}` },
    robots: { index: ctx.day.count >= MIN_HEADLINES_TO_INDEX, follow: true },
    openGraph: {
      title: `${title} · AI Sentiment Index`,
      description,
      url: `/day/${date}`,
      siteName: "AI Sentiment Index",
      type: "article",
    },
  };
}

function Delta({ value, label }: { value: number; label: string }) {
  return (
    <span className={`text-sm font-mono tabular-nums ${toneClass(value)}`}>
      {value >= 0 ? "▲" : "▼"} {Math.abs(value).toFixed(2)}
      <span className="text-text-tertiary"> {label}</span>
    </span>
  );
}

export default async function DayPage({ params }: Props) {
  const { date } = await params;
  const loaded = await loadDay(date);
  if (!loaded) notFound();

  const { ctx, isLatest } = loaded;
  const { day, prev, next, trailing } = ctx;
  const [dailyScores, headlines] = await Promise.all([
    getDailyScores(),
    fetchHeadlinesBetween(date, date),
  ]);

  const month = date.slice(0, 7);
  const crumbs: Crumb[] = [
    { label: "Dashboard", href: "/" },
    { label: "Monthly", href: "/monthly" },
    { label: monthLabel(month), href: `/monthly/${month}` },
    { label: shortDate(date) },
  ];

  const summary = daySummary(ctx, isLatest);
  const sources = aggregate([day]).bySource;
  const spikes = SPIKE_ANNOTATIONS.filter((a) => a.date === date);

  const byScore = [...headlines].sort((a, b) => b.score - a.score);
  const totalHeadlines = dailyScores.reduce((sum, d) => sum + d.count, 0);

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd(SITE_URL, crumbs, `/day/${date}`)} />
      <SiteHeader
        className="mb-10"
        ownHeading
        tagline={<>Daily reading &mdash; one day of AI coverage, headline by headline.</>}
      />

      <article className="max-w-3xl mx-auto space-y-12">
        <header className="animate-in space-y-5">
          <Breadcrumbs items={crumbs} />
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
            AI news sentiment on {longDate(date)}
          </h1>
        </header>

        {/* Hero: the day's reading, how it compares, how it splits */}
        <section className="animate-in delay-1 rounded-xl border border-border bg-card card-glow px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-tertiary">
            {weekday(date)} &middot; daily mean
            {isLatest && <span className="text-accent"> &middot; in progress</span>}
          </p>
          <div className="mt-2 flex items-baseline gap-x-5 gap-y-2 flex-wrap">
            <span
              className={`text-5xl sm:text-6xl font-mono font-medium tabular-nums tracking-tight leading-none ${toneClass(day.mean)}`}
            >
              {formatScore(day.mean, 3)}
            </span>
            <div className="flex flex-col gap-0.5">
              {prev && (
                <Delta value={day.mean - prev.mean} label={`vs ${shortDate(prev.date)}`} />
              )}
              {trailing && (
                <Delta
                  value={day.mean - trailing.mean}
                  label={`vs ${trailing.days}-day average`}
                />
              )}
            </div>
          </div>
          <div className="mt-5">
            <DistributionBar
              pos={day.pos}
              neu={day.neu}
              neg={day.neg}
              countLabel={`${day.count} headlines`}
            />
          </div>
        </section>

        {/* Plain-language reading of the same numbers */}
        <section className="animate-in delay-2 space-y-4 text-sm text-text-secondary leading-relaxed">
          {spikes.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border px-4 py-3 ${
                s.direction === "up"
                  ? "bg-positive/5 border-positive/30"
                  : "bg-negative/5 border-negative/30"
              }`}
            >
              <p
                className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
                  s.direction === "up" ? "text-positive" : "text-negative"
                }`}
              >
                {s.direction === "up" ? "▲" : "▼"} Notable day &middot; {s.label}
              </p>
              <p className="mt-1 text-text-primary">{s.blurb}</p>
            </div>
          ))}
          <p>{summary.join(" ")}</p>
          <p>
            Each headline is scored by Claude Haiku for its stance toward AI,
            not the tone of its words &mdash; see the{" "}
            <Link href="/methodology" className={LINK_CLASS}>
              methodology
            </Link>
            . To see this day in context,{" "}
            <Link href={`/?date=${date}`} className={LINK_CLASS}>
              open it on the interactive chart
            </Link>
            .
          </p>
        </section>

        {sources.length > 1 && (
          <section className="animate-in delay-3">
            <SectionLabel>By outlet</SectionLabel>
            <SectionHeading>Who covered AI, and how</SectionHeading>
            <SourceTable rows={sources} />
            <p className="mt-3 text-[11px] font-mono text-text-tertiary">
              The small number beside each outlet is its headline count for the
              day. One or two headlines make a noisy mean.
            </p>
          </section>
        )}

        <section className="animate-in delay-4">
          <SectionLabel>Headlines</SectionLabel>
          <SectionHeading>
            {headlines.length > 0
              ? `All ${headlines.length} headlines, most positive first`
              : "Headlines"}
          </SectionHeading>
          {headlines.length > 0 ? (
            <HeadlineList headlines={byScore} />
          ) : (
            <p className="text-sm text-text-tertiary">
              No headlines are available for this day.
            </p>
          )}
        </section>

        <div className="animate-in delay-5 space-y-6">
          <PrevNext
            prev={prev ? { href: `/day/${prev.date}`, label: shortDate(prev.date, true) } : null}
            next={next ? { href: `/day/${next.date}`, label: shortDate(next.date, true) } : null}
          />
          <p className="text-center">
            <Link prefetch={false}
              href={`/monthly/${month}`}
              className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-secondary hover:text-accent transition-colors"
            >
              All of {monthLabel(month)} &rarr;
            </Link>
          </p>
        </div>
      </article>

      <MethodologyFooter
        totalHeadlines={totalHeadlines}
        daysTracked={dailyScores.length}
        firstDate={dailyScores[0]?.date ?? ""}
        lastDate={dailyScores[dailyScores.length - 1]?.date ?? ""}
      />
    </main>
  );
}
