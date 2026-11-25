import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDailyScores, fetchHeadlinesBetween } from "@/lib/data";
import { SPIKE_ANNOTATIONS } from "@/lib/annotations";
import {
  formatScore,
  isValidMonth,
  longDate,
  monthEnd,
  monthLabel,
  monthShortLabel,
  shortDate,
  toneClass,
} from "@/lib/format";
import {
  MIN_HEADLINES_FOR_SOURCE_CALLOUT,
  metaDescription,
  monthSummary,
  summarizeMonths,
  type MonthSummary,
} from "@/lib/recaps";
import { themeStats } from "@/lib/themes";
import type { DailyScore } from "@/lib/types";
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
  scoreTint,
  type Crumb,
} from "@/components/content";

// Monthly recap: one indexable page per calendar month, built entirely from
// data the site already has — the month's daily_scores rows, its headlines,
// and the curated spike annotations. Rendered on first request, then ISR.
export const revalidate = 21600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

const TOP_HEADLINES = 5;

type Props = { params: Promise<{ month: string }> };

async function loadMonth(month: string) {
  if (!isValidMonth(month)) return null;
  const dailyScores = await getDailyScores();
  const months = summarizeMonths(dailyScores);
  const i = months.findIndex((m) => m.month === month);
  if (i === -1) return null;
  return {
    dailyScores,
    summary: months[i],
    prev: i > 0 ? months[i - 1] : null,
    next: i < months.length - 1 ? months[i + 1] : null,
  };
}

