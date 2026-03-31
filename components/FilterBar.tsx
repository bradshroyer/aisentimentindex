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
        <label htmlFor="sourceFilter" className="text-xs text-text-tertiary font-mono uppercase tracking-widest">
          Source
        </label>
        <select
          id="sourceFilter"
          value={selectedSource}
          onChange={(e) => onSourceChange(e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-xs font-mono bg-card text-text-primary
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

      <div className="flex gap-1 sm:ml-auto bg-surface-alt/50 rounded-lg p-1">
        {ranges.map((r) => (
          <button
            key={r.label}
            onClick={() => onRangeChange(r.days)}
            className={`px-3 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer btn-glow
              ${
                selectedRange === r.days
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:text-accent"
              }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
