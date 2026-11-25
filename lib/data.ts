import { getSupabase } from "./supabase";
import type { Headline, DailyScore, SourceStats } from "./types";
import { SOURCES } from "./types";
import { decodeEntities } from "./text";
import { HEADLINE_COLUMNS, normalizeHeadline } from "./clientData";
import { cache } from "react";
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

    return (data ?? []).map((row) =>
      withoutRetired({
        date: row.date,
        mean: row.mean,
        count: row.count,
        pos: row.pos,
        neg: row.neg,
        neu: row.neu,
        sources: (row.sources as string[]) ?? [],
        by_source: (row.by_source as Record<string, SourceStats>) ?? {},
      })
    );
  }

  // Fallback: read from local data.json
  return loadDailyScoresFromFile();
}

/**
 * `fetchDailyScores` deduped per request: pages that need the series in both
 * `generateMetadata` and the page body share one query.
 */
export const getDailyScores = cache(fetchDailyScores);

// Belt and braces for retired sources: the Python aggregation already leaves
// them out of daily_scores, but a row written before a source was retired
// would otherwise still list it per-source (leaderboard, day detail).
function withoutRetired(d: DailyScore): DailyScore {
  const active = new Set(SOURCES);
  return {
    ...d,
    sources: d.sources.filter((s) => active.has(s)),
    by_source: Object.fromEntries(
      Object.entries(d.by_source).filter(([s]) => active.has(s))
    ),
  };
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
  return fetchHeadlinesBetween(since, null);
}

/**
 * Fetch headlines with date in [since, until] (inclusive; `until = null`
 * means open-ended), newest first. Backs the per-day and per-month pages,
 * which need one bounded slice rather than everything since a cutoff.
 */
export async function fetchHeadlinesBetween(
  since: string,
  until: string | null
): Promise<Headline[]> {
  const supabase = getSupabase();

  if (supabase) {
    const allData: Headline[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      let query = supabase
        .from("headlines")
        .select(HEADLINE_COLUMNS)
        .gte("date", since);
      if (until) query = query.lte("date", until);

      const { data, error } = await query
        .in("source", SOURCES as string[])
        .not("about_ai", "is", false)
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

  // Fallback: read from local data.json. An open-ended fetch ships the whole
  // file — dev without Supabase has no on-demand source for older slices.
  const all = loadHeadlinesFromFile();
  if (!until) return all;
  return all.filter((h) => h.date >= since && h.date <= until);
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
