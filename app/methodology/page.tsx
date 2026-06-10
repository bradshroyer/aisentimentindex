import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { MethodologyToc } from "@/components/MethodologyToc";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShareButton } from "@/components/ShareButton";
import sources from "@/data/sources.json";

export const revalidate = 21600;

const DESCRIPTION =
  "How the AI Sentiment Index works: Claude Haiku scores every AI headline from 14 outlets for its stance toward AI on a −1.0 to +1.0 scale, with a lexicon fallback, a 6-hour pipeline, and honest limitations.";

export const metadata: Metadata = {
  title: "Methodology",
  description: DESCRIPTION,
  alternates: { canonical: "/methodology" },
  openGraph: {
    title: "Methodology · AI Sentiment Index",
    description: DESCRIPTION,
    url: "/methodology",
    siteName: "AI Sentiment Index",
    type: "website",
  },
};

const TOC_SECTIONS = [
  { n: "01", id: "scoring", label: "Scoring" },
  { n: "02", id: "model-choice", label: "Model choice" },
  { n: "03", id: "pipeline", label: "Pipeline" },
  { n: "04", id: "sources", label: "Sources" },
  { n: "05", id: "data", label: "Data" },
  { n: "06", id: "limitations", label: "Limitations" },
];

const PIPELINE = [
  { step: "RSS feeds", detail: `${sources.length} outlets` },
  { step: "GitHub Actions", detail: "cron · every 6h" },
  { step: "Claude scoring", detail: "title + summary" },
  { step: "Supabase", detail: "headlines · daily_scores" },
  { step: "Next.js ISR", detail: "revalidates every 6h" },
];

const FAILURE_MODES = [
  {
    n: "01",
    title: "Substring matching.",
    body: (
      <>
        &ldquo;ban&rdquo; matched &ldquo;bank&rdquo; and &ldquo;banking&rdquo;,
        so headlines about banks were docked for prohibitions that were never
        there.
      </>
    ),
  },
  {
    n: "02",
    title: "Context blindness.",
    body: (
      <>
        A lexicon sees &ldquo;wins court order pausing ban&rdquo; as a pile of
        negative words. It cannot model who won, or what winning means for AI.
      </>
    ),
  },
  {
    n: "03",
    title: "News and legal language.",
    body: (
      <>
        Coverage of regulation and litigation uses charged vocabulary in
        neutral or even positive constructions &mdash; and a lexicon scores the
        vocabulary.
      </>
    ),
  },
];

const LIMITATIONS = [
  {
    title: "RSS is a moving window",
    body: (
      <>
        Feeds retain roughly a week of history, and there is no backfill
        source. If ingestion stalls for longer than that, the missed headlines
        are permanently lost.
      </>
    ),
  },
  {
    title: "One model’s judgment",
    body: (
      <>
        Sentiment is subjective, and every score here is a single model reading
        a single prompt. The aggregate trend is more trustworthy than any
        individual score.
      </>
    ),
  },
  {
    title: "The fallback is weaker",
    body: (
      <>
        When scoring falls back to the lexicon, word-boundary regexes prevent
        the worst substring errors, but it still cannot read context &mdash;
        the exact failure that motivated the switch.
      </>
    ),
  },
  {
    title: "It costs money",
    body: (
      <>
        A few cents a day in API calls at current volume. If the key is
        absent or the API errors, the index degrades to lexicon scoring
        rather than stopping.
      </>
    ),
  },
  {
    title: "Volume moves the needle",
    body: (
      <>
        The daily mean weighs every headline equally, so prolific outlets and
        AI-vertical feeds pull harder than occasional publishers &mdash; and
        any change to the source list shows up in the index itself. Long-range
        comparisons read best alongside the per-source view.
      </>
    ),
  },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-text-tertiary mb-3">
      {children}
    </p>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[0.8em] text-text-primary bg-surface-alt rounded px-1.5 py-0.5 whitespace-nowrap">
      {children}
    </code>
  );
}

