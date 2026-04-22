"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Chart as ChartJS,
  LinearScale,
  LogarithmicScale,
  PointElement,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import type { SourceSummary } from "@/lib/types";

ChartJS.register(LinearScale, LogarithmicScale, PointElement, Tooltip);

interface SourceLeaderboardProps {
  rows: SourceSummary[];
  selectedSource: string;
  onSourceChange: (source: string) => void;
}

type SortKey = "mean" | "count" | "delta30";

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function getCSSVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function scoreBarColor(score: number): string {
  if (score > 0.05) return "bg-positive";
  if (score < -0.05) return "bg-negative";
  return "bg-neutral";
}

function scoreTextColor(score: number): string {
  if (score > 0.05) return "text-positive";
  if (score < -0.05) return "text-negative";
  return "text-neutral";
}

function deltaColor(delta: number | null): string {
  if (delta === null) return "text-text-tertiary";
  if (delta > 0.02) return "text-positive";
  if (delta < -0.02) return "text-negative";
  return "text-neutral";
}

function deltaArrow(delta: number | null): string {
  if (delta === null) return "\u2013";
  if (delta > 0.02) return "\u25B2";
  if (delta < -0.02) return "\u25BC";
  return "\u25CF";
}

function formatScore(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

export function SourceLeaderboard({
  rows,
  selectedSource,
  onSourceChange,
}: SourceLeaderboardProps) {
  const isDark = useIsDark();
  const [sortKey, setSortKey] = useState<SortKey>("mean");

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sortKey === "mean") copy.sort((a, b) => b.mean - a.mean);
    else if (sortKey === "count") copy.sort((a, b) => b.count - a.count);
    else
      copy.sort((a, b) => (b.delta30 ?? -Infinity) - (a.delta30 ?? -Infinity));
    return copy;
  }, [rows, sortKey]);

  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const sortedByMean = [...rows].sort((a, b) => b.mean - a.mean);
    const top = sortedByMean[0];
    const bottom = sortedByMean[sortedByMean.length - 1];
    return { top, bottom };
  }, [rows]);

  const maxCount = useMemo(
    () => Math.max(1, ...rows.map((r) => r.countAllTime)),
    [rows]
  );

  const scatterData: ChartData<"scatter"> = useMemo(() => {
    const posColor = getCSSVar("--color-positive") || "#10B981";
    const negColor = getCSSVar("--color-negative") || "#F43F5E";
    const neuColor = getCSSVar("--color-neutral") || "#78716C";
    const accentColor = getCSSVar("--color-accent") || "#D97706";

    const points = rows.map((r) => {
      const color =
        r.mean > 0.05 ? posColor : r.mean < -0.05 ? negColor : neuColor;
      // Fresh sources get bigger dots (capped).
      const freshness = Math.max(0, 14 - r.recencyDays) / 14; // 0..1
      const radius = 5 + freshness * 5;
      const selected = selectedSource === r.source;
      return {
        x: r.countAllTime,
        y: r.mean,
        source: r.source,
        count30: r.count,
        recencyDays: r.recencyDays,
        radius,
        color: selected ? accentColor : color,
        selected,
      };
    });

    return {
      datasets: [
        {
          label: "Sources",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: points as any,
          backgroundColor: points.map((p) => p.color),
          borderColor: points.map((p) =>
            p.selected ? accentColor : getCSSVar("--color-chart-point-border") || "#fff"
          ),
          borderWidth: points.map((p) => (p.selected ? 3 : 1.5)),
          pointRadius: points.map((p) => p.radius),
          pointHoverRadius: points.map((p) => p.radius + 2),
        },
      ],
    };
  }, [rows, selectedSource, isDark]);

  const scatterOptions: ChartOptions<"scatter"> = useMemo(() => {
    const gridColor = getCSSVar("--color-chart-grid");
    const zeroLineColor = getCSSVar("--color-chart-zero");
    const tickColor = getCSSVar("--color-chart-tick");
    const tooltipBg = getCSSVar("--color-chart-tooltip-bg");
    const tooltipTitle = getCSSVar("--color-chart-tooltip-title");
    const tooltipBody = getCSSVar("--color-chart-tooltip-body");
    const tooltipBorder = getCSSVar("--color-chart-tooltip-border");
    const monoFont = "'JetBrains Mono', ui-monospace, monospace";
    const sansFont = "'DM Sans', ui-sans-serif, system-ui, sans-serif";

    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event, elements) => {
        if (elements.length === 0) return;
        const idx = elements[0].index;
        const src = rows[idx]?.source;
        if (src) {
          onSourceChange(selectedSource === src ? "All" : src);
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipTitle,
          bodyColor: tooltipBody,
          borderColor: tooltipBorder,
          borderWidth: 1,
          cornerRadius: 6,
          titleFont: { family: sansFont, size: 12 },
          bodyFont: { family: monoFont, size: 11 },
          padding: 10,
          callbacks: {
            title: (items) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = items[0]?.raw as any;
              return raw?.source ?? "";
            },
            label: (item) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const raw = item.raw as any;
              return [
                `  Mean (30d): ${formatScore(raw.y)}`,
                `  Volume (all): ${raw.x.toLocaleString()}`,
                `  Last 30d: ${raw.count30} headlines`,
                raw.recencyDays === 0
                  ? "  Active today"
                  : `  ${raw.recencyDays}d since last`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: "logarithmic",
          title: {
            display: true,
            text: "Total headlines (log)",
            font: { size: 11, family: sansFont },
            color: tickColor,
          },
          grid: { color: gridColor },
          ticks: { color: tickColor, font: { size: 10, family: monoFont } },
        },
        y: {
          min: -1,
          max: 1,
          title: {
            display: true,
            text: "Mean sentiment (last 30d)",
            font: { size: 11, family: sansFont },
            color: tickColor,
          },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? zeroLineColor : gridColor),
          },
          ticks: { color: tickColor, font: { size: 10, family: monoFont } },
        },
      },
    };
  }, [rows, onSourceChange, selectedSource, isDark]);

  if (rows.length === 0) return null;

  return (
    <details className="bg-card border border-border rounded-lg card-glow group" open={false}>
      <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary">
            Source stance leaderboard
          </div>
          {summary && (
            <div className="text-xs text-text-tertiary font-mono mt-0.5 truncate">
              {summary.top.source} most bullish ({formatScore(summary.top.mean)}) &middot;{" "}
              {summary.bottom.source} most bearish ({formatScore(summary.bottom.mean)})
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
            {rows.length} sources
          </span>
          <svg
            className="w-4 h-4 text-text-tertiary transition-transform group-open:rotate-180"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M2 4l4 4 4-4" />
          </svg>
        </div>
      </summary>

      <div className="border-t border-border px-5 py-4 grid gap-6 lg:grid-cols-5">
        {/* Leaderboard table */}
        <div className="lg:col-span-3 overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-text-tertiary uppercase tracking-wider text-[10px]">
                <th className="text-left font-normal pb-2 pr-2">Source</th>
                <SortHeader
                  label="Mean (30d)"
                  active={sortKey === "mean"}
                  onClick={() => setSortKey("mean")}
                  align="right"
                />
                <SortHeader
                  label="Volume"
                  active={sortKey === "count"}
                  onClick={() => setSortKey("count")}
                  align="right"
                />
                <SortHeader
                  label="Δ 30d"
                  active={sortKey === "delta30"}
                  onClick={() => setSortKey("delta30")}
                  align="right"
                />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const active = selectedSource === r.source;
                const barWidth = Math.abs(r.mean) * 50; // half the available 100px
                return (
                  <tr
                    key={r.source}
                    onClick={() =>
                      onSourceChange(active ? "All" : r.source)
                    }
                    className={`cursor-pointer border-t border-border/50 transition-colors ${
                      active ? "bg-accent/10" : "hover:bg-surface-alt/50"
                    }`}
                  >
                    <td className="py-2 pr-2 text-text-primary font-sans">
                      <div className="flex items-center gap-2">
                        {active && (
                          <span className="w-1 h-1 rounded-full bg-accent shrink-0" />
                        )}
                        <span className="truncate">{r.source}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative w-[100px] h-1.5 rounded-full bg-surface-alt/70 hidden sm:block">
                          <div
                            className={`absolute top-0 bottom-0 ${scoreBarColor(r.mean)} rounded-full`}
                            style={{
                              width: `${barWidth}px`,
                              left: r.mean >= 0 ? "50%" : `${50 - barWidth}%`,
                            }}
                          />
                          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
                        </div>
                        <span
                          className={`tabular-nums w-12 text-right ${scoreTextColor(r.mean)}`}
                        >
                          {formatScore(r.mean)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums text-text-secondary">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-text-tertiary text-[10px] hidden sm:inline">
                          {Math.round((r.countAllTime / maxCount) * 100)}%
                        </span>
                        <span className="w-14 text-right">
                          {r.countAllTime.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${deltaColor(r.delta30)}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[9px]">
                          {deltaArrow(r.delta30)}
                        </span>
                        <span className="w-10 text-right">
                          {r.delta30 === null
                            ? "—"
                            : `${r.delta30 >= 0 ? "+" : ""}${r.delta30.toFixed(2)}`}
                        </span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Scatter */}
        <div className="lg:col-span-2">
          <div className="h-[260px]">
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
          <p className="text-[10px] text-text-tertiary font-mono mt-2 leading-relaxed">
            Volume (log) &times; mean sentiment over last 30 days. Larger dots = more recent
            activity. Click a dot or row to filter the chart above.
          </p>
        </div>
      </div>
    </details>
  );
}

function SortHeader({
  label,
  active,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align: "left" | "right";
}) {
  return (
    <th className={`font-normal pb-2 pr-2 text-${align}`}>
      <button
        onClick={onClick}
        className={`cursor-pointer uppercase tracking-wider hover:text-text-primary transition-colors ${
          active ? "text-accent" : ""
        }`}
      >
        {label}
        {active && <span className="ml-1">&darr;</span>}
      </button>
    </th>
  );
}
