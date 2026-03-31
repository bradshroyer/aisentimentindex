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

    // Highlight selected point
    const pointRadii = data.map((_, i) => (i === selectedIndex ? 8 : 4));
    const pointBg = data.map((_, i) =>
      i === selectedIndex ? "#dc2626" : "#2563eb"
    );
    const pointBorder = data.map((_, i) =>
      i === selectedIndex ? "#fff" : isDark ? "#1e293b" : "#fff"
    );

    // Selected bar highlight
    const posBarColors = data.map((_, i) =>
      i === selectedIndex ? "rgba(22, 163, 74, 0.7)" : "rgba(22, 163, 74, 0.45)"
    );
    const negBarColors = data.map((_, i) =>
      i === selectedIndex ? "rgba(220, 38, 38, 0.7)" : "rgba(220, 38, 38, 0.35)"
    );

    return {
      labels,
      datasets: [
        {
          label: "Positive",
          type: "bar" as const,
          data: posCounts,
          backgroundColor: posBarColors,
          borderColor: "rgba(22, 163, 74, 0.6)",
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
          borderColor: "rgba(220, 38, 38, 0.5)",
          borderWidth: 1,
          yAxisID: "y1",
          order: 3,
          stack: "headlines",
        },
        {
          label: "Sentiment",
          type: "line" as const,
          data: sentiment,
          borderColor: "#2563eb",
          backgroundColor: isDark ? "rgba(37, 99, 235, 0.1)" : "rgba(37, 99, 235, 0.06)",
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
          borderColor: isDark ? "rgba(148, 163, 184, 0.5)" : "rgba(100, 116, 139, 0.5)",
          borderDash: [6, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: isDark ? "rgba(148, 163, 184, 0.5)" : "rgba(100, 116, 139, 0.5)",
          fill: false,
          tension: 0.3,
          spanGaps: true,
          yAxisID: "y",
          order: 2,
        },
      ],
    };
  }, [data, movingAverage, selectedIndex, isDark]);

  const gridColor = isDark ? "#334155" : "#f1f5f9";
  const zeroLineColor = isDark ? "#64748b" : "#94a3b8";
  const tickColor = isDark ? "#94a3b8" : undefined;
  const legendColor = isDark ? "#cbd5e1" : undefined;

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
            font: { size: 11 },
            color: legendColor,
          },
        },
        tooltip: {
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
            font: { size: 11 },
            color: tickColor,
          },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? zeroLineColor : gridColor),
          },
          border: {
            dash: (ctx) => (ctx.tick.value === 0 ? [] : [4, 4]),
          },
          ticks: { color: tickColor },
        },
        y1: {
          position: "right" as const,
          beginAtZero: true,
          stacked: true,
          title: {
            display: true,
            text: "Headlines",
            font: { size: 11 },
            color: tickColor,
          },
          grid: { drawOnChartArea: false },
          ticks: { precision: 0, color: tickColor },
        },
        x: {
          title: { display: false },
          stacked: true,
          ticks: {
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 25,
            font: { size: 10 },
            color: tickColor,
          },
        },
      },
    }),
    [data, selectedDate, onDateSelect, gridColor, zeroLineColor, tickColor, legendColor]
  );

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 sm:p-6 min-h-[340px] sm:min-h-[540px] cursor-pointer">
      <div className="h-[280px] sm:h-[500px]">
        <Chart type="bar" data={chartData} options={options} />
      </div>
      {selectedDate ? (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Showing headlines for{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">{selectedDate}</span>
            <button
              onClick={() => onDateSelect(null)}
              className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              &times;
            </button>
          </span>
        </div>
      ) : (
        <div className="mt-3 text-center">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Click a data point to explore that day&apos;s headlines
          </span>
        </div>
      )}
    </div>
  );
}
