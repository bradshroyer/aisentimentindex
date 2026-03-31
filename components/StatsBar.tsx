"use client";

interface StatsBarProps {
  totalHeadlines: number;
  daysTracked: number;
  latestScore: number;
}

function scoreColor(score: number): string {
  if (score > 0.05) return "text-positive";
  if (score < -0.05) return "text-negative";
  return "text-neutral";
}

export function StatsBar({
  totalHeadlines,
  daysTracked,
  latestScore,
}: StatsBarProps) {
  return (
    <div className="flex gap-4 flex-wrap">
      <div className="bg-white rounded-xl shadow-sm px-5 py-4">
        <div className="text-2xl font-bold tabular-nums">
          {totalHeadlines.toLocaleString()}
        </div>
        <div className="text-xs text-slate-500">Headlines analyzed</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm px-5 py-4">
        <div className="text-2xl font-bold tabular-nums">{daysTracked}</div>
        <div className="text-xs text-slate-500">Days tracked</div>
      </div>
      <div className="bg-white rounded-xl shadow-sm px-5 py-4">
        <div className={`text-2xl font-bold tabular-nums ${scoreColor(latestScore)}`}>
          {latestScore >= 0 ? "+" : ""}
          {latestScore.toFixed(3)}
        </div>
        <div className="text-xs text-slate-500">Latest score</div>
      </div>
    </div>
  );
}
