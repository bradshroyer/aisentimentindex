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

/**
 * Fetch headlines — from Supabase if configured, otherwise from local data.json.
 */
export async function fetchHeadlines(): Promise<Headline[]> {
  const supabase = getSupabase();

  if (supabase) {
    // Paginate to get all headlines
    const allData: Headline[] = [];
    let offset = 0;
    const pageSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from("headlines")
        .select("*")
        .order("timestamp", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as Headline[]));
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return dedupeHeadlines(allData);
  }

  // Fallback: read from local data.json
  return loadHeadlinesFromFile();
}

/**
 * Deduplicate headlines by normalized title+source+date, keeping the first occurrence.
 */
function dedupeHeadlines(headlines: Headline[]): Headline[] {
  const normalize = (s: string) =>
    s.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
     .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
     .replace(/\u2013/g, "-")
     .replace(/\u2014/g, "--")
     .trim();

  const seen = new Set<string>();
  return headlines.filter((h) => {
    const key = `${normalize(h.title)}|${h.source}|${h.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    }))
    .sort((a: Headline, b: Headline) => b.timestamp.localeCompare(a.timestamp));
}
