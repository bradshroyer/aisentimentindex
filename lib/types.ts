export interface Headline {
  id: number;
  title: string;
  summary: string | null;
  url: string | null;
  source: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO 8601
  score_raw: number;
  score: number;
  scored_by: string | null;
}

export interface SourceStats {
  mean: number;
  count: number;
}

export interface DailyScore {
  date: string;
  mean: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
  sources: string[];
  by_source: Record<string, SourceStats>;
}

// Source list is canonical in data/sources.json and shared with Python
// (scripts/fetch_and_build.py) to prevent drift between ingest and UI.
import sourcesData from "@/data/sources.json";

interface SourceEntry {
  name: string;
  rss: string;
  /** false = retired: no longer ingested or shown; raw rows kept in the DB. */
  active?: boolean;
  /** Last day the source produced data (YYYY-MM-DD), for retired sources. */
  retired?: string;
}

const SOURCE_LIST = sourcesData as SourceEntry[];

/**
 * Sources shown on the site: active ones only. Retired sources ("active":
 * false) are hidden everywhere — the server and browser fetches filter their
 * headlines out, and the Python aggregation leaves them out of daily_scores.
 * Their raw rows stay in the database and the public export.
 */
export const SOURCES: readonly string[] = SOURCE_LIST
  .filter((s) => s.active !== false)
  .map((s) => s.name)
  .sort();
export const ACTIVE_SOURCE_COUNT = SOURCES.length;

export type SourceName = string;

export const TIME_RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: 0 },
] as const;
