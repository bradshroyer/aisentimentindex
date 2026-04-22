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
}

export interface SourceStats {
  mean: number;
  count: number;
}

export interface SourceSummary {
  source: string;
  mean: number;         // mean score over last 30d window
  count: number;        // headlines in last 30d window
  meanAllTime: number;  // all-time mean (for stable reference)
  countAllTime: number; // all-time volume
  delta30: number | null; // last 30d mean − prior 30d mean (null if not enough data)
  recencyDays: number;    // days since most recent headline
  posPct: number;       // % positive in last 30d window
  negPct: number;       // % negative in last 30d window
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

export const SOURCES = [
  "Ars Technica",
  "BBC Technology",
  "Bloomberg",
  "CNBC Tech",
  "Fox News Tech",
  "MIT Tech Review",
  "NPR Technology",
  "NYT Technology",
  "TechCrunch",
  "The Guardian",
  "The Verge",
  "VentureBeat AI",
  "Wired",
  "ZDNet AI",
] as const;

export type SourceName = (typeof SOURCES)[number];

export const TIME_RANGES = [
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: 0 },
] as const;
