import { ImageResponse } from "next/og";
import { SITE_HOST } from "@/lib/site";

export const runtime = "edge";
export const alt = "AI Sentiment Index — tracking how major news outlets talk about AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ── Live data ──
// Plain fetch against the Supabase REST endpoint — importing supabase-js here
// would bloat the edge bundle for a single read-only query.

type ScoreRow = { date: string; mean: number };

async function fetchRecentScores(): Promise<ScoreRow[] | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/daily_scores?select=date,mean&order=date.desc&limit=30`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        signal: AbortSignal.timeout(3000),
        // Cache at the edge in line with the site's 6h ISR/ingest cadence.
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
        typeof (r as ScoreRow).mean === "number" &&
        Number.isFinite((r as ScoreRow).mean)
    );
    // A sparkline needs at least two points to mean anything.
    if (valid.length < 2) return null;

    return valid.reverse(); // newest-first from the API → chronological
  } catch {
    return null;
  }
}

// ── Formatting (mirrors the dashboard) ──

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-06-09" → "Jun 9, 2026" (string math — no Date, no timezone drift). */
function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12) return isoDate;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "+0.34" / "−0.12" — sign from the rounded value, typographic minus. */
function formatMean(mean: number): string {
  const rounded = Math.round(mean * 100) / 100;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded).toFixed(2)}`;
}

/** Same ±0.05 near-zero threshold as the dashboard; dark-theme token values. */
function meanColor(mean: number): string {
  if (mean > 0.05) return "#34D399"; // --color-positive (dark)
  if (mean < -0.05) return "#FB7185"; // --color-negative (dark)
  return "#A8A29E"; // --color-neutral (dark)
}

// ── Sparkline geometry ──

const SPARK_W = 1040;
const SPARK_H = 210;
const SPARK_PAD = 14; // keeps round caps + the end dot inside the viewBox

function buildSparkline(means: number[]) {
  let lo = Math.min(...means);
  let hi = Math.max(...means);
  if (hi - lo < 1e-6) {
    // All values equal — pad the domain so the line sits mid-chart.
    lo -= 0.1;
    hi += 0.1;
  }

  const xAt = (i: number) =>
    SPARK_PAD + (i / (means.length - 1)) * (SPARK_W - 2 * SPARK_PAD);
  const yAt = (v: number) =>
    SPARK_PAD + ((hi - v) / (hi - lo)) * (SPARK_H - 2 * SPARK_PAD);

  const points = means
    .map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(" ");
  const zeroY = lo <= 0 && 0 <= hi ? yAt(0) : null;
  const lastX = xAt(means.length - 1);
  const lastY = yAt(means[means.length - 1]);

  return { points, zeroY, lastX, lastY };
}

// ── Layouts ──

function liveImage(rows: ScoreRow[]) {
  const latest = rows[rows.length - 1];
  const { points, zeroY, lastX, lastY } = buildSparkline(rows.map((r) => r.mean));

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
        {/* Header: title left, current value right */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Accent bar */}
            <div
              style={{
                width: 48,
                height: 4,
                background: "#F59E0B",
                borderRadius: 2,
                marginBottom: 24,
              }}
            />
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              AI Sentiment Index
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                fontSize: 18,
                color: "#57534E",
                fontFamily: "monospace",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              <span>Today&apos;s index</span>
              <span style={{ color: "#F59E0B" }}>&middot;</span>
              <span>{formatDate(latest.date)}</span>
            </div>
            <div
              style={{
                fontSize: 112,
                fontWeight: 700,
                lineHeight: 1,
                marginTop: 12,
                fontFamily: "monospace",
                color: meanColor(latest.mean),
              }}
            >
              {formatMean(latest.mean)}
            </div>
          </div>
        </div>

        {/* 30-day sparkline */}
        <div style={{ display: "flex", width: "100%" }}>
          <svg
            width={SPARK_W}
            height={SPARK_H}
            viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          >
            {zeroY !== null ? (
              <line
                x1={0}
                y1={zeroY}
                x2={SPARK_W}
                y2={zeroY}
                stroke="#57534E"
                strokeWidth={1}
              />
            ) : null}
            <polyline
              points={points}
              fill="none"
              stroke="#F59E0B"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={lastX}
              cy={lastY}
              r={7}
              fill="#F59E0B"
              stroke="#0C0A09"
              strokeWidth={3}
            />
          </svg>
        </div>

        {/* Footer: meta row + domain */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 18,
              color: "#57534E",
              fontFamily: "monospace",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            <span>14 sources</span>
            <span style={{ color: "#F59E0B" }}>&middot;</span>
            <span>daily scores</span>
            <span style={{ color: "#F59E0B" }}>&middot;</span>
            <span>&minus;1.0 to +1.0</span>
          </div>
          <div
            style={{
              fontSize: 20,
              color: "#57534E",
              fontFamily: "monospace",
            }}
          >
            {SITE_HOST}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

/** Data-free fallback — the original static card. Must never throw. */
function staticImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0C0A09",
          color: "#F5F0EB",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: 48,
            height: 4,
            background: "#F59E0B",
            borderRadius: 2,
            marginBottom: 24,
          }}
        />
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          AI Sentiment Index
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#A8A29E",
            marginTop: 24,
            lineHeight: 1.4,
          }}
        >
          How positive or negative are major news outlets when they
          write about AI?
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 40,
            fontSize: 18,
            color: "#57534E",
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          <span>14 sources</span>
          <span style={{ color: "#F59E0B" }}>&middot;</span>
          <span>daily scores</span>
          <span style={{ color: "#F59E0B" }}>&middot;</span>
          <span>&minus;1.0 to +1.0</span>
        </div>
        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 60,
            right: 80,
            fontSize: 20,
            color: "#57534E",
            fontFamily: "monospace",
          }}
        >
          {SITE_HOST}
        </div>
      </div>
    ),
    { ...size }
  );
}

export default async function Image() {
  const rows = await fetchRecentScores();
  if (rows) {
    try {
      return liveImage(rows);
    } catch {
      // Geometry/render setup failed — never 500 the share image.
    }
  }
  return staticImage();
}
