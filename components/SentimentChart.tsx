"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Filler,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import type { BucketPoint, Granularity } from "@/lib/bucketing";
import { bucketLongLabel } from "@/lib/bucketing";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  BarElement,
  BarController,
  Filler,
  Tooltip,
  Legend
);

interface SentimentChartProps {
  data: BucketPoint[];
  movingAverage: number[];
  granularity: Granularity;
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
}

function useIsDark() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function getCSSVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const BUCKET_NOUN: Record<Granularity, { singular: string; prev: string; volume: string }> = {
  day: { singular: "day", prev: "prev day", volume: "Headlines" },
  week: { singular: "week", prev: "prev week", volume: "Headlines (wk)" },
  month: { singular: "month", prev: "prev month", volume: "Headlines (mo)" },
};

export function SentimentChart({
  data,
  movingAverage,
  granularity,
  selectedDate,
  onDateSelect,
}: SentimentChartProps) {
  const isDark = useIsDark();
  const selectedIndex = selectedDate
    ? data.findIndex((d) => d.date === selectedDate)
    : -1;

  const isDay = granularity === "day";
  const showMA = isDay && movingAverage.length > 0;

  const chartData: ChartData<"bar" | "line", number[], string> = useMemo(() => {
    const labels = data.map((d) => d.label);
    const sentiment = data.map((d) => d.mean);
    const minArr = data.map((d) => d.min);
    const maxArr = data.map((d) => d.max);
    const posCounts = data.map((d) => d.pos);
    const negCounts = data.map((d) => d.neg);

    const chartPoint = getCSSVar("--color-chart-point");
    const chartPointSelected = getCSSVar("--color-chart-point-selected");
    const chartPointBorder = getCSSVar("--color-chart-point-border");
    const chartPosBar = getCSSVar("--color-chart-pos-bar");
    const chartPosBarActive = getCSSVar("--color-chart-pos-bar-active");
    const chartPosBorder = getCSSVar("--color-chart-pos-border");
    const chartNegBar = getCSSVar("--color-chart-neg-bar");
    const chartNegBarActive = getCSSVar("--color-chart-neg-bar-active");
    const chartNegBorder = getCSSVar("--color-chart-neg-border");
    const chartLine = getCSSVar("--color-chart-line");
    const chartLineFill = getCSSVar("--color-chart-line-fill");
    const chartMa = getCSSVar("--color-chart-ma");

    const pointRadii = data.map((_, i) => (i === selectedIndex ? 8 : isDay ? 4 : 3));
    const pointBg = data.map((_, i) =>
      i === selectedIndex ? chartPointSelected : chartPoint
    );
    const pointBorder = data.map(() => chartPointBorder);

    const posBarColors = data.map((_, i) =>
      i === selectedIndex ? chartPosBarActive : chartPosBar
    );
    const negBarColors = data.map((_, i) =>
      i === selectedIndex ? chartNegBarActive : chartNegBar
    );

    const datasets: ChartData<"bar" | "line", number[], string>["datasets"] = [
      {
        label: "Positive",
        type: "bar" as const,
        data: posCounts,
        backgroundColor: posBarColors,
        borderColor: chartPosBorder,
        borderWidth: 1,
        barPercentage: 0.7,
        categoryPercentage: 0.85,
        yAxisID: "y1",
        order: 3,
        stack: "headlines",
      },
      {
        label: "Negative",
        type: "bar" as const,
        data: negCounts,
        backgroundColor: negBarColors,
        borderColor: chartNegBorder,
        borderWidth: 1,
        barPercentage: 0.7,
        categoryPercentage: 0.85,
        yAxisID: "y1",
        order: 3,
        stack: "headlines",
      },
    ];

    // Volatility band (week/month only)
    if (!isDay) {
      datasets.push(
        {
          label: "__band_high",
          type: "line" as const,
          data: maxArr,
          borderColor: "transparent",
          backgroundColor: "transparent",
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          tension: 0.3,
          yAxisID: "y",
          order: 5,
        },
        {
          label: "__band_low",
          type: "line" as const,
          data: minArr,
          borderColor: "transparent",
          backgroundColor: chartLineFill,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: "-1",
          tension: 0.3,
          yAxisID: "y",
          order: 5,
        }
      );
    }

    datasets.push({
      label: "Sentiment",
      type: "line" as const,
      data: sentiment,
      borderColor: chartLine,
      backgroundColor: chartLineFill,
      fill: false,
      tension: 0.3,
      pointRadius: pointRadii,
      pointHoverRadius: 7,
      pointBackgroundColor: pointBg,
      pointBorderColor: pointBorder,
      pointBorderWidth: 2,
      borderWidth: 2.75,
      spanGaps: true,
      yAxisID: "y",
      order: 1,
    });

    if (showMA) {
      datasets.push({
        label: "7-day avg",
        type: "line" as const,
        data: movingAverage,
        borderColor: chartMa,
        borderDash: [6, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: chartMa,
        fill: false,
        tension: 0.3,
        spanGaps: true,
        yAxisID: "y",
        order: 2,
      });
    }

    return { labels, datasets };
  }, [data, movingAverage, selectedIndex, isDark, isDay, showMA]);

  // Note: reading `isDark` here makes these values reactive to theme changes.
  // getCSSVar reads the DOM, which doesn't tie into React's render cycle on its own.
  void isDark;
  const gridColor = getCSSVar("--color-chart-grid");
  const zeroLineColor = getCSSVar("--color-chart-zero");
  const tickColor = getCSSVar("--color-chart-tick");
  const legendColor = getCSSVar("--color-chart-legend");
  const tooltipBg = isDark ? "#1C1917" : "#FFFFFF";
  const tooltipTitle = isDark ? "#F5F0EB" : "#1C1917";
  const tooltipBody = isDark ? "#A8A29E" : "#78716C";
  const tooltipBorder = isDark ? "rgba(255, 245, 235, 0.08)" : "rgba(120, 100, 80, 0.10)";

  const monoFont = "'JetBrains Mono', ui-monospace, monospace";
  const sansFont = "'DM Sans', ui-sans-serif, system-ui, sans-serif";

  const nouns = BUCKET_NOUN[granularity];

  const options: ChartOptions<"bar" | "line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index" as const,
        intersect: false,
      },
      onClick: (_event, elements) => {
        if (elements.length === 0) {
          onDateSelect(null);
          return;
        }
        const idx = elements[0].index;
        const clickedDate = data[idx]?.date;
        if (clickedDate) {
          onDateSelect(clickedDate === selectedDate ? null : clickedDate);
        }
      },
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { size: 11, family: monoFont },
            color: legendColor,
            filter: (item) => {
              const t = item.text ?? "";
              if (t.startsWith("__band")) return false;
              if (t === "Positive" || t === "Negative") return false;
              return true;
            },
          },
        },
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
          filter: (item) => !item.dataset.label?.startsWith("__band"),
          callbacks: {
            labelColor: (item) => {
              // Pre-composited colors that match how the bars actually
              // render on the chart background per theme.
              const label = item.dataset.label;
              const swatch = (dark: string, light: string) => {
                const c = isDark ? dark : light;
                return { backgroundColor: c, borderColor: c };
              };
              if (label === "Positive") return swatch("#24835F", "#62CFAA");
              if (label === "Negative") return swatch("#8F434D", "#F6899B");
              if (label === "Sentiment") return swatch("#F59E0B", "#D97706");
              if (label === "7-day avg") return swatch("#5C5A57", "#C4C0BA");
              return { backgroundColor: "transparent", borderColor: "transparent" };
            },
            title: (items) => {
              if (items.length === 0) return "";
              const idx = items[0].dataIndex;
              const key = data[idx]?.date ?? "";
              if (!key) return "";
              return bucketLongLabel(key, granularity);
            },
            label: (item) => {
              if (item.dataset.label === "Positive")
                return `  Positive headlines: ${item.parsed.y}`;
              if (item.dataset.label === "Negative")
                return `  Negative headlines: ${item.parsed.y}`;
              if (item.dataset.label === "7-day avg")
                return `  7-day avg: ${(item.parsed.y ?? 0).toFixed(3)}`;
              if (item.dataset.label === "Sentiment") {
                const idx = item.dataIndex;
                const score = item.parsed.y ?? 0;
                const prevScore = idx > 0 ? data[idx - 1]?.mean : null;
                const delta = prevScore !== null ? score - prevScore : null;
                const deltaStr = delta !== null
                  ? ` (${delta >= 0 ? "+" : ""}${delta.toFixed(3)} vs ${nouns.prev})`
                  : "";
                const rangeStr = !isDay
                  ? `  Range: ${data[idx].min.toFixed(2)} .. ${data[idx].max.toFixed(2)}\n`
                  : "";
                return `${rangeStr}  Sentiment: ${score >= 0 ? "+" : ""}${score.toFixed(3)}${deltaStr}`;
              }
              return `${item.dataset.label}: ${item.parsed.y}`;
            },
          },
        },
      },
      scales: {
        y: {
          min: -1,
          max: 1,
          position: "left" as const,
          title: {
            display: true,
            text: "Sentiment (-1 neg / +1 pos)",
            font: { size: 11, family: sansFont },
            color: tickColor,
          },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? zeroLineColor : gridColor),
          },
          border: {
            dash: (ctx) => (ctx.tick.value === 0 ? [] : [4, 4]),
          },
          ticks: { color: tickColor, font: { size: 10, family: monoFont } },
        },
        y1: {
          position: "right" as const,
          beginAtZero: true,
          stacked: true,
          title: {
            display: true,
            text: nouns.volume,
            font: { size: 11, family: sansFont },
            color: tickColor,
          },
          grid: { drawOnChartArea: false },
          ticks: { precision: 0, color: tickColor, font: { size: 10, family: monoFont } },
        },
        x: {
          title: { display: false },
          stacked: true,
          ticks: {
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 25,
            font: { size: 10, family: monoFont },
            color: tickColor,
          },
        },
      },
    }),
    [data, granularity, isDay, nouns.prev, nouns.volume, selectedDate, onDateSelect, gridColor, zeroLineColor, tickColor, legendColor, tooltipBg, tooltipTitle, tooltipBody, tooltipBorder, monoFont, sansFont]
  );

  const selectedLabel = selectedDate
    ? bucketLongLabel(selectedDate, granularity)
    : null;

  return (
    <div className="bg-card border border-border rounded-lg p-3 sm:p-5 min-h-[340px] sm:min-h-[540px] cursor-pointer chart-glow card-glow">
      <div className="h-[280px] sm:h-[500px] relative z-10">
        <Chart key={isDark ? "dark" : "light"} type="bar" data={chartData} options={options} />
      </div>
      {selectedLabel ? (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-accent" />
            Showing headlines for{" "}
            <span className="font-medium text-text-primary">{selectedLabel}</span>
            <button
              onClick={() => onDateSelect(null)}
              className="ml-1 text-text-tertiary hover:text-text-primary cursor-pointer"
            >
              &times;
            </button>
          </span>
        </div>
      ) : (
        <div className="mt-3 text-center">
          <span className="text-xs text-text-tertiary">
            Click a {nouns.singular} to explore that {nouns.singular}&apos;s headlines
          </span>
        </div>
      )}
    </div>
  );
}
