import Link from "next/link";
import type { Headline } from "@/lib/types";
import type { SourceRow } from "@/lib/recaps";
import { formatScore, shortDate, toneClass } from "@/lib/format";

// Presentational pieces shared by the server-rendered content pages
// (/day/[date], /monthly, /monthly/[month], /data). No hooks and no "use
// client" — these render to plain HTML so the pages ship zero extra JS and
// crawlers get the full content.

export const LINK_CLASS =
  "text-text-primary hover:text-accent transition-colors underline decoration-border underline-offset-2";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-text-tertiary mb-3">
      {children}
    </p>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-2xl sm:text-3xl tracking-tight mb-4">{children}</h2>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono uppercase tracking-[0.18em] text-text-tertiary">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? (
              <Link href={c.href} className="hover:text-accent transition-colors">
                {c.label}
              </Link>
            ) : (
              <span className="text-text-secondary" aria-current="page">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** schema.org BreadcrumbList for the same trail (last item = current page). */
export function breadcrumbJsonLd(siteUrl: string, items: Crumb[], currentPath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: `${siteUrl}${c.href ?? currentPath}`,
    })),
  };
}

/** Inline JSON-LD; `<` is escaped so no value can close the script tag early. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Positive / neutral / negative split as one stacked bar with its counts. */
export function DistributionBar({
  pos,
  neu,
  neg,
  countLabel,
}: {
  pos: number;
  neu: number;
  neg: number;
  countLabel: string;
}) {
  const total = pos + neu + neg || 1;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div>
      <div
        className="flex h-1.5 rounded-sm overflow-hidden bg-surface-alt"
        role="img"
        aria-label={`${pos} positive, ${neu} neutral, ${neg} negative`}
      >
        {pos > 0 && <div className="bg-positive" style={{ width: pct(pos) }} />}
        {neu > 0 && <div className="bg-neutral/40" style={{ width: pct(neu) }} />}
        {neg > 0 && <div className="bg-negative" style={{ width: pct(neg) }} />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono tabular-nums">
        <span className="text-text-secondary">{countLabel}</span>
        <span className="text-positive">{pos.toLocaleString("en-US")} pos</span>
        <span className="text-neutral">{neu.toLocaleString("en-US")} neu</span>
        <span className="text-negative">{neg.toLocaleString("en-US")} neg</span>
      </div>
    </div>
  );
}

/**
 * Per-outlet means as bars diverging from zero. `previous` (same outlets, the
 * prior period) adds a change column. Bars share one scale: ±0.8 fills a half.
 */
export function SourceTable({
  rows,
  previous,
  changeLabel,
}: {
  rows: SourceRow[];
  previous?: SourceRow[];
  changeLabel?: string;
}) {
  const prev = new Map((previous ?? []).map((r) => [r.source, r]));
  const showChange = previous !== undefined;
  const grid = showChange
    ? "grid-cols-[minmax(0,9rem)_1fr_5ch_6ch]"
    : "grid-cols-[minmax(0,9rem)_1fr_6ch]";

  return (
    <div className="rounded-xl border border-border bg-card card-glow overflow-hidden">
      <div
        className={`grid ${grid} gap-3 px-4 py-3 border-b border-border text-[10px] font-mono uppercase tracking-[0.18em] text-text-tertiary`}
      >
        <span>Outlet</span>
        <span className="flex items-center justify-between normal-case tracking-normal text-[9px]">
          <span>critical</span>
          <span>0</span>
          <span>positive</span>
        </span>
        {showChange && <span className="text-right">{changeLabel ?? "Chg"}</span>}
        <span className="text-right">Score</span>
      </div>
      <ul>
        {rows.map((r) => {
          const barPct = Math.min(Math.abs(r.mean) / 0.8, 1) * 50;
          const p = prev.get(r.source);
          const delta = p ? r.mean - p.mean : null;
          return (
            <li
              key={r.source}
              className={`grid ${grid} gap-3 items-center px-4 py-2.5 border-b border-border last:border-b-0 text-xs font-mono`}
            >
              <span className="flex items-baseline gap-1.5 min-w-0">
                <span className="truncate text-text-primary">{r.source}</span>
                <span className="tabular-nums text-[10px] text-text-tertiary shrink-0">
                  {r.count}
                </span>
              </span>
              <span className="relative h-4" aria-hidden="true">
                <span className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                <span
                  className={`absolute top-1 bottom-1 ${
                    r.mean >= 0
                      ? "left-1/2 bg-positive/60 rounded-r-sm"
                      : "right-1/2 bg-negative/60 rounded-l-sm"
                  }`}
                  style={{ width: `${barPct}%` }}
                />
              </span>
              {showChange && (
                <span className="text-right tabular-nums text-text-tertiary">
                  {delta === null ? "—" : formatScore(delta)}
                </span>
              )}
              <span className={`text-right tabular-nums ${toneClass(r.mean)}`}>
                {formatScore(r.mean)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Scored headlines as a list: score, linked title, outlet (and date). */
export function HeadlineList({
  headlines,
  showDate = false,
}: {
  headlines: Headline[];
  showDate?: boolean;
}) {
  return (
    <ul className="rounded-xl border border-border bg-card card-glow overflow-hidden">
      {headlines.map((h) => (
        <li
          key={h.id}
          className="flex items-start gap-3 px-4 py-3 border-b border-border/60 last:border-b-0"
        >
          <span
            className={`w-[5ch] shrink-0 text-xs font-mono tabular-nums mt-0.5 ${toneClass(h.score)}`}
          >
            {formatScore(h.score)}
          </span>
          <span className="min-w-0">
            {h.url ? (
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-text-primary hover:text-accent hover:underline leading-snug"
              >
                {h.title}
              </a>
            ) : (
              <span className="text-sm text-text-primary leading-snug">{h.title}</span>
            )}
            <span className="block text-[11px] font-mono text-text-tertiary mt-0.5">
              {h.source}
              {showDate && (
                <>
                  {" · "}
                  <Link prefetch={false} href={`/day/${h.date}`} className="hover:text-accent transition-colors">
                    {shortDate(h.date)}
                  </Link>
                </>
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Previous / next links at the foot of a day or month page. */
export function PrevNext({
  prev,
  next,
}: {
  prev: { href: string; label: string } | null;
  next: { href: string; label: string } | null;
}) {
  const cls =
    "text-[11px] font-mono uppercase tracking-[0.18em] text-text-secondary hover:text-accent transition-colors";
  return (
    <nav
      aria-label="Adjacent periods"
      className="flex items-center justify-between gap-4 pt-6 border-t border-border/70"
    >
      {prev ? (
        <Link prefetch={false} href={prev.href} className={cls} rel="prev">
          &larr; {prev.label}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link prefetch={false} href={next.href} className={cls} rel="next">
          {next.label} &rarr;
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Background tint for a score: hue by sign, strength by magnitude. */
export function scoreTint(mean: number): string {
  const strength = Math.round(10 + Math.min(Math.abs(mean) / 0.5, 1) * 45);
  if (Math.abs(mean) <= 0.05) return "color-mix(in srgb, var(--color-neutral) 14%, transparent)";
  const token = mean > 0 ? "var(--color-positive)" : "var(--color-negative)";
  return `color-mix(in srgb, ${token} ${strength}%, transparent)`;
}
