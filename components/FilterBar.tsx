"use client";

interface FilterBarProps {
  sources: string[];
  selectedSource: string;
  onSourceChange: (source: string) => void;
  ranges: readonly { label: string; days: number }[];
  selectedRange: number;
  onRangeChange: (days: number) => void;
}

export function FilterBar({
  sources,
  selectedSource,
  onSourceChange,
  ranges,
  selectedRange,
  onRangeChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor="sourceFilter" className="text-sm text-slate-500 dark:text-slate-400">
          Source:
        </label>
        <select
          id="sourceFilter"
          value={selectedSource}
          onChange={(e) => onSourceChange(e.target.value)}
          className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-slate-100
                     focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="All">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 sm:ml-auto">
        {ranges.map((r) => (
          <button
            key={r.label}
            onClick={() => onRangeChange(r.days)}
            className={`px-3 py-1 border rounded-lg text-sm transition-colors cursor-pointer
              ${
                selectedRange === r.days
                  ? "bg-accent text-white border-accent"
                  : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-accent hover:text-accent"
              }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
