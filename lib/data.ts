import { getSupabase } from "./supabase";
import type { Headline, DailyScore, SourceStats } from "./types";
import { decodeEntities } from "./text";
import { HEADLINE_COLUMNS, normalizeHeadline } from "./clientData";
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

// The server renders only the default 30-day view; older slices stream in on
// demand from the browser (lib/clientData.ts fetchHeadlinesRange). The 5-day
// pad means a slightly stale ingest still doesn't force a fetch on first
// paint. The chart is driven by `daily_scores` (which stays all-time), so
// every range renders instantly — only headline-backed views (table, day
// detail) wait on the on-demand fetch.
const INITIAL_HEADLINES_DAYS = 35;

/** Start of the server-rendered headlines window (YYYY-MM-DD). */
export function headlinesSince(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - INITIAL_HEADLINES_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch headlines from `since` onward — from Supabase if configured,
 * otherwise from local data.json.
 */
export async function fetchHeadlines(since: string): Promise<Headline[]> {
  const supabase = getSupabase();

  if (supabase) {
    const allData: Headline[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("headlines")
        .select(HEADLINE_COLUMNS)
        .gte("date", since)
        // id tiebreaker keeps offset pagination stable across requests —
        // timestamps tie within an ingest batch (see lib/clientData.ts).
        .order("timestamp", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as unknown as Headline[]).map(normalizeHeadline));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return allData;
  }

  // Fallback: read everything from local data.json. Dev without Supabase has
  // no on-demand source for older slices, so ship the whole file instead.
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
