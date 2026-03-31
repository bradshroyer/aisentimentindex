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

interface ChartDataPoint {
  date: string;
  mean: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
}

interface SentimentChartProps {
  data: ChartDataPoint[];
  movingAverage: number[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
}

function formatDateLabel(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10)]} ${parseInt(day, 10)}`;
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

export function SentimentChart({
  data,
  movingAverage,
  selectedDate,
  onDateSelect,
}: SentimentChartProps) {
  const isDark = useIsDark();
  const selectedIndex = selectedDate
    ? data.findIndex((d) => d.date === selectedDate)
    : -1;

  const chartData: ChartData<"bar" | "line", number[], string> = useMemo(() => {
    const labels = data.map((d) => formatDateLabel(d.date));
    const sentiment = data.map((d) => d.mean);
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

    // Highlight selected point
    const pointRadii = data.map((_, i) => (i === selectedIndex ? 8 : 4));
    const pointBg = data.map((_, i) =>
      i === selectedIndex ? chartPointSelected : chartPoint
    );
    const pointBorder = data.map(() => chartPointBorder);

    // Selected bar highlight
    const posBarColors = data.map((_, i) =>
      i === selectedIndex ? chartPosBarActive : chartPosBar
    );
    const negBarColors = data.map((_, i) =>
      i === selectedIndex ? chartNegBarActive : chartNegBar
    );

    return {
      labels,
      datasets: [
        {
          label: "Positive",
          type: "bar" as const,
          data: posCounts,
          backgroundColor: posBarColors,
          borderColor: chartPosBorder,
          borderWidth: 1,
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
          yAxisID: "y1",
          order: 3,
          stack: "headlines",
        },
        {
          label: "Sentiment",
          type: "line" as const,
          data: sentiment,
          borderColor: chartLine,
          backgroundColor: chartLineFill,
          fill: true,
          tension: 0.3,
          pointRadius: pointRadii,
          pointHoverRadius: 7,
          pointBackgroundColor: pointBg,
          pointBorderColor: pointBorder,
          pointBorderWidth: 2,
          borderWidth: 2.5,
          spanGaps: true,
          yAxisID: "y",
          order: 1,
        },
        {
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
        },
      ],
    };
  }, [data, movingAverage, selectedIndex, isDark]);

  const gridColor = getCSSVar("--color-chart-grid");
  const zeroLineColor = getCSSVar("--color-chart-zero");
  const tickColor = getCSSVar("--color-chart-tick");
  const legendColor = getCSSVar("--color-chart-legend");
  const tooltipBg = getCSSVar("--color-chart-tooltip-bg");
  const tooltipTitle = getCSSVar("--color-chart-tooltip-title");
  const tooltipBody = getCSSVar("--color-chart-tooltip-body");
  const tooltipBorder = getCSSVar("--color-chart-tooltip-border");

  const monoFont = "'JetBrains Mono', ui-monospace, monospace";
  const sansFont = "'DM Sans', ui-sans-serif, system-ui, sans-serif";

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
          callbacks: {
            title: (items) => {
              if (items.length === 0) return "";
              const idx = items[0].dataIndex;
              return data[idx]?.date ?? "";
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
                  ? ` (${delta >= 0 ? "+" : ""}${delta.toFixed(3)} vs prev day)`
                  : "";
                return `  Sentiment: ${score >= 0 ? "+" : ""}${score.toFixed(3)}${deltaStr}`;
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
            text: "Headlines",
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
    [data, selectedDate, onDateSelect, gridColor, zeroLineColor, tickColor, legendColor, tooltipBg, tooltipTitle, tooltipBody, tooltipBorder, monoFont, sansFont]
  );

  return (
    <div className="bg-card border border-border rounded-lg p-3 sm:p-5 min-h-[340px] sm:min-h-[540px] cursor-pointer chart-glow card-glow">
      <div className="h-[280px] sm:h-[500px] relative z-10">
        <Chart type="bar" data={chartData} options={options} />
      </div>
      {selectedDate ? (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-negative" />
            Showing headlines for{" "}
            <span className="font-medium text-text-primary">{selectedDate}</span>
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
            Click a data point to explore that day&apos;s headlines
          </span>
        </div>
      )}
    </div>
  );
}
