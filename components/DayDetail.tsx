"use client";

import type { Headline } from "@/lib/types";
import type { Bucket } from "@/lib/bucketing";
import { SPIKE_ANNOTATIONS } from "@/lib/annotations";

interface DayDetailProps {
  bucket: Bucket;
  prevBucket: Bucket | null;
  headlines: Headline[];
  onClose: () => void;
}

function scoreColor(score: number): string {
  if (score > 0.05) return "text-positive";
  if (score < -0.05) return "text-negative";
  return "text-neutral";
}

function scoreBg(score: number): string {
  if (score > 0.05) return "bg-positive/10 text-positive";
  if (score < -0.05) return "bg-negative/10 text-negative";
  return "bg-neutral/10 text-neutral";
}

const GRANULARITY_LABELS = {
  day: { prev: "prev day", unit: "day" },
  week: { prev: "prev week", unit: "week" },
  month: { prev: "prev month", unit: "month" },
} as const;

export function DayDetail({ bucket, prevBucket, headlines, onClose }: DayDetailProps) {
  const { mean, count, pos, neg, neu, by_source, granularity, min, max, dates, longLabel } = bucket;
  const delta = prevBucket ? mean - prevBucket.mean : null;
  const nouns = GRANULARITY_LABELS[granularity];

  // Sources with only 1-2 articles overstate precision (e.g. "Wired +0.750 / 1 art.").
  // Hide them from the tile grid; show a compact footnote instead.
  const allSourceEntries = Object.entries(by_source).sort((a, b) => b[1].mean - a[1].mean);
  const sourceEntries = allSourceEntries.filter(([, s]) => s.count >= 3);
  const thinSources = allSourceEntries.length - sourceEntries.length;

  const sortedByScore = [...headlines].sort((a, b) => b.score - a.score);
  const topPositive = sortedByScore.slice(0, 3).filter((h) => h.score > 0.05);
  const topNegative = sortedByScore.slice(-3).reverse().filter((h) => h.score < -0.05);

  const total = pos + neg + neu || 1;
  const posPct = (pos / total) * 100;
  const negPct = (neg / total) * 100;
  const neuPct = (neu / total) * 100;

  const spread = max - min;
  const showSpread = granularity !== "day" && spread > 0.0005;

  const spikes = SPIKE_ANNOTATIONS.filter(
    (a) => a.date >= bucket.start && a.date <= bucket.end,
  );

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden transition-all duration-300 card-glow">
      {/* Hero block: date → big score → distribution as one unit */}
      <div className="px-5 py-5 sm:px-6 sm:py-6 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-tertiary">
              {longLabel}
            </div>
            <div className="mt-2 flex items-baseline gap-4 flex-wrap">
              <span
                className={`text-5xl sm:text-6xl font-mono font-medium tabular-nums tracking-tight leading-none ${scoreColor(mean)}`}
              >
                {mean >= 0 ? "+" : ""}{mean.toFixed(3)}
              </span>
              <div className="flex flex-col gap-0.5">
                {delta !== null && (
                  <span className={`text-sm font-mono tabular-nums ${scoreColor(delta)}`}>
                    {delta >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(delta).toFixed(3)}
                    <span className="text-text-tertiary"> vs {nouns.prev}</span>
                  </span>
                )}
                {showSpread && (
                  <span className="text-xs font-mono text-text-tertiary tabular-nums">
                    range {min.toFixed(2)} .. {max.toFixed(2)} over {dates.length} day{dates.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex h-1.5 rounded-sm overflow-hidden bg-surface-alt">
                {posPct > 0 && (
                  <div
                    className="bg-positive transition-all duration-500"
                    style={{ width: `${posPct}%` }}
                  />
                )}
                {neuPct > 0 && (
                  <div
                    className="bg-neutral/40 transition-all duration-500"
                    style={{ width: `${neuPct}%` }}
                  />
                )}
                {negPct > 0 && (
                  <div
                    className="bg-negative transition-all duration-500"
                    style={{ width: `${negPct}%` }}
                  />
                )}
              </div>
              <div className="mt-2 flex items-center gap-4 text-[11px] font-mono tabular-nums">
                <span className="text-text-secondary">
                  {count} headlines{granularity !== "day" ? ` this ${nouns.unit}` : ""}
                </span>
                <span className="text-positive">{pos} pos</span>
                <span className="text-neutral">{neu} neu</span>
                <span className="text-negative">{neg} neg</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary text-xl leading-none cursor-pointer px-2 -mr-2 -mt-1 shrink-0"
            aria-label="Close day detail"
          >
            &times;
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {spikes.length > 0 && (
          <div className="space-y-1.5">
            {spikes.map((s) => (
              <div
                key={s.date}
                className={`rounded-md border px-3 py-2 text-xs leading-snug ${
                  s.direction === "up"
                    ? "bg-positive/5 border-positive/30"
                    : "bg-negative/5 border-negative/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono font-semibold text-[11px] uppercase tracking-wider ${
                      s.direction === "up" ? "text-positive" : "text-negative"
                    }`}
                  >
                    {s.direction === "up" ? "\u25B2" : "\u25BC"} {s.label}
                  </span>
                  {granularity !== "day" && (
                    <span className="text-[10px] font-mono text-text-tertiary">
                      {s.date}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-text-secondary">{s.blurb}</p>
              </div>
            ))}
          </div>
        )}

        {/* Source breakdown — diverging bars from zero */}
        {sourceEntries.length > 1 && (
          <div>
            <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 font-mono">By Source</h4>
            <div className="grid grid-cols-[minmax(0,7rem)_1fr_auto] gap-x-3 gap-y-0.5 items-center text-xs">
              {sourceEntries.map(([source, stats]) => {
                const isPos = stats.mean > 0;
                // Scale bars so ±0.8 fills the half-width; clamp at 100%.
                const barPct = Math.min(Math.abs(stats.mean) / 0.8, 1) * 100;
                return (
                  <div key={source} className="contents group">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="truncate text-text-primary">{source}</span>
                      <span className="font-mono tabular-nums text-[10px] text-text-tertiary shrink-0">
                        {stats.count}
                      </span>
                    </div>
                    <div className="relative h-4 flex items-center" aria-hidden="true">
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                      {isPos ? (
                        <div
                          className="absolute left-1/2 h-1.5 bg-positive/70 rounded-r-sm transition-all duration-500 group-hover:bg-positive"
                          style={{ width: `${barPct / 2}%` }}
                        />
                      ) : (
                        <div
                          className="absolute right-1/2 h-1.5 bg-negative/70 rounded-l-sm transition-all duration-500 group-hover:bg-negative"
                          style={{ width: `${barPct / 2}%` }}
                        />
                      )}
                    </div>
                    <span className={`font-mono tabular-nums text-right ${scoreColor(stats.mean)}`}>
                      {stats.mean >= 0 ? "+" : ""}{stats.mean.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
            {thinSources > 0 && (
              <p className="mt-2 text-[11px] font-mono text-text-tertiary">
                {`+ ${thinSources} source${thinSources !== 1 ? "s" : ""} with fewer than 3 headlines hidden`}
              </p>
            )}
          </div>
        )}

        {/* Top movers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {topPositive.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 font-mono">Most Positive</h4>
              <div className="space-y-2">
                {topPositive.map((h) => (
                  <div key={h.id} className="flex items-start gap-2">
                    <span className="text-xs font-bold font-mono text-positive tabular-nums shrink-0 mt-0.5">
                      +{h.score.toFixed(2)}
                    </span>
                    <a
                      href={h.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-primary hover:text-accent leading-snug line-clamp-2"
                    >
                      {h.title}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topNegative.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 font-mono">Most Negative</h4>
              <div className="space-y-2">
                {topNegative.map((h) => (
                  <div key={h.id} className="flex items-start gap-2">
                    <span className="text-xs font-bold font-mono text-negative tabular-nums shrink-0 mt-0.5">
                      {h.score.toFixed(2)}
                    </span>
                    <a
                      href={h.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-text-primary hover:text-accent leading-snug line-clamp-2"
                    >
                      {h.title}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
