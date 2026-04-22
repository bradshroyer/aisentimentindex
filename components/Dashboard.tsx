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
import { SPIKE_ANNOTATIONS } from "@/lib/annotations";
import { FilterBar } from "./FilterBar";
import { SentimentChart } from "./SentimentChart";
import { StatsBar } from "./StatsBar";
import { DayDetail } from "./DayDetail";
import { HeadlinesTable } from "./HeadlinesTable";
import { SourceLeaderboard } from "./SourceLeaderboard";
import { MethodologyFooter } from "./MethodologyFooter";
import { YearReviewRibbon, type YearReviewData } from "./YearReviewRibbon";

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

  // Year-in-review hero stat. Independent of selectedRange — always reflects
  // the last 365 days of full data (not filtered). Null when <365 days logged.
  const yearReview = useMemo<YearReviewData | null>(() => {
    if (dailyScores.length < 365) return null;
    const window = dailyScores.slice(-365);
    const recent = window.slice(-30);
    const prior = window.slice(0, 30);
    if (recent.length < 30 || prior.length < 30) return null;

    const meanOf = (arr: DailyScore[]) =>
      arr.reduce((s, d) => s + d.mean, 0) / arr.length;
    const recentMean = meanOf(recent);
    const priorMean = meanOf(prior);
    const delta = recentMean - priorMean;

    // Peak / trough month (min 15 days coverage)
    const monthAgg = new Map<string, { weighted: number; count: number; days: number }>();
    for (const d of window) {
      const key = d.date.slice(0, 7);
      const agg = monthAgg.get(key) ?? { weighted: 0, count: 0, days: 0 };
      agg.weighted += d.mean * d.count;
      agg.count += d.count;
      agg.days += 1;
      monthAgg.set(key, agg);
    }
    let peak: { key: string; mean: number } | null = null;
    let trough: { key: string; mean: number } | null = null;
    for (const [key, agg] of monthAgg) {
      if (agg.days < 15 || agg.count === 0) continue;
      const mean = agg.weighted / agg.count;
      if (!peak || mean > peak.mean) peak = { key, mean };
      if (!trough || mean < trough.mean) trough = { key, mean };
    }

    // Biggest single-day swing
    let biggestDay: { date: string; delta: number; label: string | null } | null = null;
    for (let i = 1; i < window.length; i++) {
      const diff = window[i].mean - window[i - 1].mean;
      if (!biggestDay || Math.abs(diff) > Math.abs(biggestDay.delta)) {
        biggestDay = { date: window[i].date, delta: diff, label: null };
      }
    }
    if (biggestDay) {
      const annot = SPIKE_ANNOTATIONS.find((a) => a.date === biggestDay!.date);
      if (annot) biggestDay.label = annot.label;
    }

    // Biggest source mover (first 30d vs last 30d)
    const allSources = new Set<string>();
    recent.forEach((d) => Object.keys(d.by_source).forEach((s) => allSources.add(s)));
    prior.forEach((d) => Object.keys(d.by_source).forEach((s) => allSources.add(s)));
    let biggestSourceMover: { source: string; shift: number } | null = null;
    for (const src of allSources) {
      const rPts = recent.filter((d) => d.by_source[src]);
      const pPts = prior.filter((d) => d.by_source[src]);
      if (rPts.length < 5 || pPts.length < 5) continue;
      const rAvg = rPts.reduce((s, d) => s + d.by_source[src].mean, 0) / rPts.length;
      const pAvg = pPts.reduce((s, d) => s + d.by_source[src].mean, 0) / pPts.length;
      const shift = Math.abs(rAvg - pAvg);
      if (!biggestSourceMover || shift > biggestSourceMover.shift) {
        biggestSourceMover = { source: src, shift };
      }
    }
    if (biggestSourceMover && biggestSourceMover.shift < 0.1) biggestSourceMover = null;

    return { delta, recentMean, priorMean, peak, trough, biggestDay, biggestSourceMover };
  }, [dailyScores]);

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

      {yearReview && <YearReviewRibbon data={yearReview} />}

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