export default function MethodologyPage() {
  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-12 flex items-start justify-between gap-4 animate-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
            AI Sentiment Index
          </h1>
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full" />
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            Methodology &mdash; how raw headlines become a daily index:
            scoring, model choice, pipeline, and limitations.
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

      <div className="relative max-w-2xl mx-auto">
        <aside className="hidden xl:block absolute right-full top-0 bottom-0 mr-16 animate-in delay-2">
          <MethodologyToc sections={TOC_SECTIONS} />
        </aside>

        <div className="space-y-14">
        <p className="animate-in delay-1 font-serif italic text-xl sm:text-2xl text-text-secondary leading-snug">
          Every headline is scored for its{" "}
          <span className="text-text-primary">stance toward AI</span>&mdash;not
          the sentiment of its words. This page explains how, and where it
          falls short.
        </p>

        {/* 01 — How scoring works */}
        <section id="scoring" className="animate-in delay-2 scroll-mt-10">
          <SectionLabel>01 &middot; Scoring</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
            How scoring works
          </h2>
          <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
            <p>
              Claude Haiku (<Mono>claude-haiku-4-5-20251001</Mono>) reads each
              headline and scores its stance toward AI on a scale from{" "}
              <span className="text-negative">−1.0 (anti-AI)</span> to{" "}
              <span className="text-positive">+1.0 (pro-AI)</span>. It scores
              the title and summary together &mdash; summaries carry context
              that titles drop &mdash; and returns a single number. A
              day&rsquo;s index value is the mean across that day&rsquo;s
              headlines; scores within ±0.05 of zero count as neutral in the
              daily tallies.
            </p>
            <p>
              Stance is not word valence, and the distinction does the real
              work:
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-5">
            <div className="rounded-xl border border-border bg-card card-glow p-4 sm:p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-positive mb-2">
                Scores positive
              </p>
              <p className="font-serif italic text-base sm:text-lg text-text-primary leading-snug mb-2">
                &ldquo;Anthropic Wins Court Order Pausing Ban&rdquo;
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                A win for an AI company &mdash; even though &ldquo;ban&rdquo;
                and &ldquo;court&rdquo; sound negative.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card card-glow p-4 sm:p-5">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-negative mb-2">
                Scores negative
              </p>
              <p className="font-serif italic text-base sm:text-lg text-text-primary leading-snug mb-2">
                &ldquo;AI Replaces 500 Jobs&rdquo;
              </p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Negative for AI sentiment, even though it demonstrates AI
                capability.
              </p>
            </div>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed mt-5">
            Funding rounds, launches, and breakthroughs generally score
            positive; bans, lawsuits, safety failures, and job losses generally
            score negative; neutral reporting lands near zero.
          </p>

          <p className="text-sm text-text-secondary leading-relaxed mt-4">
            The daily mean is{" "}
            <span className="text-text-primary">headline-weighted</span>: every
            headline counts once, so an outlet that publishes more moves that
            day&rsquo;s index more. That is deliberate &mdash; the index
            measures the tone of AI coverage as it actually lands, volume
            included &mdash; but it means a shift can come from who published,
            not only from what changed. The per-source means on the{" "}
            <Link href="/leaderboard" className="text-text-primary hover:text-accent transition-colors underline decoration-border underline-offset-2">
              leaderboard
            </Link>{" "}
            are the volume-neutral view.
          </p>
        </section>

        {/* 02 — Why an LLM instead of a lexicon */}
        <section id="model-choice" className="animate-in delay-3 scroll-mt-10">
          <SectionLabel>02 &middot; Model choice</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
            Why an LLM instead of a lexicon
          </h2>
          <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
            <p>
              The index did not start with Claude. The first scorer was VADER,
              a lexicon-based sentiment analyzer, patched with hand-built
              dictionaries of domain adjustments &mdash; boosts for words like
              &ldquo;breakthrough&rdquo; and &ldquo;funding&rdquo;, penalties
              for &ldquo;lawsuit&rdquo; and &ldquo;existential risk&rdquo;.
            </p>
            <p>
              It kept failing in ways no dictionary could patch. Tested against
              Claude on the same headlines, VADER agreed on direction only{" "}
              <span className="text-text-primary">62% of the time</span>. Three
              failure modes accounted for most of the gap:
            </p>
          </div>

          <ul className="space-y-3 my-5">
            {FAILURE_MODES.map((f) => (
              <li key={f.n} className="flex gap-3">
                <span
                  className="text-accent font-mono text-[10px] leading-[1.7rem] tracking-[0.18em] select-none shrink-0"
                  aria-hidden="true"
                >
                  {f.n}
                </span>
                <p className="text-sm text-text-secondary leading-relaxed">
                  <span className="text-text-primary">{f.title}</span> {f.body}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-sm text-text-secondary leading-relaxed">
            So Claude Haiku became the primary scorer. At the current volume
            of 100-odd headlines a day, that costs{" "}
            <span className="text-text-primary">a few cents per day</span>
            . VADER never left, though: its compound score is still computed
            for every headline and stored as <Mono>score_raw</Mono>, and it
            remains the fallback &mdash; now with word-boundary regexes for
            terms like &ldquo;ban&rdquo; &mdash; whenever the API key is
            missing or a request fails. Every row records which scorer produced
            it in a <Mono>scored_by</Mono> field, so scorer changes can be
            audited later.
          </p>
        </section>

        {/* 03 — The pipeline */}
        <section id="pipeline" className="animate-in delay-4 scroll-mt-10">
          <SectionLabel>03 &middot; Pipeline</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
            From feed to chart
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            A GitHub Actions cron runs every six hours. It pulls{" "}
            {sources.length} RSS feeds, keeps headlines that match an AI
            keyword filter, dedupes against everything already stored, and
            scores only what is new. Headlines and daily aggregates &mdash;
            mean, counts, per-source breakdowns &mdash; are upserted into two
            Supabase tables, and the Next.js frontend re-renders on the same
            six-hour cadence via incremental static regeneration.
          </p>

          <div className="rounded-xl border border-border bg-card card-glow p-5 my-5">
            <ol className="flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-2">
              {PIPELINE.map((p, i) => (
                <li
                  key={p.step}
                  className="flex flex-col sm:flex-row items-center gap-3 sm:gap-2 sm:flex-1"
                >
                  <div className="text-center sm:flex-1">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-primary">
                      {p.step}
                    </p>
                    <p className="text-[10px] font-mono text-text-tertiary mt-1">
                      {p.detail}
                    </p>
                  </div>
                  {i < PIPELINE.length - 1 && (
                    <span
                      className="text-accent/70 font-mono text-xs select-none"
                      aria-hidden="true"
                    >
                      <span className="hidden sm:inline">&rarr;</span>
                      <span className="sm:hidden">&darr;</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">
            No queue, no inference servers, nothing to babysit: a cron job, one
            Python script, a Postgres database, and a static site.
          </p>
        </section>

        {/* 04 — Sources */}
        <section id="sources" className="animate-in delay-5 scroll-mt-10">
          <SectionLabel>04 &middot; Sources</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
            What gets read
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            {sources.length} outlets, spanning general tech press, business
            desks, and AI-specific verticals. The list lives in a single{" "}
            <Mono>sources.json</Mono> consumed by both the Python ingester and
            this site &mdash; including the grid below.
          </p>

          <ul className="flex flex-wrap gap-2 my-5">
            {sources.map((s) => (
              <li
                key={s.name}
                className="text-[11px] font-mono text-text-secondary border border-border bg-card rounded-lg px-3 py-1.5"
              >
                {s.name}
              </li>
            ))}
          </ul>

          <p className="text-sm text-text-secondary leading-relaxed">
            Feeds are fetched in full on every run; a headline enters the index
            only if it matches the AI keyword filter.
          </p>
        </section>

        {/* 05 — Data */}
        <section id="data" className="animate-in delay-5 scroll-mt-10">
          <SectionLabel>05 &middot; Data</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
            Take the data
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            The full dataset &mdash; every scored headline and every daily
            aggregate since January 2025 &mdash; is exported weekly to the
            repository as JSON and CSV, free to use with attribution:{" "}
            <a
              href="https://github.com/bradshroyer/aisentimentindex/tree/main/data/export"
              className="text-text-primary hover:text-accent transition-colors underline decoration-border underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              data/export on GitHub
            </a>
            . <Mono>daily_scores.json</Mono> is the index itself;{" "}
            <Mono>headlines.csv</Mono> has every row behind it.
          </p>
        </section>

        {/* 06 — Limitations */}
        <section id="limitations" className="animate-in delay-5 scroll-mt-10">
          <SectionLabel>06 &middot; Limitations</SectionLabel>
          <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">
            Honest limitations
          </h2>
          <ul className="space-y-5">
            {LIMITATIONS.map((l) => (
              <li key={l.title}>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-primary mb-1.5">
                  {l.title}
                </p>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {l.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Back to dashboard */}
        <div className="animate-in delay-5 pb-12">
          <div
            className="flex items-center justify-center gap-5 mb-8"
            aria-hidden="true"
          >
            <span className="h-px flex-1 bg-border" />
            <span className="font-serif text-accent/70 text-lg leading-none select-none">
              ✦
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <p className="text-center">
            <Link
              href="/"
              className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-secondary hover:text-accent transition-colors"
            >
              &larr; Back to the dashboard
            </Link>
          </p>
        </div>
        </div>
      </div>
    </main>
  );
}
