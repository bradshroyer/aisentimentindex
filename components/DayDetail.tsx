"use client";

import type { DailyScore, Headline } from "@/lib/types";

interface DayDetailProps {
  dailyScore: DailyScore;
  prevDailyScore: DailyScore | null;
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

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${months[parseInt(month, 10)]} ${parseInt(day, 10)}, ${year}`;
}

export function DayDetail({ dailyScore, prevDailyScore, headlines, onClose }: DayDetailProps) {
  const { mean, count, pos, neg, neu, by_source } = dailyScore;
  const delta = prevDailyScore ? mean - prevDailyScore.mean : null;

  // Source breakdown sorted by score
  const sourceEntries = Object.entries(by_source)
    .sort((a, b) => b[1].mean - a[1].mean);

  // Top positive and negative headlines
  const sortedByScore = [...headlines].sort((a, b) => b.score - a.score);
  const topPositive = sortedByScore.slice(0, 3).filter((h) => h.score > 0.05);
  const topNegative = sortedByScore.slice(-3).reverse().filter((h) => h.score < -0.05);

  // Distribution bar percentages
  const total = pos + neg + neu || 1;
  const posPct = (pos / total) * 100;
  const negPct = (neg / total) * 100;
  const neuPct = (neu / total) * 100;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{formatDate(dailyScore.date)}</h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={`text-2xl font-bold tabular-nums ${scoreColor(mean)}`}>
                {mean >= 0 ? "+" : ""}{mean.toFixed(3)}
              </span>
              {delta !== null && (
                <span className={`text-sm tabular-nums ${scoreColor(delta)}`}>
                  {delta >= 0 ? "\u25B2" : "\u25BC"} {Math.abs(delta).toFixed(3)} vs prev day
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none cursor-pointer px-2"
        >
          &times;
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Distribution bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>{count} headlines</span>
            <span className="flex gap-3">
              <span className="text-positive">{pos} positive</span>
              <span className="text-neutral">{neu} neutral</span>
              <span className="text-negative">{neg} negative</span>
            </span>
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
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

        {/* Source breakdown grid */}
        {sourceEntries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">By Source</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {sourceEntries.map(([source, stats]) => (
                <div
                  key={source}
                  className={`rounded-lg px-3 py-2 ${scoreBg(stats.mean)}`}
                >
                  <div className="text-xs font-medium truncate">{source}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-sm font-bold tabular-nums">
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
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Most Positive</h4>
              <div className="space-y-2">
                {topPositive.map((h) => (
                  <div key={h.id} className="flex items-start gap-2">
                    <span className="text-xs font-bold text-positive tabular-nums shrink-0 mt-0.5">
                      +{h.score.toFixed(2)}
                    </span>
                    <a
                      href={h.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-700 dark:text-slate-300 hover:text-accent leading-snug line-clamp-2"
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
              <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Most Negative</h4>
              <div className="space-y-2">
                {topNegative.map((h) => (
                  <div key={h.id} className="flex items-start gap-2">
                    <span className="text-xs font-bold text-negative tabular-nums shrink-0 mt-0.5">
                      {h.score.toFixed(2)}
                    </span>
                    <a
                      href={h.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-700 dark:text-slate-300 hover:text-accent leading-snug line-clamp-2"
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
