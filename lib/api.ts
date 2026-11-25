import { SITE_URL } from "./site";
import { ACTIVE_SOURCE_COUNT } from "./types";

// Shared envelope + headers for the public, read-only JSON API (/api/v1/*).
//
// Cost model: every route is a static route handler on the site's 6h ISR
// cadence (`export const revalidate`), so responses are served from the CDN
// and Supabase sees at most one query per route per revalidation — no matter
// how many clients call. Keep it that way: handlers must not read the request
// (query params, headers), which would opt the route into per-request
// rendering and put the database behind an open endpoint.

/** Matches the ingest/ISR cadence used by every page. */
export const API_REVALIDATE_SECONDS = 21600;

export const API_HEADERS: Record<string, string> = {
  // Open to any origin — the data is public and the routes are read-only.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": `public, max-age=300, s-maxage=${API_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
};

export function apiMeta() {
  return {
    name: "AI Sentiment Index",
    description: `Daily mean sentiment toward AI in news coverage from ${ACTIVE_SOURCE_COUNT} major outlets, scored per headline by Claude Haiku.`,
    scale: "-1.0 (anti-AI) to +1.0 (pro-AI); scores within ±0.05 count as neutral",
    update_frequency: "every 6 hours",
    license: "MIT",
    attribution: "AI Sentiment Index (sentimentindex.ai)",
    docs: `${SITE_URL}/data`,
    generated_at: new Date().toISOString(),
  };
}

export function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function json(body: unknown): Response {
  return Response.json(body, { headers: API_HEADERS });
}
