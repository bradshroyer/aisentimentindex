"use client";

import { useState, useMemo } from "react";
import type { Headline } from "@/lib/types";

const PAGE_SIZE = 25;

interface HeadlinesTableProps {
  headlines: Headline[];
  selectedDate: string | null;
  selectedLabel?: string | null;
  onClearDate: () => void;
}

function scoreColor(score: number): string {
  if (score > 0.05) return "text-positive";
  if (score < -0.05) return "text-negative";
  return "text-neutral";
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10)]} ${parseInt(day, 10)}`;
}

function scoreRailColor(score: number): string {
  if (score > 0.05) return "bg-positive";
  if (score < -0.05) return "bg-negative";
  return "bg-neutral/40";
}

function HeadlineRow({ h }: { h: Headline }) {
  return (
    <div className="group relative flex items-start gap-3 px-3 py-2.5 border-b border-border/40 last:border-b-0 hover:bg-surface-alt/50 transition-colors">
      <span
        className={`w-0.5 self-stretch shrink-0 rounded-full ${scoreRailColor(h.score)}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          {h.url ? (
            <a
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-primary group-hover:text-accent leading-snug line-clamp-2 flex-1"
            >
              {h.title}
            </a>
          ) : (
            <span className="text-sm text-text-primary leading-snug line-clamp-2 flex-1">
              {h.title}
            </span>
          )}
          <span
            className={`shrink-0 text-xs font-mono tabular-nums ${scoreColor(h.score)}`}
          >
            {h.score >= 0 ? "+" : ""}
            {h.score.toFixed(3)}
          </span>
        </div>
        {h.summary && (
          <p className="text-xs text-text-tertiary mt-1 line-clamp-1 leading-snug">
            {h.summary}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          <span>{h.source}</span>
        </div>
      </div>
    </div>
  );
}

export function HeadlinesTable({
  headlines,
  selectedDate,
  selectedLabel,
  onClearDate,
}: HeadlinesTableProps) {
  const [page, setPage] = useState(0);

  // Reset page when headlines change
  const headlineKey = `${headlines.length}-${selectedDate}`;
  const [prevKey, setPrevKey] = useState(headlineKey);
  if (headlineKey !== prevKey) {
    setPage(0);
    setPrevKey(headlineKey);
  }

  const visible = useMemo(
    () => headlines.slice(0, (page + 1) * PAGE_SIZE),
    [headlines, page]
  );

  const hasMore = visible.length < headlines.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-serif">
          {selectedDate ? (
            <>
              Headlines for{" "}
              <span className="text-accent">{selectedLabel ?? selectedDate}</span>
              <span className="text-sm font-normal text-text-secondary ml-2">
                ({headlines.length} article{headlines.length !== 1 ? "s" : ""})
              </span>
            </>
          ) : (
            "Recent Headlines"
          )}
        </h2>
        {selectedDate && (
          <button
            onClick={onClearDate}
            className="text-sm text-text-tertiary hover:text-text-primary cursor-pointer"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Compact list when date-filtered, table view otherwise */}
      {selectedDate ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden card-glow">
          {visible.map((h) => (
            <HeadlineRow key={h.id} h={h} />
          ))}
          {visible.length === 0 && (
            <div className="text-center py-8 text-sm text-text-tertiary">
              No headlines found for this filter.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden card-glow">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-alt border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                  Headline
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider w-36 hidden sm:table-cell font-mono">
                  Source
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider w-24 hidden sm:table-cell font-mono">
                  Date
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider w-20 font-mono">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-surface-alt/50 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">
                    {h.url ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-primary hover:text-accent hover:underline"
                      >
                        {h.title}
                      </a>
                    ) : (
                      h.title
                    )}
                    {/* Show source inline on mobile */}
                    <span className="block sm:hidden text-xs text-text-tertiary mt-0.5">
                      {h.source} &middot; {formatShortDate(h.date)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary hidden sm:table-cell">
                    {h.source}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-tertiary font-mono tabular-nums hidden sm:table-cell whitespace-nowrap">
                    {formatShortDate(h.date)}
                  </td>
                  <td
                    className={`px-4 py-3 text-sm text-right font-mono tabular-nums ${scoreColor(h.score)}`}
                  >
                    {h.score >= 0 ? "+" : ""}
                    {h.score.toFixed(3)}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-sm text-text-tertiary"
                  >
                    No headlines found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="block mx-auto mt-4 px-6 py-2 bg-accent text-white rounded-lg
                     text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer btn-glow"
        >
          Show more
          <span className="ml-1.5 opacity-70 font-normal">
            ({(headlines.length - visible.length).toLocaleString()} remaining)
          </span>
        </button>
      )}
    </div>
  );
}
