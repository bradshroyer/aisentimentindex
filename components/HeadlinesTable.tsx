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

function scoreBgColor(score: number): string {
  if (score > 0.05) return "bg-positive/10 text-positive";
  if (score < -0.05) return "bg-negative/10 text-negative";
  return "bg-neutral/10 text-neutral";
}

function HeadlineCard({ h }: { h: Headline }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {h.url ? (
            <a
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-accent leading-snug"
            >
              {h.title}
            </a>
          ) : (
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
              {h.title}
            </span>
          )}
          {h.summary && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
              {h.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
              {h.source}
            </span>
          </div>
        </div>
        <span
          className={`shrink-0 text-sm font-bold font-mono tabular-nums px-2 py-1 rounded-lg ${scoreBgColor(h.score)}`}
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
        <h2 className="text-lg font-semibold">
          {selectedDate ? (
            <>
              Headlines for{" "}
              <span className="text-accent">{selectedDate}</span>
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
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
            className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
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
            <div className="col-span-full text-center py-8 text-sm text-slate-400">
              No headlines found for this filter.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Headline
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-36 hidden sm:table-cell">
                  Source
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">
                    {h.url ? (
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-800 dark:text-slate-200 hover:text-accent hover:underline"
                      >
                        {h.title}
                      </a>
                    ) : (
                      h.title
                    )}
                    {/* Show source inline on mobile */}
                    <span className="block sm:hidden text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {h.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                    {h.source}
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
                    colSpan={3}
                    className="px-4 py-8 text-center text-sm text-slate-400"
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
                     text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer"
        >
          Show more
        </button>
      )}
    </div>
  );
}
