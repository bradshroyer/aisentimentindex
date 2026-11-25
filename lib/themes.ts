import type { Headline } from "./types";

// Recurring storylines in AI coverage, matched by keyword on the headline
// text. This is deliberately a rough cut: it answers "what was the month
// about?" on the recap pages, not "how did it feel?" — sentiment itself stays
// model-scored. Word-boundary patterns only (the methodology page explains
// what substring matching did to the old lexicon scorer). A headline can match
// several themes or none; on the Jan 2025 – Nov 2026 history about 42% of
// headlines match at least one.
//
// If Claude ever returns a topic field at ingest (see "Future Directions" in
// CLAUDE.md), swap this for that and delete the patterns.

export interface Theme {
  slug: string;
  label: string;
  pattern: RegExp;
}

export const THEMES: Theme[] = [
  {
    slug: "markets",
    label: "Markets & investment",
    pattern:
      /\b(stocks?|shares|investors?|valuations?|ipo|funding|raises?|billion|trillion|bubble|rally|selloff|sell-off|earnings|revenue|nasdaq|wall street|market cap|capex)\b/i,
  },
  {
    slug: "chips",
    label: "Chips & data centers",
    pattern:
      /\b(nvidia|chips?|chipmakers?|gpus?|semiconductors?|data cent(?:er|re)s?|tsmc|amd|power grid|electricity)\b/i,
  },
  {
    slug: "products",
    label: "Products & launches",
    pattern:
      /\b(launch(?:es|ed|ing)?|unveil(?:s|ed|ing)?|releases?|released|rolls? out|rollout|debuts?|introduc(?:es|ed|ing)|new model)\b/i,
  },
  {
    slug: "safety",
    label: "Safety & harms",
    pattern:
      /\b(deepfakes?|misinformation|disinformation|scams?|fraud|suicides?|safety|unsafe|harm(?:s|ed|ful)?|abuse|bias|hallucinat\w*|danger(?:s|ous)?|psychosis|surveillance|privacy)\b/i,
  },
  {
    slug: "jobs",
    label: "Jobs & work",
    pattern:
      /\b(jobs?|layoffs?|laid off|workers?|workforce|employees?|hiring|unemployment|careers?|labor|labour|white-collar)\b/i,
  },
  {
    slug: "policy",
    label: "Regulation & policy",
    pattern:
      /\b(regulat\w*|legislation|lawmakers?|congress|senate|senators?|white house|executive order|ai act|policy|bans?|banned|ftc|parliament)\b/i,
  },
  {
    slug: "courts",
    label: "Courts & copyright",
    pattern:
      /\b(lawsuits?|sues?|sued|suing|court|judge|copyright|settlement|trial|ruling|antitrust)\b/i,
  },
  {
    slug: "education",
    label: "Education & kids",
    pattern:
      /\b(students?|schools?|teachers?|classrooms?|universit(?:y|ies)|college|teens?|children|kids|homework|cheating)\b/i,
  },
  {
    slug: "creative",
    label: "Creative & media",
    pattern:
      /\b(artists?|music|musicians?|hollywood|film|writers?|authors?|publishers?|journalis(?:m|ts?)|newsrooms?|songs?)\b/i,
  },
];

export interface ThemeStat {
  slug: string;
  label: string;
  count: number;
  mean: number;
  /** Share of all headlines in the slice that matched this theme (0–1). */
  share: number;
}

/**
 * Count and average score per theme over a slice of headlines, most-covered
 * first. Themes with fewer than `minCount` matches are dropped — a mean over
 * a handful of headlines overstates precision.
 */
export function themeStats(headlines: Headline[], minCount = 8): ThemeStat[] {
  const total = headlines.length;
  if (total === 0) return [];

  const stats = THEMES.map((t) => {
    let count = 0;
    let sum = 0;
    for (const h of headlines) {
      if (t.pattern.test(h.title)) {
        count += 1;
        sum += h.score;
      }
    }
    return {
      slug: t.slug,
      label: t.label,
      count,
      mean: count > 0 ? sum / count : 0,
      share: count / total,
    };
  });

  return stats.filter((s) => s.count >= minCount).sort((a, b) => b.count - a.count);
}
