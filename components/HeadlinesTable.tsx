"use client";

import { useState, useMemo } from "react";
import type { Headline } from "@/lib/types";

const PAGE_SIZE = 25;

interface HeadlinesTableProps {
  headlines: Headline[];
  selectedDate: string | null;
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

function scoreBgColor(score: number): string {
  if (score > 0.05) return "bg-positive/10 text-positive";
  if (score < -0.05) return "bg-negative/10 text-negative";
  return "bg-neutral/10 text-neutral";
}

function HeadlineCard({ h }: { h: Headline }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 hover:border-accent/20 transition-colors card-glow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {h.url ? (
            <a
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-text-primary hover:text-accent leading-snug"
            >
              {h.title}
            </a>
          ) : (
            <span className="text-sm font-medium text-text-primary leading-snug">
              {h.title}
            </span>
          )}
          {h.summary && (
            <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 leading-relaxed">
              {h.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-text-tertiary bg-surface-alt px-2 py-0.5 rounded">
              {h.source}
            </span>
          </div>
        </div>
        <span
          className={`shrink-0 text-sm font-bold font-mono tabular-nums px-2 py-1 rounded ${scoreBgColor(h.score)}`}
        >
          {h.score >= 0 ? "+" : ""}
          {h.score.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

export function HeadlinesTable({
  headlines,
  selectedDate,
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
              <span className="text-accent">{selectedDate}</span>
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

      {/* Card view when date-filtered, table view otherwise */}
      {selectedDate ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((h) => (
            <HeadlineCard key={h.id} h={h} />
          ))}
          {visible.length === 0 && (
            <div className="col-span-full text-center py-8 text-sm text-text-tertiary">
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
