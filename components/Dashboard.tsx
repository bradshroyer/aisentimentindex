"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Headline, DailyScore } from "@/lib/types";
import { SOURCES, TIME_RANGES } from "@/lib/types";
import {
  getGranularity,
  bucketKey,
  bucketEnd,
  bucketChartData,
  buildBucket,
  prevBucketKey,
  type ChartDayPoint,
} from "@/lib/bucketing";
import { computeSourceLeaderboard } from "@/lib/sourceStats";
import { FilterBar } from "./FilterBar";
import { SentimentChart } from "./SentimentChart";
import { StatsBar } from "./StatsBar";
import { DayDetail } from "./DayDetail";
import { HeadlinesTable } from "./HeadlinesTable";
import { SourceLeaderboard } from "./SourceLeaderboard";
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
      setSelectedRange(days);
      // Remap the selected bucket to the new granularity. Pick a
      // representative day from the *overlap* between the old bucket's
      // range and the new visible range, so narrowing doesn't push the
      // selection off-chart whenever any part of the old bucket is still
      // on-screen.
      if (selectedDate) {
        const newG = getGranularity(days);
        const lastDate = dailyScores[dailyScores.length - 1]?.date ?? "";
        const oldStart = selectedDate;
        const oldEnd = bucketEnd(selectedDate, oldG);
        let visibleStart = "0000-00-00";
        if (days > 0 && lastDate) {
          const cutoff = new Date(lastDate + "T12:00:00");
          cutoff.setDate(cutoff.getDate() - days);
          visibleStart = cutoff.toISOString().slice(0, 10);
        }
        const visibleEnd = lastDate || oldEnd;
        const overlapStart = oldStart > visibleStart ? oldStart : visibleStart;
        const overlapEnd = oldEnd < visibleEnd ? oldEnd : visibleEnd;
        // If the old selection has no overlap with the new visible range,
        // clamp to the nearest visible edge rather than clearing — keeps the
        // user oriented when narrowing past an old pick.
        let representative: string;
        if (overlapStart > overlapEnd) {
          representative = oldEnd < visibleStart ? visibleStart : visibleEnd;
        } else {
          const midStart = new Date(overlapStart + "T12:00:00").getTime();
          const midEnd = new Date(overlapEnd + "T12:00:00").getTime();
          representative = new Date((midStart + midEnd) / 2)
            .toISOString()
            .slice(0, 10);
        }
        const newKey = bucketKey(representative, newG);
        if (newKey !== selectedDate) setSelectedDate(newKey);
      }
    },
    [selectedDate, selectedRange, dailyScores]
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

  // Per-source leaderboard (all sources, independent of selectedSource filter)
  const sourceLeaderboard = useMemo(
    () => computeSourceLeaderboard(headlines),
    [headlines]
  );

  // Trend data (structured for safe JSX composition)
  const trendData = useMemo(() => {
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

    return {
      direction,
      pct,
      sourceCount,
      biggestMover: biggestMover && biggestShift > 0.03 ? biggestMover : null,
    };
  }, [weekDelta, dailyScores]);

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
              <span className="text-positive font-medium">up ~{trendData.pct}%</span>
            ) : trendData.direction === "down" ? (
              <span className="text-negative font-medium">down ~{trendData.pct}%</span>
            ) : (
              <span className="text-neutral font-medium">holding steady</span>
            )}
            {" "}this week across {trendData.sourceCount} sources
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

      <div className="animate-in delay-3">
        <StatsBar
          totalHeadlines={totalHeadlines}
          daysTracked={daysTracked}
          latestScore={latestScore}
          dayDelta={dayDelta}
          weekDelta={weekDelta}
          sourcesToday={sourcesToday}
          firstDate={dailyScores[0]?.date ?? ""}
          lastDate={dailyScores[dailyScores.length - 1]?.date ?? ""}
          totalSources={SOURCES.length}
        />
      </div>

      <div className="animate-in delay-4">
        <SourceLeaderboard
          rows={sourceLeaderboard}
          selectedSource={selectedSource}
          onSourceChange={handleSourceChange}
        />
      </div>

      <div className="animate-in delay-4">
        <HeadlinesTable
          headlines={filteredHeadlines}
          selectedDate={selectedDate}
          selectedLabel={selectedBucket?.longLabel ?? null}
          onClearDate={() => setSelectedDate(null)}
        />
      </div>

      <MethodologyFooter />
    </div>
  );
}
