"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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
  BarElement,
  Filler,
  Tooltip,
  Legend
);

interface ChartDataPoint {
  date: string;
  mean: number;
  count: number;
}

interface SentimentChartProps {
  data: ChartDataPoint[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
}

export function SentimentChart({
  data,
  selectedDate,
  onDateSelect,
}: SentimentChartProps) {
  const selectedIndex = selectedDate
    ? data.findIndex((d) => d.date === selectedDate)
    : -1;

  const chartData: ChartData<"bar" | "line", number[], string> = useMemo(() => {
    const labels = data.map((d) => d.date);
    const sentiment = data.map((d) => d.mean);
    const counts = data.map((d) => d.count);

    // Highlight selected bar
    const barColors = data.map((_, i) =>
      i === selectedIndex
        ? "rgba(37, 99, 235, 0.35)"
        : "rgba(209, 213, 219, 0.4)"
    );

    // Highlight selected point
    const pointRadii = data.map((_, i) => (i === selectedIndex ? 8 : 4));
    const pointBg = data.map((_, i) =>
      i === selectedIndex ? "#dc2626" : "#2563eb"
    );
    const pointBorder = data.map((_, i) =>
      i === selectedIndex ? "#fff" : "#fff"
    );

    return {
      labels,
      datasets: [
        {
          label: "Headlines",
          type: "bar" as const,
          data: counts,
          backgroundColor: barColors,
          borderColor: "rgba(209, 213, 219, 0.6)",
          borderWidth: 1,
          yAxisID: "y1",
          order: 2,
        },
        {
          label: "Sentiment",
          type: "line" as const,
          data: sentiment,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.06)",
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
      ],
    };
  }, [data, selectedIndex]);

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
          // Toggle: click same date again to deselect
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
          },
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              if (item.dataset.type === "bar")
                return `${item.dataset.label}: ${item.parsed.y}`;
              return `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(3)}`;
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
          },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? "#94a3b8" : "#f1f5f9"),
          },
          border: {
            dash: (ctx) => (ctx.tick.value === 0 ? [] : [4, 4]),
          },
        },
        y1: {
          position: "right" as const,
          beginAtZero: true,
          title: {
            display: true,
            text: "Headlines",
            font: { size: 11 },
          },
          grid: { drawOnChartArea: false },
          ticks: { precision: 0 },
        },
        x: {
          title: { display: false },
          ticks: {
            maxRotation: 45,
            font: { size: 10 },
          },
        },
      },
    }),
    [data, selectedDate, onDateSelect]
  );

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 min-h-[420px] cursor-pointer">
      <div className="h-[380px]">
        <Chart type="bar" data={chartData} options={options} />
      </div>
      {selectedDate && (
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-2 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Showing headlines for{" "}
            <span className="font-medium text-slate-700">{selectedDate}</span>
            <button
              onClick={() => onDateSelect(null)}
              className="ml-1 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              &times;
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
