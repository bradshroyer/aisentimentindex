"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { TIME_RANGES } from "@/lib/types";
import type { LeaderboardByRange } from "@/lib/leaderboard";

function formatMean(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

const SPARK_W = 96;
const SPARK_H = 24;

/**
 * Trend of one outlet across the range. Every row shares the same y-domain
 * (±`domain`) so lines are comparable down the table; the fill above / below
 * zero is tinted positive / negative and the end dot marks the latest value.
 */
function Sparkline({ points, domain }: { points: number[]; domain: number }) {
  const id = useId();
  if (points.length < 2) return <span className="inline-block" style={{ width: SPARK_W, height: SPARK_H }} />;
  const pad = 2;
  const innerH = SPARK_H - pad * 2;
  const xStep = (SPARK_W - pad * 2) / (points.length - 1);
  const x = (i: number) => pad + i * xStep;
  const y = (v: number) =>
    pad + innerH / 2 - (Math.max(-domain, Math.min(domain, v)) / domain) * (innerH / 2);
  const zeroY = y(0);
  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)} ${zeroY} L${x(0).toFixed(1)} ${zeroY} Z`;
  const last = points[points.length - 1];
  const above = `${id}-above`;
  const below = `${id}-below`;
  return (
    <svg width={SPARK_W} height={SPARK_H} className="overflow-visible" aria-hidden="true">
      <defs>
        <clipPath id={above}>
          <rect x={0} y={0} width={SPARK_W} height={zeroY} />
        </clipPath>
        <clipPath id={below}>
          <rect x={0} y={zeroY} width={SPARK_W} height={SPARK_H - zeroY} />
        </clipPath>
      </defs>
      <path d={area} fill="var(--color-positive)" fillOpacity={0.22} clipPath={`url(#${above})`} />
      <path d={area} fill="var(--color-negative)" fillOpacity={0.22} clipPath={`url(#${below})`} />
      <line x1={pad} x2={SPARK_W - pad} y1={zeroY} y2={zeroY} stroke="var(--color-chart-zero)" strokeWidth={1} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-text-secondary)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(last)}
        r={2.25}
        fill={last >= 0 ? "var(--color-positive)" : "var(--color-negative)"}
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
  leaderboards: LeaderboardByRange;
}

const GRID =
  "grid-cols-[2ch_1fr_minmax(80px,1.5fr)_6ch] sm:grid-cols-[2ch_1fr_96px_minmax(160px,1.5fr)_6ch]";

export function LeaderboardView({ leaderboards }: Props) {
  const [range, setRange] = useState<number>(365);

  const rows = useMemo(() => leaderboards[range] ?? [], [leaderboards, range]);
  // Shared sparkline scale for the range: the widest swing any outlet makes,
  // floored so a calm range doesn't magnify noise into drama.
  const sparkDomain = useMemo(
    () => Math.max(0.3, ...rows.flatMap((r) => r.series.map(Math.abs))),
    [rows]
  );
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

      {rows.length >= 2 && (
        <div className="animate-in delay-2 pt-1 pb-2">
          <p className="font-serif italic text-base sm:text-lg text-text-secondary leading-snug">
            Over the selected range,{" "}
            <span className="text-positive">{rows[0].source}</span>{" "}
            covers AI most positively; at the other end,{" "}
            <span className="text-negative">{rows[rows.length - 1].source}</span>{" "}
            covers it most critically.
          </p>
        </div>
      )}

      <div className="animate-in delay-3 rounded-xl border border-border bg-card card-glow overflow-hidden">
        <div
          className={`grid text-[10px] font-mono uppercase tracking-[0.18em] text-text-tertiary px-4 py-3 border-b border-border gap-3 ${GRID}`}
        >
          <span>#</span>
          <span>Outlet</span>
          <span className="hidden sm:block">Trend</span>
          <span className="hidden sm:flex items-center justify-between normal-case tracking-normal text-[9px]">
            <span>critical</span>
            <span className="tabular-nums">0</span>
            <span>positive</span>
          </span>
          <span className="text-right">Score</span>
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
                  className={`grid items-center px-4 py-3 gap-3 text-xs font-mono border-b border-border last:border-b-0 hover:bg-surface-alt/60 transition-colors group ${GRID}`}
                >
                  <span className="text-text-tertiary tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-text-primary group-hover:text-accent transition-colors truncate">
                    {r.source}
                  </span>
                  <span className="hidden sm:block">
                    <Sparkline points={r.series} domain={sparkDomain} />
                  </span>
                  <span className="block">
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
