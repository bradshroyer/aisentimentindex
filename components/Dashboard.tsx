"use client";

import { useState, useMemo, useCallback } from "react";
import type { Headline, DailyScore } from "@/lib/types";
import { SOURCES, TIME_RANGES } from "@/lib/types";
import { FilterBar } from "./FilterBar";
import { SentimentChart } from "./SentimentChart";
import { StatsBar } from "./StatsBar";
import { HeadlinesTable } from "./HeadlinesTable";

interface DashboardProps {
  dailyScores: DailyScore[];
  headlines: Headline[];
}

export function Dashboard({ dailyScores, headlines }: DashboardProps) {
  const [selectedSource, setSelectedSource] = useState<string>("All");
  const [selectedRange, setSelectedRange] = useState<number>(30);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Filter daily scores by time range
  const filteredDailyScores = useMemo(() => {
    if (selectedRange === 0) return dailyScores;
    const lastDate = dailyScores[dailyScores.length - 1]?.date;
    if (!lastDate) return dailyScores;
    const cutoff = new Date(lastDate + "T12:00:00");
    cutoff.setDate(cutoff.getDate() - selectedRange);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return dailyScores.filter((d) => d.date >= cutoffStr);
  }, [dailyScores, selectedRange]);

  // Chart data: either "All" sources or a specific source
  const chartData = useMemo(() => {
    return filteredDailyScores.map((d) => {
      if (selectedSource === "All") {
        return { date: d.date, mean: d.mean, count: d.count };
      }
      const src = d.by_source[selectedSource];
      if (!src) return null;
      return { date: d.date, mean: src.mean, count: src.count };
    }).filter(Boolean) as { date: string; mean: number; count: number }[];
  }, [filteredDailyScores, selectedSource]);

  // Filter headlines by source + selected date
  const filteredHeadlines = useMemo(() => {
    let filtered = headlines;
    if (selectedSource !== "All") {
      filtered = filtered.filter((h) => h.source === selectedSource);
    }
    if (selectedDate) {
      filtered = filtered.filter((h) => h.date === selectedDate);
      // Sort by absolute score (most impactful first) when day-filtered
      filtered = [...filtered].sort(
        (a, b) => Math.abs(b.score) - Math.abs(a.score)
      );
    }
    return filtered;
  }, [headlines, selectedSource, selectedDate]);

  const handleDateSelect = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
    },
    []
  );

  const handleSourceChange = useCallback((source: string) => {
    setSelectedSource(source);
    setSelectedDate(null);
  }, []);

  const handleRangeChange = useCallback(
    (days: number) => {
      setSelectedRange(days);
      // Clear selection if the selected date falls outside the new range
      if (selectedDate && days > 0) {
        const lastDate = dailyScores[dailyScores.length - 1]?.date;
        if (lastDate) {
          const cutoff = new Date(lastDate + "T12:00:00");
          cutoff.setDate(cutoff.getDate() - days);
          const cutoffStr = cutoff.toISOString().slice(0, 10);
          if (selectedDate < cutoffStr) {
            setSelectedDate(null);
          }
        }
      }
    },
    [selectedDate, dailyScores]
  );

  // Compute stats
  const totalHeadlines = dailyScores.reduce((sum, d) => sum + d.count, 0);
  const daysTracked = dailyScores.length;
  const latestScore = dailyScores[dailyScores.length - 1]?.mean ?? 0;

  return (
    <div className="space-y-6">
      <FilterBar
        sources={[...SOURCES]}
        selectedSource={selectedSource}
        onSourceChange={handleSourceChange}
        ranges={[...TIME_RANGES]}
        selectedRange={selectedRange}
        onRangeChange={handleRangeChange}
      />

      <SentimentChart
        data={chartData}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      <StatsBar
        totalHeadlines={totalHeadlines}
        daysTracked={daysTracked}
        latestScore={latestScore}
      />

      <HeadlinesTable
        headlines={filteredHeadlines}
        selectedDate={selectedDate}
        onClearDate={() => setSelectedDate(null)}
      />

      <footer className="text-center text-xs text-slate-400 pt-4 pb-8">
        Data from {SOURCES.length} sources &middot; Sentiment via VADER +
        domain adjustments
      </footer>
    </div>
  );
}
