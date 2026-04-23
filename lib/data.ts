import { getSupabase } from "./supabase";
import type { Headline, DailyScore, SourceStats } from "./types";
import { decodeEntities } from "./text";
import fs from "fs";
import path from "path";

function normalizeHeadline<T extends { title: string; summary?: string | null }>(h: T): T {
  return {
    ...h,
    title: decodeEntities(h.title),
    summary: h.summary == null ? h.summary : decodeEntities(h.summary),
  };
}

/**
 * Fetch daily scores — from Supabase if configured, otherwise from local data.json.
 */
export async function fetchDailyScores(): Promise<DailyScore[]> {
  const supabase = getSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from("daily_scores")
      .select("*")
      .order("date", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      date: row.date,
      mean: row.mean,
      count: row.count,
      pos: row.pos,
      neg: row.neg,
      neu: row.neu,
      sources: (row.sources as string[]) ?? [],
      by_source: (row.by_source as Record<string, SourceStats>) ?? {},
    }));
  }

  // Fallback: read from local data.json
  return loadDailyScoresFromFile();
}

// Cap server-side fetch to keep page payload bounded as the table grows.
// The chart is driven by `daily_scores` (which stays all-time), so the "All"
// range still works; only headline-backed views (tables, leaderboard, click-
// through) are restricted to this window.
const HEADLINES_WINDOW_DAYS = 365;

function cutoffDateISO(daysBack: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch headlines — from Supabase if configured, otherwise from local data.json.
 */
export async function fetchHeadlines(): Promise<Headline[]> {
  const supabase = getSupabase();

  if (supabase) {
    const cutoff = cutoffDateISO(HEADLINES_WINDOW_DAYS);
    const allData: Headline[] = [];
    let offset = 0;
    const pageSize = 1000;

    // Project only columns the UI reads. Dropping `summary` (a per-row text
    // blob that's never rendered) keeps the response small enough to finish
    // inside Supabase's statement_timeout during Vercel prerender.
    const columns = "id,title,url,source,date,timestamp,score";

    while (true) {
      const { data, error } = await supabase
        .from("headlines")
        .select(columns)
        .gte("date", cutoff)
        .order("timestamp", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as Headline[]).map(normalizeHeadline));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return allData;
  }

  // Fallback: read from local data.json
  return loadHeadlinesFromFile();
}

// --- Local file fallback for dev without Supabase ---

type DailyScoreRaw = {
  mean: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
  sources?: string[];
  by_source?: Record<string, SourceStats>;
};

type HeadlineRaw = {
  title?: string;
  summary?: string | null;
  url?: string | null;
  source: string;
  date: string;
  timestamp?: string;
  score_raw?: number;
  score: number;
  scored_by?: string | null;
};

type DataJson = {
  daily_scores?: Record<string, DailyScoreRaw>;
  headlines?: HeadlineRaw[];
};

function loadDataJson(): DataJson | null {
  try {
    const filePath = path.join(process.cwd(), "data.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as DataJson;
  } catch {
    return null;
  }
}

function loadDailyScoresFromFile(): DailyScore[] {
  const data = loadDataJson();
  if (!data?.daily_scores) return [];

  return Object.entries(data.daily_scores)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date,
      mean: d.mean,
      count: d.count,
      pos: d.pos,
      neg: d.neg,
      neu: d.neu,
      sources: d.sources ?? [],
      by_source: d.by_source ?? {},
    }));
}

function loadHeadlinesFromFile(): Headline[] {
  const data = loadDataJson();
  if (!data?.headlines) return [];

  return data.headlines
    .map((h: HeadlineRaw, i: number) => ({
      id: i,
      title: decodeEntities(h.title ?? ""),
      summary: h.summary == null ? null : decodeEntities(h.summary),
      url: h.url ?? null,
      source: h.source,
      date: h.date,
      timestamp: h.timestamp ?? "",
      score_raw: h.score_raw ?? h.score,
      score: h.score,
      scored_by: h.scored_by ?? null,
    }))
    .sort((a: Headline, b: Headline) => b.timestamp.localeCompare(a.timestamp));
}
