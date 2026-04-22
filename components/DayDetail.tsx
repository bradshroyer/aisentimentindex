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

  const sourceEntries = Object.entries(by_source).sort((a, b) => b[1].mean - a[1].mean);

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
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-medium text-text-secondary">{longLabel}</h3>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className={`text-2xl font-bold font-mono tabular-nums ${scoreColor(mean)}`}>
                {mean >= 0 ? "+" : ""}{mean.toFixed(3)}
              </span>
              {delta !== null && (
                <span className={`text-sm font-mono tabular-nums ${scoreColor(delta)}`}>
                  {delta >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(delta).toFixed(3)} vs {nouns.prev}
                </span>
              )}
              {showSpread && (
                <span className="text-xs font-mono text-text-tertiary tabular-nums">
                  range {min.toFixed(2)} .. {max.toFixed(2)} over {dates.length} day{dates.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary text-xl leading-none cursor-pointer px-2"
        >
          &times;
        </button>
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

        {/* Distribution bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-text-secondary mb-1.5">
            <span>{count} headlines{granularity !== "day" ? ` this ${nouns.unit}` : ""}</span>
            <span className="flex gap-3">
              <span className="text-positive">{pos} positive</span>
              <span className="text-neutral">{neu} neutral</span>
              <span className="text-negative">{neg} negative</span>
            </span>
          </div>
          <div className="flex h-2 rounded-sm overflow-hidden bg-surface-alt">
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
        </div>

        {/* Source breakdown grid (hidden when filtered to a single source) */}
        {sourceEntries.length > 1 && (
          <div>
            <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 font-mono">By Source</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {sourceEntries.map(([source, stats]) => (
                <div
                  key={source}
                  className={`rounded-lg px-3 py-2 transition-transform duration-200 hover:scale-[1.02] ${scoreBg(stats.mean)}`}
                >
                  <div className="text-xs font-medium truncate">{source}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-sm font-bold font-mono tabular-nums">
                      {stats.mean >= 0 ? "+" : ""}{stats.mean.toFixed(3)}
                    </span>
                    <span className="text-xs opacity-60">{stats.count} art.</span>
                  </div>
                </div>
              ))}
            </div>
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
