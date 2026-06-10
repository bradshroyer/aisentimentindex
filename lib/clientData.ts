import { getSupabase } from "./supabase";
import type { Headline } from "./types";
import { decodeEntities } from "./text";

// Columns the UI reads. `summary` is excluded — it's a per-row text blob
// that's never rendered. Shared by the initial server fetch (lib/data.ts) and
// the on-demand browser fetch below so the two can't drift.
export const HEADLINE_COLUMNS = "id,title,url,source,date,timestamp,score";

export function normalizeHeadline<T extends { title: string; summary?: string | null }>(h: T): T {
  return {
    ...h,
    title: decodeEntities(h.title),
    summary: h.summary == null ? h.summary : decodeEntities(h.summary),
  };
}

/**
 * Fetch headlines with date in [since, before), newest first. Runs in the
 * browser (anon key, read-only RLS) when the user widens the time range or
 * selects a day older than the server-rendered window. Returns [] when
 * Supabase isn't configured — dev without env serves the full data.json
 * payload up front, so there's nothing older to fetch.
 *
 * A wide range can span many 1000-row pages fetched sequentially, so `onPage`
 * delivers each page as it arrives — callers can render progressively instead
 * of staring at a blank view, and pages already received survive a failure on
 * a later one.
 */
export async function fetchHeadlinesRange(
  since: string,
  before: string,
  onPage?: (page: Headline[]) => void
): Promise<Headline[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const all: Headline[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("headlines")
      .select(HEADLINE_COLUMNS)
      .gte("date", since)
      .lt("date", before)
      // Secondary sort on id: timestamps tie within an ingest batch, and
      // offset pagination over a nondeterministic tie-order can skip rows
      // at page boundaries (dedupe downstream catches dupes, not gaps).
      .order("timestamp", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const page = (data as unknown as Headline[]).map(normalizeHeadline);
    all.push(...page);
    onPage?.(page);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}
