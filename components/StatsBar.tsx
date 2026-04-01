"use client";

interface StatsBarProps {
  totalHeadlines: number;
  daysTracked: number;
  latestScore: number;
  dayDelta: number | null;
  weekDelta: number | null;
  sourcesToday: number;
  firstDate: string;
  lastDate: string;
  totalSources: number;
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

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10)]} ${parseInt(day, 10)}`;
}

export function StatsBar({
  totalHeadlines,
  daysTracked,
  latestScore,
  dayDelta,
  weekDelta,
  sourcesToday,
  firstDate,
  lastDate,
  totalSources,
}: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      <div className="bg-card border border-border rounded-lg px-5 py-4 card-glow">
        <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">
          {totalHeadlines.toLocaleString()}
        </div>
        <div className="text-[11px] text-text-tertiary font-mono uppercase tracking-wider mt-1 mb-1.5">Headlines analyzed</div>
        <div className="text-xs text-text-tertiary font-mono">
          ~{daysTracked > 0 ? Math.round(totalHeadlines / daysTracked) : 0}/day avg
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg px-5 py-4 card-glow">
        <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">{daysTracked}</div>
        <div className="text-[11px] text-text-tertiary font-mono uppercase tracking-wider mt-1 mb-1.5">Days tracked</div>
        <div className="text-xs text-text-tertiary font-mono">
          {formatShortDate(firstDate)} — {formatShortDate(lastDate)}
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg px-5 py-4 card-glow">
        <div className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${scoreColor(latestScore)}`}>
          {latestScore >= 0 ? "+" : ""}
          {latestScore.toFixed(3)}
        </div>
        <div className="text-[11px] text-text-tertiary font-mono uppercase tracking-wider mt-1 mb-1.5">Latest score</div>
        <div className="flex flex-col gap-0.5">
          <DeltaBadge delta={dayDelta} label="vs yesterday" />
          <DeltaBadge delta={weekDelta} label="vs last week" />
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg px-5 py-4 card-glow">
        <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums">{sourcesToday}</div>
        <div className="text-[11px] text-text-tertiary font-mono uppercase tracking-wider mt-1 mb-1.5">Sources today</div>
        <div className="text-xs text-text-tertiary font-mono">
          {totalSources} configured
        </div>
      </div>
    </div>
  );
}
