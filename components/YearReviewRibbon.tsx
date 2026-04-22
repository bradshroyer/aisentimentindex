"use client";

export interface YearReviewData {
  delta: number;
  recentMean: number;
  priorMean: number;
  peak: { key: string; mean: number } | null;
  trough: { key: string; mean: number } | null;
  biggestDay: { date: string; delta: number; label: string | null } | null;
  biggestSourceMover: { source: string; shift: number } | null;
}

const MONTHS_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS_SHORT[parseInt(m, 10)]} ${y}`;
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-");
  return `${MONTHS_SHORT[parseInt(m, 10)]} ${parseInt(d, 10)}, ${y}`;
}

function fmtScore(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}

export function YearReviewRibbon({ data }: { data: YearReviewData }) {
  const { delta, recentMean, priorMean, peak, trough, biggestDay, biggestSourceMover } = data;
  const direction = delta > 0.02 ? "up" : delta < -0.02 ? "down" : "flat";
  const magnitude = Math.abs(delta).toFixed(2);

  return (
    <div className="animate-in delay-1 border-l-2 border-accent pl-3 -mt-1">
      <p className="text-xs font-mono text-text-secondary">
        <span className="uppercase tracking-wider text-text-tertiary text-[10px] mr-2">
          Past 12 months
        </span>
        sentiment{" "}
        {direction === "up" ? (
          <span className="text-positive font-medium">up {magnitude}</span>
        ) : direction === "down" ? (
          <span className="text-negative font-medium">down {magnitude}</span>
        ) : (
          <span className="text-neutral font-medium">flat</span>
        )}
        {" "}({fmtScore(priorMean)} → {fmtScore(recentMean)})
        {peak && trough && (
          <>
            {" · "}Peak {monthLabel(peak.key)} {fmtScore(peak.mean)}, trough {monthLabel(trough.key)} {fmtScore(trough.mean)}
          </>
        )}
        {biggestDay && (
          <>
            {" · "}Biggest day: {dayLabel(biggestDay.date)}
            {biggestDay.label && <> ({biggestDay.label})</>}
          </>
        )}
        {biggestSourceMover && (
          <>
            {" · "}Biggest mover: {biggestSourceMover.source}
          </>
        )}
      </p>
    </div>
  );
}
