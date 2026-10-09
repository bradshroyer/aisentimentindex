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
  /** false = retired: no longer ingested, historical rows kept. */
  active?: boolean;
  /** Last day the source produced data (YYYY-MM-DD), for retired sources. */
  retired?: string;
}

const SOURCE_LIST = sourcesData as SourceEntry[];

/** Every source that has ever contributed data (active + retired). */
export const SOURCES: readonly string[] = SOURCE_LIST.map((s) => s.name).sort();

/** Sources currently being ingested. User-facing "N outlets" copy uses this. */
export const ACTIVE_SOURCES: readonly string[] = SOURCE_LIST
  .filter((s) => s.active !== false)
  .map((s) => s.name)
  .sort();
export const ACTIVE_SOURCE_COUNT = ACTIVE_SOURCES.length;

/** Retired source name → last day it had data. */
export const RETIRED_SOURCES: Readonly<Record<string, string>> = Object.fromEntries(
  SOURCE_LIST.filter((s) => s.active === false && s.retired).map((s) => [s.name, s.retired as string])
);

export type SourceName = string;

export const TIME_RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: 0 },
] as const;
