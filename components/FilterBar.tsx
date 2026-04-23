"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);

  const allOptions = useMemo(() => ["All", ...sources], [sources]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset focus index when opening. Track prev open in state so we can
  // adjust focusIndex during render (cheaper than an effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const idx = allOptions.indexOf(selectedSource);
      setFocusIndex(idx >= 0 ? idx : 0);
    }
  }

  // Scroll focused item into view
  useEffect(() => {
    if (open && listRef.current && focusIndex >= 0) {
      const items = listRef.current.querySelectorAll("[role='option']");
      items[focusIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusIndex, open]);

  const selectOption = useCallback((value: string) => {
    onSourceChange(value);
    setOpen(false);
  }, [onSourceChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault();
        if (open && focusIndex >= 0) {
          selectOption(allOptions[focusIndex]);
        } else {
          setOpen(true);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setFocusIndex((i) => Math.min(i + 1, allOptions.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) {
          setFocusIndex((i) => Math.max(i - 1, 0));
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  }, [open, focusIndex, allOptions, selectOption]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-tertiary font-mono uppercase tracking-widest">
          Source
        </label>
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(!open)}
            onKeyDown={handleKeyDown}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs font-mono
                       bg-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/20
                       focus:border-accent cursor-pointer min-w-[140px]"
          >
            <span className="flex-1 text-left">
              {selectedSource === "All" ? "All Sources" : selectedSource}
            </span>
            <svg
              className={`w-3 h-3 text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>
          {open && (
            <div
              ref={listRef}
              role="listbox"
              aria-label="Select source"
              className="absolute z-50 mt-1 w-56 max-h-64 overflow-y-auto bg-white dark:bg-[#1C1917] border border-border
                         rounded-lg shadow-lg py-1"
            >
              {allOptions.map((s, i) => (
                <button
                  key={s}
                  role="option"
                  aria-selected={selectedSource === s}
                  onClick={() => selectOption(s)}
                  className={`w-full text-left px-3 py-1.5 text-xs font-mono cursor-pointer transition-colors
                    ${selectedSource === s
                      ? "bg-accent/10 text-accent"
                      : i === focusIndex
                        ? "bg-surface-alt text-text-primary"
                        : "text-text-primary hover:bg-surface-alt"}`}
                >
                  {s === "All" ? "All Sources" : s}
                </button>
              ))}
            </div>
          )}
        </div>
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
