import { ImageResponse } from "next/og";
import { SITE_HOST } from "./site";

// Share cards for the day and month pages. Same visual language as the
// homepage card (app/opengraph-image.tsx): dark ground, amber accent, big
// monospace reading. Edge-safe — plain fetch against Supabase REST, no
// supabase-js in the bundle.

export const OG_SIZE = { width: 1200, height: 630 };

export interface ScoreRow {
  date: string;
  mean: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
}

/** daily_scores rows with date in [since, until]; null on any failure. */
export async function fetchScoreRows(since: string, until: string): Promise<ScoreRow[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_scores?select=date,mean,count,pos,neg,neu&date=gte.${since}&date=lte.${until}&order=date.asc`,
      {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 21600 },
      }
    );
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) return null;
    const valid = rows.filter(
      (r): r is ScoreRow =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as ScoreRow).date === "string" &&
        Number.isFinite((r as ScoreRow).mean) &&
        Number.isFinite((r as ScoreRow).count)
    );
    return valid.length > 0 ? valid : null;
  } catch {
    return null;
  }
}

/** Headline-weighted roll-up of several days into one reading. */
export function rollUp(rows: ScoreRow[]) {
  let count = 0, pos = 0, neg = 0, neu = 0, weighted = 0;
  for (const r of rows) {
    count += r.count;
    pos += r.pos;
    neg += r.neg;
    neu += r.neu;
    weighted += r.mean * r.count;
  }
  return { mean: count > 0 ? weighted / count : 0, count, pos, neg, neu };
}

function formatMean(mean: number): string {
  const rounded = Math.round(mean * 100) / 100;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded).toFixed(2)}`;
}

function meanColor(mean: number): string {
  if (mean > 0.05) return "#34D399";
  if (mean < -0.05) return "#FB7185";
  return "#A8A29E";
}

const META_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 20,
  color: "#78716C",
  fontFamily: "monospace",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
} as const;

export interface ScoreCard {
  /** Small caps line above the heading, e.g. "Daily reading". */
  eyebrow: string;
  /** e.g. "November 24, 2026" or "October 2026". */
  heading: string;
  mean: number;
  count: number;
  pos: number;
  neg: number;
  neu: number;
}

export function scoreCardImage(card: ScoreCard) {
  const total = card.pos + card.neu + card.neg || 1;
  const BAR_W = 1040;
  const w = (n: number) => Math.round((n / total) * BAR_W);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#0C0A09",
          color: "#F5F0EB",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 48, height: 4, background: "#F59E0B", borderRadius: 2, marginBottom: 24 }} />
          <div style={META_STYLE}>
            <span>AI Sentiment Index</span>
            <span style={{ color: "#F59E0B" }}>&middot;</span>
            <span>{card.eyebrow}</span>
          </div>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em", marginTop: 16 }}>
            {card.heading}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 168,
              fontWeight: 700,
              lineHeight: 1,
              fontFamily: "monospace",
              color: meanColor(card.mean),
            }}
          >
            {formatMean(card.mean)}
          </div>
          <div style={{ display: "flex", width: BAR_W, height: 10, marginTop: 36, borderRadius: 3, overflow: "hidden", background: "#292524" }}>
            <div style={{ width: w(card.pos), height: 10, background: "#34D399" }} />
            <div style={{ width: w(card.neu), height: 10, background: "#57534E" }} />
            <div style={{ width: w(card.neg), height: 10, background: "#FB7185" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", width: "100%" }}>
          <div style={META_STYLE}>
            <span>{card.count.toLocaleString("en-US")} headlines</span>
            <span style={{ color: "#F59E0B" }}>&middot;</span>
            <span style={{ color: "#34D399" }}>{card.pos.toLocaleString("en-US")} pos</span>
            <span style={{ color: "#FB7185" }}>{card.neg.toLocaleString("en-US")} neg</span>
            <span style={{ color: "#F59E0B" }}>&middot;</span>
            <span>&minus;1.0 to +1.0</span>
          </div>
          <div style={{ fontSize: 20, color: "#78716C", fontFamily: "monospace" }}>{SITE_HOST}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
