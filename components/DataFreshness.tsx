"use client";

import { useEffect, useState } from "react";

interface DataFreshnessProps {
  /** Latest date with data, YYYY-MM-DD. */
  latestDate: string;
}

/**
 * "Data through <date> · today/yesterday/N days ago". The absolute date is
 * server-rendered; the relative part is computed after mount from the
 * viewer's clock. Rendering it on the server (as before) pinned it to the
 * UTC date at ISR time, so evening visitors west of UTC saw fresh data
 * labeled "yesterday" — and the label aged inside the 6h cache regardless.
 */
export function DataFreshness({ latestDate }: DataFreshnessProps) {
  const [days, setDays] = useState<number | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time sync FROM an
     external system (the viewer's clock) after hydration; rendering it on
     the server would pin the label to the UTC date at ISR time. */
  useEffect(() => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const diff = Math.round(
      (Date.parse(localToday + "T12:00:00Z") - Date.parse(latestDate + "T12:00:00Z")) / 86400000
    );
    setDays(Math.max(0, diff));
  }, [latestDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dateLabel = new Date(latestDate + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
  const relative =
    days === null ? null : days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

  return (
    <p className="text-[11px] font-mono mt-2 tabular-nums text-text-tertiary">
      Data through {dateLabel}
      {relative && (
        <>
          {" "}&middot;{" "}
          <span className={days !== null && days >= 2 ? "text-negative" : "text-text-secondary"}>
            {relative}
          </span>
        </>
      )}
    </p>
  );
}
