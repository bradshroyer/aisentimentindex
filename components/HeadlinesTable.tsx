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
              <span className="text-sm font-normal text-slate-500 ml-2">
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
            className="text-sm text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Headline
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">
                Source
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((h) => (
              <tr
                key={h.id}
                className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm">
                  {h.url ? (
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-800 hover:text-accent hover:underline"
                    >
                      {h.title}
                    </a>
                  ) : (
                    h.title
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{h.source}</td>
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
