"use client";

interface StatsBarProps {
  totalHeadlines: number;
  daysTracked: number;
  latestScore: number;
  dayDelta: number | null;
  weekDelta: number | null;
  sourcesToday: number;
}

function scoreColor(score: number): string {
  if (score > 0.05) return "text-positive";
  if (score < -0.05) return "text-negative";
  return "text-neutral";
}

function deltaColor(delta: number): string {
  if (delta > 0.005) return "text-positive";
  if (delta < -0.005) return "text-negative";
  return "text-neutral";
}

function DeltaBadge({ delta, label }: { delta: number | null; label: string }) {
  if (delta === null) return null;
  const arrow = delta > 0.005 ? "\u25B2" : delta < -0.005 ? "\u25BC" : "\u25CF";
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${deltaColor(delta)}`}>
      <span className="text-[10px]">{arrow}</span>
      {Math.abs(delta).toFixed(3)} {label}
    </span>
  );
}

export function StatsBar({
  totalHeadlines,
  daysTracked,
  latestScore,
  dayDelta,
  weekDelta,
  sourcesToday,
}: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
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
        <div className="text-xs text-slate-500 mb-1">Latest score</div>
        <div className="flex flex-col gap-0.5">
          <DeltaBadge delta={dayDelta} label="vs yesterday" />
          <DeltaBadge delta={weekDelta} label="vs last week" />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm px-5 py-4">
        <div className="text-2xl font-bold tabular-nums">{sourcesToday}</div>
        <div className="text-xs text-slate-500">Sources today</div>
      </div>
    </div>
  );
}
