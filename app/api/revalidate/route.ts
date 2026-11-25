import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";

// Called by the ingest workflow right after it writes new data, so pages
// pick it up within a minute instead of waiting out the 6h ISR window (the
// homepage could otherwise show a reading from a previous ingest for up to
// six hours after fresher data landed).
//
// Inert until REVALIDATE_SECRET is set in the Vercel project: without it the
// route refuses every call. Nothing is regenerated eagerly — paths are only
// marked stale and rebuild on their next visit.

/** Cached route handlers aren't covered by the layout-wide invalidation. */
const ROUTE_HANDLERS = [
  "/api/v1",
  "/api/v1/latest",
  "/api/v1/daily",
  "/api/v1/daily.csv",
  "/api/v1/outlets",
  "/feed.xml",
  "/sitemap.xml",
];

function authorized(request: Request, secret: string): boolean {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "Revalidation is not configured." }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Every page under the root layout: dashboard, leaderboard, monthly, days.
  revalidatePath("/", "layout");
  for (const path of ROUTE_HANDLERS) revalidatePath(path);

  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
