import type { Metadata } from "next";
import Link from "next/link";
import { getDailyScores } from "@/lib/data";
import { SPIKE_ANNOTATIONS } from "@/lib/annotations";
import {
  MONTHS_SHORT,
  formatScore,
  longDate,
  monthLabel,
  shortDate,
  toneClass,
} from "@/lib/format";
import { aggregate, summarizeMonths, type MonthSummary } from "@/lib/recaps";
import { ACTIVE_SOURCE_COUNT } from "@/lib/types";
import { SITE_URL } from "@/lib/site";
import { SiteHeader } from "@/components/SiteHeader";
import { MethodologyFooter } from "@/components/MethodologyFooter";
import {
  Breadcrumbs,
  JsonLd,
  SectionHeading,
  SectionLabel,
  breadcrumbJsonLd,
  type Crumb,
} from "@/components/content";

export const revalidate = 21600;

const DESCRIPTION = `Month-by-month recaps of how ${ACTIVE_SOURCE_COUNT} major news outlets covered AI: the monthly sentiment score, the days that moved it, outlet rankings, and the headlines behind the number.`;

export const metadata: Metadata = {
  title: "Monthly recaps: how the media covered AI",
  description: DESCRIPTION,
  alternates: { canonical: "/monthly" },
  openGraph: {
    title: "Monthly recaps · AI Sentiment Index",
    description: DESCRIPTION,
    url: "/monthly",
    siteName: "AI Sentiment Index",
    type: "website",
  },
};

const CRUMBS: Crumb[] = [{ label: "Dashboard", href: "/" }, { label: "Monthly" }];

/**
 * Every month as a bar diverging from zero, oldest → newest. Plain links and
 * CSS — no chart library — so it renders in the static HTML.
 */
