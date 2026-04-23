import { getSupabase } from "./supabase";
import type { Headline, DailyScore, SourceStats } from "./types";
import fs from "fs";
import path from "path";

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

    while (true) {
      const { data, error } = await supabase
        .from("headlines")
        .select("*")
        .gte("date", cutoff)
        .order("timestamp", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as Headline[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return allData;
  }

  // Fallback: read from local data.json
  return loadHeadlinesFromFile();
}

// --- Local file fallback for dev without Supabase ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadDataJson(): any | null {
  try {
    const filePath = path.join(process.cwd(), "data.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadDailyScoresFromFile(): DailyScore[] {
  const data = loadDataJson();
  if (!data?.daily_scores) return [];

  return Object.entries(data.daily_scores)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]: [string, any]) => ({
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
    .map((h: any, i: number) => ({
      id: i,
      title: h.title,
      summary: h.summary ?? null,
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
