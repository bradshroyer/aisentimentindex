"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DailyScore } from "@/lib/types";
import { TIME_RANGES } from "@/lib/types";

interface LeaderboardRow {
  source: string;
  mean: number;
  count: number;
  series: number[];
}

function windowedScores(dailyScores: DailyScore[], rangeDays: number): DailyScore[] {
  if (rangeDays === 0 || dailyScores.length === 0) return dailyScores;
  const last = dailyScores[dailyScores.length - 1].date;
  const cutoff = new Date(last + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - rangeDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return dailyScores.filter((d) => d.date >= cutoffStr);
}

function computeLeaderboard(
  dailyScores: DailyScore[],
  rangeDays: number
): LeaderboardRow[] {
  const windowed = windowedScores(dailyScores, rangeDays);
  const agg = new Map<
    string,
    { sum: number; count: number; daily: { mean: number; count: number }[] }
  >();

  for (const d of windowed) {
    for (const [src, stats] of Object.entries(d.by_source)) {
      if (!stats || stats.count === 0) continue;
      let a = agg.get(src);
      if (!a) {
        a = { sum: 0, count: 0, daily: [] };
        agg.set(src, a);
      }
      a.sum += stats.mean * stats.count;
      a.count += stats.count;
      a.daily.push({ mean: stats.mean, count: stats.count });
    }
  }

  const rows: LeaderboardRow[] = [];
  for (const [source, a] of agg) {
    if (a.count === 0) continue;
    // Decimate to ~24 sparkline points via equal-sized chunks.
    const target = 24;
    const step = Math.max(1, Math.ceil(a.daily.length / target));
    const series: number[] = [];
    for (let i = 0; i < a.daily.length; i += step) {
      const slice = a.daily.slice(i, i + step);
      const wSum = slice.reduce((s, x) => s + x.mean * x.count, 0);
      const wN = slice.reduce((s, x) => s + x.count, 0);
      series.push(wN > 0 ? wSum / wN : 0);
    }
    rows.push({ source, mean: a.sum / a.count, count: a.count, series });
  }

  rows.sort((a, b) => b.mean - a.mean);
  return rows;
}

function formatMean(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="inline-block w-16 h-4" />;
  const w = 64;
  const h = 16;
  const min = -1;
  const max = 1;
  const xStep = w / (points.length - 1);
  const path = points
    .map((v, i) => {
      const x = i * xStep;
      const y = h - ((v - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const zeroY = h - ((0 - min) / (max - min)) * h;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden="true">
      <line
        x1={0}
        x2={w}
        y1={zeroY}
        y2={zeroY}
        stroke="var(--color-chart-zero)"
        strokeWidth={1}
      />
      <path
        d={path}
        fill="none"
        stroke="var(--color-chart-ma)"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Bar({ mean, maxAbs }: { mean: number; maxAbs: number }) {
  const pct = (Math.abs(mean) / maxAbs) * 50;
  const isPos = mean >= 0;
  return (
    <div className="relative h-5 w-full" aria-hidden="true">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <div
        className={`absolute top-0.5 bottom-0.5 ${
          isPos ? "left-1/2 bg-positive/35 rounded-r-sm" : "right-1/2 bg-negative/35 rounded-l-sm"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

interface Props {
  dailyScores: DailyScore[];
}

export function LeaderboardView({ dailyScores }: Props) {
  const [range, setRange] = useState<number>(365);

  const rows = useMemo(() => computeLeaderboard(dailyScores, range), [dailyScores, range]);
  const maxAbs = useMemo(() => {
    const m = Math.max(0.3, ...rows.map((r) => Math.abs(r.mean))) * 1.05;
    return m;
  }, [rows]);

  const spread = useMemo(() => {
    if (rows.length < 2) return 0;
    return rows[0].mean - rows[rows.length - 1].mean;
  }, [rows]);

  const totalHeadlines = useMemo(
    () => rows.reduce((s, r) => s + r.count, 0),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="animate-in delay-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-xs font-mono text-text-secondary">
          <span className="text-text-primary font-medium">{rows.length} outlets</span>{" "}
          · {totalHeadlines.toLocaleString()} headlines · spread{" "}
          <span className="text-text-primary font-medium tabular-nums">
            {spread.toFixed(2)}
          </span>
        </p>
        <div className="flex gap-1 bg-surface-alt/50 rounded-lg p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer btn-glow ${
                range === r.days
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-accent"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-in delay-2 border-l-2 border-accent/30 pl-3">
        <p className="text-xs font-mono text-text-secondary">
          Ranked by average sentiment toward AI. Click an outlet to view its
          full chart and headlines.
        </p>
      </div>

      <div className="animate-in delay-3 rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div
          className="grid text-[10px] font-mono uppercase tracking-[0.18em] text-text-tertiary px-4 py-3 border-b border-border"
          style={{ gridTemplateColumns: "2ch 1fr 64px minmax(120px,1fr) 5ch 6ch" }}
        >
          <span>#</span>
          <span>Outlet</span>
          <span className="hidden sm:block">Trend</span>
          <span className="hidden sm:block">Sentiment</span>
          <span className="text-right">Score</span>
          <span className="text-right">N</span>
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs font-mono text-text-tertiary">
            No data in the selected range.
          </div>
        ) : (
          <ul>
            {rows.map((r, i) => (
              <li key={r.source}>
                <Link
                  href={`/?source=${encodeURIComponent(r.source)}&range=${range}`}
                  className="grid items-center px-4 py-3 gap-3 text-xs font-mono border-b border-border last:border-b-0 hover:bg-surface-alt/60 transition-colors group"
                  style={{ gridTemplateColumns: "2ch 1fr 64px minmax(120px,1fr) 5ch 6ch" }}
                >
                  <span className="text-text-tertiary tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-text-primary group-hover:text-accent transition-colors truncate">
                    {r.source}
                  </span>
                  <span className="hidden sm:block">
                    <Sparkline points={r.series} />
                  </span>
                  <span className="hidden sm:block">
                    <Bar mean={r.mean} maxAbs={maxAbs} />
                  </span>
                  <span
                    className={`text-right tabular-nums ${
                      r.mean > 0.05
                        ? "text-positive"
                        : r.mean < -0.05
                        ? "text-negative"
                        : "text-text-secondary"
                    }`}
                  >
                    {formatMean(r.mean)}
                  </span>
                  <span className="text-right text-text-tertiary tabular-nums">
                    {r.count.toLocaleString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {rows.length >= 2 && (
        <div className="animate-in delay-4 pt-2 px-1">
          <p className="font-serif italic text-base sm:text-lg text-text-secondary leading-snug">
            Over the selected range,{" "}
            <span className="text-positive not-italic font-sans">
              {rows[0].source}
            </span>{" "}
            covers AI most positively; at the other end,{" "}
            <span className="text-negative not-italic font-sans">
              {rows[rows.length - 1].source}
            </span>{" "}
            covers it most critically.
          </p>
        </div>
      )}
    </div>
  );
}