function MonthBars({ months }: { months: MonthSummary[] }) {
  const maxAbs = Math.max(0.1, ...months.map((m) => Math.abs(m.mean))) * 1.1;
  return (
    <div className="rounded-xl border border-border bg-card card-glow px-3 pt-4 pb-3 sm:px-5">
      <div className="relative flex items-stretch gap-[3px] sm:gap-1.5 h-36">
        <span className="absolute left-0 right-0 top-1/2 h-px bg-chart-zero" aria-hidden="true" />
        {months.map((m) => {
          const pct = (Math.abs(m.mean) / maxAbs) * 50;
          return (
            <Link prefetch={false}
              key={m.month}
              href={`/monthly/${m.month}`}
              title={`${monthLabel(m.month)}: ${formatScore(m.mean)} across ${m.count.toLocaleString("en-US")} headlines`}
              aria-label={`${monthLabel(m.month)}: ${formatScore(m.mean)}`}
              className="group relative flex-1 min-w-0"
            >
              <span
                className={`absolute inset-x-0 transition-opacity group-hover:opacity-100 ${
                  m.mean >= 0
                    ? "bottom-1/2 bg-positive rounded-t-sm"
                    : "top-1/2 bg-negative rounded-b-sm"
                } ${m.partial ? "opacity-40" : "opacity-70"}`}
                style={{ height: `${Math.max(pct, 1)}%` }}
              />
            </Link>
          );
        })}
      </div>
      <div className="flex gap-[3px] sm:gap-1.5 mt-2" aria-hidden="true">
        {months.map((m) => {
          const mm = parseInt(m.month.slice(5), 10);
          return (
            <span
              key={m.month}
              className="flex-1 min-w-0 text-center text-[9px] font-mono text-text-tertiary overflow-hidden"
            >
              {mm === 1 ? `’${m.month.slice(2, 4)}` : MONTHS_SHORT[mm][0]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default async function MonthlyIndexPage() {
  const dailyScores = await getDailyScores();
  const months = summarizeMonths(dailyScores);
  const newestFirst = [...months].reverse();
  const overall = aggregate(dailyScores);

  const complete = months.filter((m) => !m.partial);
  let high: MonthSummary | null = null;
  let low: MonthSummary | null = null;
  for (const m of complete) {
    if (!high || m.mean > high.mean) high = m;
    if (!low || m.mean < low.mean) low = m;
  }

  const events = [...SPIKE_ANNOTATIONS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={breadcrumbJsonLd(SITE_URL, CRUMBS, "/monthly")} />
      <SiteHeader
        className="mb-10"
        ownHeading
        tagline={<>Monthly recaps &mdash; the index, one month at a time.</>}
      />

      <div className="max-w-3xl mx-auto space-y-12">
        <header className="animate-in space-y-5">
          <Breadcrumbs items={CRUMBS} />
          <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-tight">
            Monthly recaps: how the media covered AI
          </h1>
          {months.length > 0 && (
            <p className="text-sm text-text-secondary leading-relaxed">
              Since {longDate(dailyScores[0].date)}, the index has scored{" "}
              {overall.count.toLocaleString("en-US")} headlines about AI from{" "}
              {ACTIVE_SOURCE_COUNT} outlets, averaging{" "}
              <span className={toneClass(overall.mean)}>{formatScore(overall.mean)}</span>{" "}
              on a −1 to +1 scale.
              {high && low && high.month !== low.month && (
                <>
                  {" "}The most positive full month was{" "}
                  <Link prefetch={false} href={`/monthly/${high.month}`} className="text-text-primary hover:text-accent transition-colors underline decoration-border underline-offset-2">
                    {monthLabel(high.month)}
                  </Link>{" "}
                  ({formatScore(high.mean)}); the most critical was{" "}
                  <Link prefetch={false} href={`/monthly/${low.month}`} className="text-text-primary hover:text-accent transition-colors underline decoration-border underline-offset-2">
                    {monthLabel(low.month)}
                  </Link>{" "}
                  ({formatScore(low.mean)}).
                </>
              )}
            </p>
          )}
        </header>

        {months.length > 1 && (
          <section className="animate-in delay-1">
            <SectionLabel>Every month</SectionLabel>
            <MonthBars months={months} />
          </section>
        )}

        <section className="animate-in delay-2">
          <SectionLabel>Recaps</SectionLabel>
          <SectionHeading>Month by month</SectionHeading>
          <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
            <div className="grid grid-cols-[1fr_7ch_6ch] sm:grid-cols-[1fr_10ch_7ch_6ch] gap-3 px-4 py-3 border-b border-border text-[10px] font-mono uppercase tracking-[0.18em] text-text-tertiary">
              <span>Month</span>
              <span className="hidden sm:block text-right">Headlines</span>
              <span className="text-right">Chg</span>
              <span className="text-right">Score</span>
            </div>
            <ul>
              {newestFirst.map((m, i) => {
                const prev = newestFirst[i + 1] ?? null;
                const delta = prev ? m.mean - prev.mean : null;
                return (
                  <li key={m.month}>
                    <Link prefetch={false}
                      href={`/monthly/${m.month}`}
                      className="grid grid-cols-[1fr_7ch_6ch] sm:grid-cols-[1fr_10ch_7ch_6ch] gap-3 items-center px-4 py-3 border-b border-border last:border-b-0 text-xs font-mono hover:bg-surface-alt/60 transition-colors group"
                    >
                      <span className="text-text-primary group-hover:text-accent transition-colors truncate">
                        {monthLabel(m.month)}
                        {m.partial && (
                          <span className="text-text-tertiary"> · to date</span>
                        )}
                      </span>
                      <span className="hidden sm:block text-right tabular-nums text-text-secondary">
                        {m.count.toLocaleString("en-US")}
                      </span>
                      <span className="text-right tabular-nums text-text-tertiary">
                        {delta === null ? "—" : formatScore(delta)}
                      </span>
                      <span className={`text-right tabular-nums ${toneClass(m.mean)}`}>
                        {formatScore(m.mean)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {events.length > 0 && (
          <section className="animate-in delay-3">
            <SectionLabel>Notable days</SectionLabel>
            <SectionHeading>The biggest swings, explained</SectionHeading>
            <p className="text-sm text-text-secondary leading-relaxed mb-5">
              Hand-labelled days where the index moved sharply, with the
              stories that drove it. Each links to that day&rsquo;s full
              reading.
            </p>
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
                      {e.direction === "up" ? "▲" : "▼"} {shortDate(e.date, true)} &middot; {e.label}
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
      </div>

      <MethodologyFooter
        totalHeadlines={overall.count}
        daysTracked={dailyScores.length}
        firstDate={dailyScores[0]?.date ?? ""}
        lastDate={dailyScores[dailyScores.length - 1]?.date ?? ""}
      />
    </main>
  );
}
