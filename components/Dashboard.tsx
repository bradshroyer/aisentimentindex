"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Headline, DailyScore } from "@/lib/types";
import { SOURCES, TIME_RANGES } from "@/lib/types";
import {
  getGranularity,
  bucketKey,
  bucketEnd,
  bucketCenter,
  bucketChartData,
  buildBucket,
  prevBucketKey,
  type ChartDayPoint,
} from "@/lib/bucketing";
import { FilterBar } from "./FilterBar";
import { SentimentChart } from "./SentimentChart";
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

  const granularity = useMemo(() => getGranularity(selectedRange), [selectedRange]);

  // Filter daily scores by time range. When a bucket is selected, center the
  // visible window on the selection so narrowing/widening the range keeps the
  // focus on-chart. Otherwise, anchor the window at the latest date.
  const filteredDailyScores = useMemo(() => {
    if (selectedRange === 0) return dailyScores;
    const lastDate = dailyScores[dailyScores.length - 1]?.date;
    if (!lastDate) return dailyScores;
    let windowEnd = lastDate;
    if (selectedDate) {
      const bEnd = bucketEnd(selectedDate, granularity);
      const end = new Date(bEnd + "T12:00:00");
      end.setDate(end.getDate() + Math.floor(selectedRange / 2));
      const endStr = end.toISOString().slice(0, 10);
      if (endStr < lastDate) windowEnd = endStr;
    }
    const cutoff = new Date(windowEnd + "T12:00:00");
    cutoff.setDate(cutoff.getDate() - selectedRange);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return dailyScores.filter((d) => d.date >= cutoffStr && d.date <= windowEnd);
  }, [dailyScores, selectedRange, selectedDate, granularity]);

  // Per-day points (pre-bucketing), respecting source filter
  const dayPoints = useMemo<ChartDayPoint[]>(() => {
    return filteredDailyScores.map((d) => {
      if (selectedSource === "All") {
        return { date: d.date, mean: d.mean, count: d.count, pos: d.pos, neg: d.neg, neu: d.neu };
      }
      const src = d.by_source[selectedSource];
      if (!src) return null;
      const dayHeadlines = headlines.filter((h) => h.source === selectedSource && h.date === d.date);
      const pos = dayHeadlines.filter((h) => h.score > 0.05).length;
      const neg = dayHeadlines.filter((h) => h.score < -0.05).length;
      const neu = dayHeadlines.length - pos - neg;
      return { date: d.date, mean: src.mean, count: src.count, pos, neg, neu };
    }).filter(Boolean) as ChartDayPoint[];
  }, [filteredDailyScores, selectedSource, headlines]);

  // Bucketed chart data (day/week/month)
  const chartData = useMemo(
    () => bucketChartData(dayPoints, granularity),
    [dayPoints, granularity]
  );

  // Clear selectedDate if its bucket is no longer in chartData
  useEffect(() => {
    if (selectedDate && chartData.length > 0 && !chartData.some((d) => d.date === selectedDate)) {
      setSelectedDate(null);
    }
  }, [chartData, selectedDate]);

  // 7-day moving average (only meaningful at day granularity)
  const movingAverage = useMemo(() => {
    if (granularity !== "day") return [];
    return chartData.map((_, i) => {
      const window = chartData.slice(Math.max(0, i - 6), i + 1);
      return window.reduce((sum, d) => sum + d.mean, 0) / window.length;
    });
  }, [chartData, granularity]);

  // Bucket currently selected
  const selectedBucket = useMemo(() => {
    if (!selectedDate) return null;
    return buildBucket(dailyScores, headlines, granularity, selectedSource, selectedDate);
  }, [dailyScores, headlines, granularity, selectedSource, selectedDate]);

  const selectedPrevBucket = useMemo(() => {
    if (!selectedDate) return null;
    const prevKey = prevBucketKey(selectedDate, granularity);
    // For prev bucket delta, always use "All" sources if selected is "All"; otherwise match.
    return buildBucket(dailyScores, headlines, granularity, selectedSource, prevKey);
  }, [dailyScores, headlines, granularity, selectedSource, selectedDate]);

  // Headlines in the selected bucket's date range
  const selectedBucketHeadlines = useMemo(() => {
    if (!selectedBucket) return [];
    const { start, end } = selectedBucket;
    let filtered = headlines.filter((h) => h.date >= start && h.date <= end);
    if (selectedSource !== "All") filtered = filtered.filter((h) => h.source === selectedSource);
    return filtered;
  }, [headlines, selectedBucket, selectedSource]);

  // Filter headlines for the main table
  const filteredHeadlines = useMemo(() => {
    let filtered = headlines;
    if (selectedSource !== "All") {
      filtered = filtered.filter((h) => h.source === selectedSource);
    }
    if (selectedBucket) {
      const { start, end } = selectedBucket;
      filtered = filtered.filter((h) => h.date >= start && h.date <= end);
      filtered = [...filtered].sort(
        (a, b) => Math.abs(b.score) - Math.abs(a.score)
      );
    }
    return filtered;
  }, [headlines, selectedSource, selectedBucket]);

  const handleDateSelect = useCallback(
    (date: string | null) => {
      setSelectedDate(date);
    },
    []
  );

  const handleSourceChange = useCallback((source: string) => {
    setSelectedSource(source);
  }, []);

  const handleRangeChange = useCallback(
    (days: number) => {
      const oldG = getGranularity(selectedRange);
      const newG = getGranularity(days);
      setSelectedRange(days);
      // Remap the selected bucket to the new granularity using its center day.
      // The visible window re-anchors around the selection (see filteredDailyScores),
      // so no clamp-to-edge logic is needed.
      if (selectedDate && oldG !== newG) {
        const representative = bucketCenter(selectedDate, oldG);
        const newKey = bucketKey(representative, newG);
        if (newKey !== selectedDate) setSelectedDate(newKey);
      }
    },
    [selectedDate, selectedRange]
  );

  const totalHeadlines = dailyScores.reduce((sum, d) => sum + d.count, 0);
  const daysTracked = dailyScores.length;

  // Range-aware trend headline. Adapts comparison window + framing to the selected range.
  const trendData = useMemo(() => {
    const data = filteredDailyScores;
    if (data.length < 2) return null;

    let recentWindow: DailyScore[];
    let priorWindow: DailyScore[];
    let framing: string;
    let magnitudeFmt: (delta: number) => string;
    let flatThreshold: number;
    let moverThreshold: number;

    if (selectedRange === 7) {
      // Day-over-day
      recentWindow = [data[data.length - 1]];
      priorWindow = [data[data.length - 2]];
      framing = "day-over-day";
      magnitudeFmt = (d) => Math.abs(d).toFixed(2);
      flatThreshold = 0.02;
      moverThreshold = 0.1; // single day per-source is noisy
    } else if (selectedRange === 30) {
      // Week-over-week (preserves original framing)
      if (data.length < 8) return null;
      recentWindow = data.slice(-7);
      priorWindow = data.slice(-14, -7);
      framing = "week-over-week";
      magnitudeFmt = (d) => `~${Math.abs(d * 100).toFixed(0)}%`;
      flatThreshold = 0.01;
      moverThreshold = 0.03;
    } else if (selectedRange === 90 || selectedRange === 180) {
      // Month-over-month
      if (data.length < 31) return null;
      recentWindow = data.slice(-30);
      priorWindow = data.slice(-60, -30);
      if (priorWindow.length < 15) return null;
      framing = "month-over-month";
      magnitudeFmt = (d) => Math.abs(d).toFixed(2);
      flatThreshold = 0.02;
      moverThreshold = 0.05;
    } else {
      // 1Y / All: first 30d vs last 30d of the visible window
      if (data.length < 60) return null;
      recentWindow = data.slice(-30);
      priorWindow = data.slice(0, 30);
      const months = Math.max(1, Math.round(data.length / 30));
      framing = selectedRange === 365 ? "over 12 months" : `over ${months} months`;
      magnitudeFmt = (d) => Math.abs(d).toFixed(2);
      flatThreshold = 0.02;
      moverThreshold = 0.08;
    }

    const recentMean =
      recentWindow.reduce((s, d) => s + d.mean, 0) / recentWindow.length;
    const priorMean =
      priorWindow.reduce((s, d) => s + d.mean, 0) / priorWindow.length;
    const delta = recentMean - priorMean;

    const direction =
      delta > flatThreshold ? "up" : delta < -flatThreshold ? "down" : "flat";

    // Biggest source mover over the matching window
    let biggestMover: string | null = null;
    let biggestShift = 0;
    const allSources = new Set<string>();
    recentWindow.forEach((d) =>
      Object.keys(d.by_source).forEach((s) => allSources.add(s))
    );
    for (const src of allSources) {
      const rAvg =
        recentWindow.reduce((s, d) => s + (d.by_source[src]?.mean ?? 0), 0) /
        recentWindow.length;
      const pAvg =
        priorWindow.reduce((s, d) => s + (d.by_source[src]?.mean ?? 0), 0) /
        priorWindow.length;
      const shift = Math.abs(rAvg - pAvg);
      if (shift > biggestShift) {
        biggestShift = shift;
        biggestMover = src;
      }
    }
    if (biggestShift < moverThreshold) biggestMover = null;

    return {
      direction,
      magnitude: magnitudeFmt(delta),
      framing,
      biggestMover,
    };
  }, [filteredDailyScores, selectedRange]);

  return (
    <div className="space-y-4">
      <div className="animate-in delay-1 relative z-20">
        <FilterBar
          sources={[...SOURCES]}
          selectedSource={selectedSource}
          onSourceChange={handleSourceChange}
          ranges={[...TIME_RANGES]}
          selectedRange={selectedRange}
          onRangeChange={handleRangeChange}
        />
      </div>

      {trendData && (
        <div className="animate-in delay-1 border-l-2 border-accent/30 pl-3 -mt-1">
          <p className="text-xs font-mono text-text-secondary">
            Sentiment{" "}
            {trendData.direction === "up" ? (
              <span className="text-positive font-medium">up {trendData.magnitude}</span>
            ) : trendData.direction === "down" ? (
              <span className="text-negative font-medium">down {trendData.magnitude}</span>
            ) : (
              <span className="text-neutral font-medium">holding steady</span>
            )}
            {" "}{trendData.framing}
            {trendData.biggestMover && <>, led by {trendData.biggestMover}</>}
          </p>
        </div>
      )}

      <div className="animate-in delay-2">
        <SentimentChart
          data={chartData}
          movingAverage={movingAverage}
          granularity={granularity}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
      </div>

      {selectedBucket && (
        <DayDetail
          bucket={selectedBucket}
          prevBucket={selectedPrevBucket}
          headlines={selectedBucketHeadlines}
          onClose={() => setSelectedDate(null)}
        />
      )}

      <div className="animate-in delay-4">
        <HeadlinesTable
          headlines={filteredHeadlines}
          selectedDate={selectedDate}
          selectedLabel={selectedBucket?.longLabel ?? null}
          onClearDate={() => setSelectedDate(null)}
        />
      </div>

      <MethodologyFooter
        totalHeadlines={totalHeadlines}
        daysTracked={daysTracked}
        firstDate={dailyScores[0]?.date ?? ""}
        lastDate={dailyScores[dailyScores.length - 1]?.date ?? ""}
      />
    </div>
  );
}
