"use client";

import { SOURCES } from "@/lib/types";
import { NewsAPIaiLogo } from "./NewsAPIaiLogo";

interface MethodologyFooterProps {
  totalHeadlines: number;
  daysTracked: number;
  firstDate: string;
  lastDate: string;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const [, month, day] = dateStr.split("-");
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(month, 10)]} ${parseInt(day, 10)}`;
}

export function MethodologyFooter({
  totalHeadlines,
  daysTracked,
  firstDate,
  lastDate,
}: MethodologyFooterProps) {
  const META = [
    { label: "Model", value: "claude-haiku-4-5" },
    { label: "Scale", value: "−1.0 to +1.0" },
    { label: "Sources", value: `${SOURCES.length} outlets` },
    { label: "Updates", value: "every 6h" },
    { label: "Fallback", value: "VADER + domain rules" },
    { label: "Headlines", value: totalHeadlines.toLocaleString() },
    {
      label: "Coverage",
      value: `${daysTracked} days · ${formatShortDate(firstDate)}–${formatShortDate(lastDate)}`,
    },
  ];
  return (
    <footer className="animate-in delay-5 pt-20 pb-12">
      <div
        className="flex items-center justify-center gap-5 mb-12"
        aria-hidden="true"
      >
        <span className="h-px flex-1 bg-border" />
        <span className="font-serif text-accent/70 text-lg leading-none select-none">
          ✦
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-text-tertiary text-center mb-5">
        Methodology
      </p>

      <p className="font-serif italic text-lg sm:text-xl md:text-2xl text-text-secondary text-center leading-snug mb-10">
        Each headline is scored by Claude Haiku for its{" "}
        <span className="text-text-primary">stance toward AI</span>&mdash;not
        word sentiment.
      </p>

      <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 mb-14">
        {META.map((m) => (
          <span
            key={m.label}
            className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-tertiary"
          >
            {m.label}
            <span className="text-text-secondary normal-case tracking-normal ml-1.5">
              {m.value}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-y-5 gap-x-6 pt-5 border-t border-border/70">
        <p className="text-[11px] font-mono text-text-tertiary">
          Built by{" "}
          <a
            href="https://bradshroyer.com"
            className="text-text-secondary hover:text-accent transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Brad Shroyer
          </a>
        </p>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-text-secondary">
            Sponsor
          </span>
          <a
            href="https://newsapi.ai"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="NewsAPI.ai"
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <NewsAPIaiLogo className="h-[18px] w-auto" />
          </a>
        </div>
      </div>
    </footer>
  );
}
