"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Headline, DailyScore } from "@/lib/types";
import { SOURCES, TIME_RANGES } from "@/lib/types";
import { FilterBar } from "./FilterBar";
import { SentimentChart } from "./SentimentChart";
import { StatsBar } from "./StatsBar";
import { DayDetail } from "./DayDetail";
import { HeadlinesTable } from "./HeadlinesTable";
import { MethodologyFooter } from "./MethodologyFooter";

interface DashboardProps {
  dailyScores: DailyScore[];
  headlines: Headline[];
}

export function Dashboard({ dailyScores, headlines }: DashboardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedSource, setSelectedSource] = useState<string>(() => {
    const src = searchParams.get("source");
    return src && (SOURCES as readonly string[]).includes(src) ? src : "All";
  });
  const [selectedRange, setSelectedRange] = useState<number>(() => {
    const r = searchParams.get("range");
    const days = r ? parseInt(r, 10) : NaN;
    return TIME_RANGES.some((t) => t.days === days) ? days : 30;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    return searchParams.get("date") || null;
  });

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSource !== "All") params.set("source", selectedSource);
    if (selectedRange !== 30) params.set("range", String(selectedRange));
    if (selectedDate) params.set("date", selectedDate);
    const qs = params.toString();
    const url = qs ? `?${qs}` : "/";
    router.replace(url, { scroll: false });
  }, [selectedSource, selectedRange, selectedDate, router]);

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
        return { date: d.date, mean: d.mean, count: d.count, pos: d.pos, neg: d.neg, neu: d.neu };
      }
      const src = d.by_source[selectedSource];
      if (!src) return null;
      // Derive pos/neg/neu from headlines for this source+day
      const dayHeadlines = headlines.filter((h) => h.source === selectedSource && h.date === d.date);
      const pos = dayHeadlines.filter((h) => h.score > 0.05).length;
      const neg = dayHeadlines.filter((h) => h.score < -0.05).length;
      const neu = dayHeadlines.length - pos - neg;
      return { date: d.date, mean: src.mean, count: src.count, pos, neg, neu };
    }).filter(Boolean) as { date: string; mean: number; count: number; pos: number; neg: number; neu: number }[];
  }, [filteredDailyScores, selectedSource, headlines]);

  // 7-day moving average
  const movingAverage = useMemo(() => {
    return chartData.map((_, i) => {
      const window = chartData.slice(Math.max(0, i - 6), i + 1);
      const avg = window.reduce((sum, d) => sum + d.mean, 0) / window.length;
      return avg;
    });
  }, [chartData]);

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

  // Day-over-day delta
  const prevDayMean = dailyScores.length >= 2 ? dailyScores[dailyScores.length - 2]?.mean ?? 0 : null;
  const dayDelta = prevDayMean !== null ? latestScore - prevDayMean : null;

  // Week-over-week delta (avg of last 7 days vs prior 7 days)
  const weekDelta = useMemo(() => {
    if (dailyScores.length < 8) return null;
    const last7 = dailyScores.slice(-7);
    const prior7 = dailyScores.slice(-14, -7);
    if (prior7.length === 0) return null;
    const last7Avg = last7.reduce((s, d) => s + d.mean, 0) / last7.length;
    const prior7Avg = prior7.reduce((s, d) => s + d.mean, 0) / prior7.length;
    return last7Avg - prior7Avg;
  }, [dailyScores]);

  // Sources active today
  const sourcesToday = dailyScores[dailyScores.length - 1]?.sources?.length ?? 0;

  // Selected day data for DayDetail panel
  const selectedDayScore = useMemo(() => {
    if (!selectedDate) return null;
    return dailyScores.find((d) => d.date === selectedDate) ?? null;
  }, [dailyScores, selectedDate]);

  const selectedPrevDayScore = useMemo(() => {
    if (!selectedDate) return null;
    const idx = dailyScores.findIndex((d) => d.date === selectedDate);
    return idx > 0 ? dailyScores[idx - 1] : null;
  }, [dailyScores, selectedDate]);

  // Headlines for selected day (unfiltered by source for DayDetail)
  const selectedDayHeadlines = useMemo(() => {
    if (!selectedDate) return [];
    return headlines.filter((h) => h.date === selectedDate);
  }, [headlines, selectedDate]);

  // Trend summary sentence
  const trendSummary = useMemo(() => {
    if (weekDelta === null || dailyScores.length < 8) return null;
    const direction = weekDelta > 0.01 ? "up" : weekDelta < -0.01 ? "down" : "flat";
    const pct = Math.abs(weekDelta * 100).toFixed(0);
    const sourceCount = dailyScores[dailyScores.length - 1]?.sources?.length ?? 0;

    // Find which source shifted most
    const last7 = dailyScores.slice(-7);
    const prior7 = dailyScores.slice(-14, -7);
    let biggestMover = "";
    let biggestShift = 0;
    const allSources = new Set<string>();
    last7.forEach((d) => Object.keys(d.by_source).forEach((s) => allSources.add(s)));
    for (const src of allSources) {
      const recentAvg = last7.reduce((s, d) => s + (d.by_source[src]?.mean ?? 0), 0) / last7.length;
      const priorAvg = prior7.reduce((s, d) => s + (d.by_source[src]?.mean ?? 0), 0) / prior7.length;
      const shift = Math.abs(recentAvg - priorAvg);
      if (shift > biggestShift) {
        biggestShift = shift;
        biggestMover = src;
      }
    }

    if (direction === "flat") return `Sentiment holding steady across ${sourceCount} sources this week`;
    const moverNote = biggestMover && biggestShift > 0.03
      ? `, led by ${biggestMover}`
      : "";
    return `Sentiment ${direction} ~${pct}% this week across ${sourceCount} sources${moverNote}`;
  }, [weekDelta, dailyScores]);

  return (
    <div className="space-y-4">
      <div className="animate-in delay-1">
        <FilterBar
          sources={[...SOURCES]}
          selectedSource={selectedSource}
          onSourceChange={handleSourceChange}
          ranges={[...TIME_RANGES]}
          selectedRange={selectedRange}
          onRangeChange={handleRangeChange}
        />
      </div>

      {trendSummary && (
        <div className="animate-in delay-1 border-l-2 border-accent/30 pl-3 -mt-1">
          <p className="text-xs font-mono text-text-secondary">
            {trendSummary.includes("up") ? (
              <span className="text-positive font-medium">{trendSummary.split("up")[0]}up</span>
            ) : trendSummary.includes("down") ? (
              <span className="text-negative font-medium">{trendSummary.split("down")[0]}down</span>
            ) : (
              <span className="text-neutral font-medium">{trendSummary.split("steady")[0]}steady</span>
            )}
            {trendSummary.includes("up")
              ? trendSummary.split("up").slice(1).join("up")
              : trendSummary.includes("down")
                ? trendSummary.split("down").slice(1).join("down")
                : trendSummary.split("steady").slice(1).join("steady")}
          </p>
        </div>
      )}

      <div className="animate-in delay-2">
        <SentimentChart
          data={chartData}
          movingAverage={movingAverage}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      </div>

      {selectedDayScore && (
        <DayDetail
          dailyScore={selectedDayScore}
          prevDailyScore={selectedPrevDayScore}
          headlines={selectedDayHeadlines}
          onClose={() => setSelectedDate(null)}
        />
      )}

      <div className="animate-in delay-3">
        <StatsBar
          totalHeadlines={totalHeadlines}
          daysTracked={daysTracked}
          latestScore={latestScore}
          dayDelta={dayDelta}
          weekDelta={weekDelta}
          sourcesToday={sourcesToday}
        />
      </div>

      <div className="animate-in delay-4">
        <HeadlinesTable
          headlines={filteredHeadlines}
          selectedDate={selectedDate}
          onClearDate={() => setSelectedDate(null)}
        />
      </div>

      <MethodologyFooter />
    </div>
  );
}
