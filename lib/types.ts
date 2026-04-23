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
// (scripts/fetch_and_build.py, scripts/backfill_newsapi_ai.py) to prevent
// drift between ingest and UI.
import sourcesData from "@/data/sources.json";

export const SOURCES: readonly string[] = [...sourcesData.map((s) => s.name)].sort();

export type SourceName = string;

export const TIME_RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: 0 },
] as const;
