"use client";

import { SOURCES } from "@/lib/types";

export function MethodologyFooter() {
  return (
    <footer className="animate-in delay-5 pt-6 pb-8">
      <div className="bg-card border border-border rounded-lg px-5 py-4 border-l-[3px] border-l-accent/40">
        <p className="text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-2">
          Methodology
        </p>

        <p className="text-xs text-text-secondary leading-relaxed">
          Each headline is scored by Claude Haiku for its{" "}
          <span className="text-text-primary font-medium">
            stance toward AI
          </span>
          , not just word sentiment&mdash;a headline about an AI company winning
          a court case scores positive, even if the words sound adversarial.
        </p>

        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] font-mono text-text-tertiary">
          <span>
            Model{" "}
            <span className="text-text-secondary">claude-haiku-4-5</span>
          </span>
          <span>
            Scale{" "}
            <span className="text-text-secondary">
              <span className="text-negative">&minus;1.0</span>
              {" "}to{" "}
              <span className="text-positive">+1.0</span>
            </span>
          </span>
          <span>
            Sources{" "}
            <span className="text-text-secondary">{SOURCES.length} outlets</span>
          </span>
          <span>
            Updates{" "}
            <span className="text-text-secondary">every 6h</span>
          </span>
          <span>
            Fallback{" "}
            <span className="text-text-secondary">VADER + domain rules</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