function pageTitle(m: MonthSummary): string {
  return `${monthLabel(m.month)}: how the media covered AI`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params;
  const loaded = await loadMonth(month);
  if (!loaded) return { title: "Month not found" };

  const title = pageTitle(loaded.summary);
  const description = metaDescription(monthSummary(loaded.summary, loaded.prev));

  return {
    title,
    description,
    alternates: { canonical: `/monthly/${month}` },
    openGraph: {
      title: `${title} · AI Sentiment Index`,
      description,
      url: `/monthly/${month}`,
      siteName: "AI Sentiment Index",
      type: "article",
    },
  };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The month as a Monday-first calendar; each day with data links to its page. */
function MonthCalendar({ month, days }: { month: string; days: DailyScore[] }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const lastDay = parseInt(monthEnd(month).slice(8), 10);
  // getUTCDay(): 0 = Sunday. Shift so Monday is column 0.
  const offset = (new Date(`${month}-01T12:00:00Z`).getUTCDay() + 6) % 7;

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < offset; i++) cells.push(<span key={`pad-${i}`} />);
  for (let n = 1; n <= lastDay; n++) {
    const date = `${month}-${String(n).padStart(2, "0")}`;
    const d = byDate.get(date);
    if (!d) {
      cells.push(
        <span
          key={date}
          className="aspect-square sm:aspect-[4/3] rounded-md border border-dashed border-border flex items-start p-1.5 text-[10px] font-mono text-text-tertiary"
        >
          {n}
        </span>
      );
      continue;
    }
    cells.push(
      <Link prefetch={false}
        key={date}
        href={`/day/${date}`}
        title={`${longDate(date)}: ${formatScore(d.mean)} across ${d.count} headlines`}
        className="group aspect-square sm:aspect-[4/3] rounded-md border border-border flex flex-col justify-between p-1.5 transition-colors hover:border-accent"
        style={{ background: scoreTint(d.mean) }}
      >
        <span className="text-[10px] font-mono text-text-secondary group-hover:text-accent">
          {n}
        </span>
        <span className="text-[10px] sm:text-xs font-mono tabular-nums text-text-primary text-right">
          {formatScore(d.mean)}
        </span>
      </Link>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="text-[9px] font-mono uppercase tracking-[0.18em] text-text-tertiary text-center"
          >
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">{cells}</div>
    </div>
  );
}

export default async function MonthPage({ params }: Props) {
  const { month } = await params;
  const loaded = await loadMonth(month);
  if (!loaded) notFound();

  const { dailyScores, summary: m, prev, next } = loaded;
  const headlines = await fetchHeadlinesBetween(`${month}-01`, monthEnd(month));

  const crumbs: Crumb[] = [
    { label: "Dashboard", href: "/" },
    { label: "Monthly", href: "/monthly" },
    { label: monthShortLabel(month) },
  ];

  const summary = monthSummary(m, prev);
  const themes = themeStats(headlines);
  const events = SPIKE_ANNOTATIONS.filter((a) => a.date.startsWith(month));

  const byScore = [...headlines].sort((a, b) => b.score - a.score);
  const topPositive = byScore.slice(0, TOP_HEADLINES).filter((h) => h.score > 0.05);
  const topNegative = byScore
    .slice(-TOP_HEADLINES)
    .reverse()
    .filter((h) => h.score < -0.05);

  // Outlets with a handful of headlines are listed but can't anchor a change.
  const outletRows = m.bySource.filter((r) => r.count >= MIN_HEADLINES_FOR_SOURCE_CALLOUT);
  const totalHeadlines = dailyScores.reduce((sum, d) => sum + d.count, 0);

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd(SITE_URL, crumbs, `/monthly/${month}`)} />
      <SiteHeader
        className="mb-10"
        ownHeading
        tagline={<>Monthly recap &mdash; a month of AI coverage in one page.</>}
      />

      <article className="max-w-3xl mx-auto space-y-12">
        <header className="animate-in space-y-5">
          <Breadcrumbs items={crumbs} />
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
            {pageTitle(m)}
          </h1>
        </header>

        <section className="animate-in delay-1 rounded-xl border border-border bg-card card-glow px-5 py-5 sm:px-6 sm:py-6">
          <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-tertiary">
            Monthly mean
            {m.partial && (
              <span className="text-accent">
                {" "}&middot; month to date, through {shortDate(m.days[m.days.length - 1].date)}
              </span>
            )}
          </p>
          <div className="mt-2 flex items-baseline gap-x-5 gap-y-2 flex-wrap">
            <span
              className={`text-5xl sm:text-6xl font-mono font-medium tabular-nums tracking-tight leading-none ${toneClass(m.mean)}`}
            >
              {formatScore(m.mean, 3)}
            </span>
            {prev && (
              <span className={`text-sm font-mono tabular-nums ${toneClass(m.mean - prev.mean)}`}>
                {m.mean - prev.mean >= 0 ? "▲" : "▼"} {Math.abs(m.mean - prev.mean).toFixed(2)}
                <span className="text-text-tertiary"> vs {monthShortLabel(prev.month)}</span>
              </span>
            )}
          </div>
          <div className="mt-5">
            <DistributionBar
              pos={m.pos}
              neu={m.neu}
              neg={m.neg}
              countLabel={`${m.count.toLocaleString("en-US")} headlines · ${m.days.length} days`}
            />
          </div>
        </section>

        <section className="animate-in delay-2 space-y-4 text-sm text-text-secondary leading-relaxed">
          <p>{summary.join(" ")}</p>
        </section>

        <section className="animate-in delay-3">
          <SectionLabel>Day by day</SectionLabel>
          <SectionHeading>The month at a glance</SectionHeading>
          <MonthCalendar month={month} days={m.days} />
          <p className="mt-3 text-[11px] font-mono text-text-tertiary">
            Each cell is one day&rsquo;s mean, tinted by direction and strength.
            Select a day for its headlines.
          </p>
        </section>

        {events.length > 0 && (
          <section className="animate-in delay-3">
            <SectionLabel>Notable days</SectionLabel>
            <SectionHeading>What moved the index</SectionHeading>
            <ul className="space-y-2">
              {events.map((e) => (
                <li
                  key={e.date}
                  className={`rounded-lg border px-4 py-3 ${
                    e.direction === "up"
                      ? "bg-positive/5 border-positive/30"
                      : "bg-negative/5 border-negative/30"
                  }`}
                >
                  <Link prefetch={false} href={`/day/${e.date}`} className="group block">
                    <span
                      className={`font-mono text-[11px] uppercase tracking-[0.18em] ${
                        e.direction === "up" ? "text-positive" : "text-negative"
                      }`}
                    >
                      {e.direction === "up" ? "▲" : "▼"} {shortDate(e.date)} &middot; {e.label}
                    </span>
                    <span className="block mt-1 text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                      {e.blurb}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {outletRows.length > 1 && (
          <section className="animate-in delay-4">
            <SectionLabel>By outlet</SectionLabel>
            <SectionHeading>Outlets, most positive to most critical</SectionHeading>
            <SourceTable
              rows={outletRows}
              previous={prev ? prev.bySource : undefined}
              changeLabel="Chg"
            />
            <p className="mt-3 text-[11px] font-mono text-text-tertiary">
              {prev
                ? `Change is against ${monthLabel(prev.month)}. `
                : ""}
              The small number beside each outlet is its headline count. For
              longer ranges see the{" "}
              <Link href="/leaderboard" className={LINK_CLASS}>
                leaderboard
              </Link>
              .
            </p>
          </section>
        )}

        {themes.length > 0 && (
          <section className="animate-in delay-4">
            <SectionLabel>Themes</SectionLabel>
            <SectionHeading>What the coverage was about</SectionHeading>
            <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
              <div className="grid grid-cols-[1fr_12ch_6ch] gap-3 px-4 py-3 border-b border-border text-[10px] font-mono uppercase tracking-[0.18em] text-text-tertiary">
                <span>Theme</span>
                <span className="text-right">Headlines</span>
                <span className="text-right">Score</span>
              </div>
              <ul>
                {themes.map((t) => (
                  <li
                    key={t.slug}
                    className="grid grid-cols-[1fr_12ch_6ch] gap-3 items-center px-4 py-2.5 border-b border-border last:border-b-0 text-xs font-mono"
                  >
                    <span className="text-text-primary truncate">{t.label}</span>
                    <span className="text-right tabular-nums text-text-secondary">
                      {t.count}
                      <span className="text-text-tertiary"> · {Math.round(t.share * 100)}%</span>
                    </span>
                    <span className={`text-right tabular-nums ${toneClass(t.mean)}`}>
                      {formatScore(t.mean)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-3 text-[11px] font-mono text-text-tertiary leading-relaxed">
              Themes are matched by keyword on the headline text &mdash; a rough
              cut for orientation, not a model judgment. A headline can match
              several themes or none. The scores themselves are model-scored.
            </p>
          </section>
        )}

        {(topPositive.length > 0 || topNegative.length > 0) && (
          <section className="animate-in delay-5 space-y-8">
            <div>
              <SectionLabel>Headlines</SectionLabel>
              <SectionHeading>The month&rsquo;s strongest readings</SectionHeading>
            </div>
            {topPositive.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-[0.18em] text-text-secondary mb-2">
                  Most positive
                </h3>
                <HeadlineList headlines={topPositive} showDate />
              </div>
            )}
            {topNegative.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-[0.18em] text-text-secondary mb-2">
                  Most negative
                </h3>
                <HeadlineList headlines={topNegative} showDate />
              </div>
            )}
          </section>
        )}

        <PrevNext
          prev={prev ? { href: `/monthly/${prev.month}`, label: monthLabel(prev.month) } : null}
          next={next ? { href: `/monthly/${next.month}`, label: monthLabel(next.month) } : null}
        />
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
