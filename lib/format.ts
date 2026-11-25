// Formatting + validation shared by the server-rendered content pages
// (/day, /monthly, /data) and the public API. Pure string math on
// YYYY-MM-DD keys — no Date objects, so no timezone drift.

export const MONTHS_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Scores within ±0.05 of zero count as neutral everywhere on the site. */
export const NEUTRAL_BAND = 0.05;

export type Tone = "positive" | "negative" | "neutral";

export function tone(score: number): Tone {
  if (score > NEUTRAL_BAND) return "positive";
  if (score < -NEUTRAL_BAND) return "negative";
  return "neutral";
}

// Literal class names (not `text-${tone}`) so Tailwind's scanner sees them.
const TONE_TEXT: Record<Tone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  neutral: "text-neutral",
};

export function toneClass(score: number): string {
  return TONE_TEXT[tone(score)];
}

/** "+0.34" / "−0.12" with a typographic minus; sign taken after rounding. */
export function formatScore(score: number, digits = 2): string {
  const factor = 10 ** digits;
  const rounded = Math.round(score * factor) / factor;
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits)}`;
}

/** Unsigned magnitude for "up 0.04" / "down 0.04" phrasing. */
export function formatMagnitude(delta: number, digits = 2): string {
  return Math.abs(delta).toFixed(digits);
}

/** Strict YYYY-MM-DD that is also a real calendar date. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Strict YYYY-MM with a real month. */
export function isValidMonth(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const m = parseInt(s.slice(5), 10);
  return m >= 1 && m <= 12;
}

/** "2026-11-25" → "November 25, 2026" */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${MONTHS_LONG[parseInt(m, 10)]} ${parseInt(d, 10)}, ${y}`;
}

/** "2026-11-25" → "Nov 25" (or "Nov 25, 2026" with the year). */
export function shortDate(date: string, withYear = false): string {
  const [y, m, d] = date.split("-");
  const base = `${MONTHS_SHORT[parseInt(m, 10)]} ${parseInt(d, 10)}`;
  return withYear ? `${base}, ${y}` : base;
}

/** "2026-11" → "November 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTHS_LONG[parseInt(m, 10)]} ${y}`;
}

/** "2026-11" → "Nov 2026" */
export function monthShortLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTHS_SHORT[parseInt(m, 10)]} ${y}`;
}

/** Last calendar day of a YYYY-MM month, as YYYY-MM-DD. */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

/** Weekday name for a YYYY-MM-DD date (UTC). */
export function weekday(date: string): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    new Date(date + "T12:00:00Z").getUTCDay()
  ];
}

/** "a", "a and b", "a, b and c" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
