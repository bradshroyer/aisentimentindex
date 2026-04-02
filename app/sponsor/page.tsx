import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SponsorForm } from "@/components/SponsorForm";

export const metadata: Metadata = {
  title: "Sponsor — AI Sentiment Index",
  description:
    "Help expand the AI Sentiment Index with 2 years of historical data and more news sources.",
};

export default function SponsorPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-10 flex items-start justify-between animate-in">
        <div>
          <Link
            href="/"
            className="text-xs font-mono text-text-tertiary hover:text-accent transition-colors"
          >
            &larr; Back to Index
          </Link>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight mt-3">
            Sponsor the AI Sentiment Index
          </h1>
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full" />
          <p className="text-xs text-text-secondary mt-3 leading-relaxed max-w-lg">
            This project tracks how 14 major tech outlets write about AI every
            day. With your support, it can become a comprehensive, multi-year
            dataset available to researchers, journalists, and builders.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <div className="space-y-6">
        {/* The Vision */}
        <section className="bg-card border border-border rounded-lg px-5 py-5 animate-in delay-1">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-3">
            The Vision
          </h2>
          <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
            <p>
              Today the AI Sentiment Index covers{" "}
              <span className="text-text-primary font-medium">
                14 sources over the last few weeks
              </span>
              . That&rsquo;s a snapshot — useful, but limited.
            </p>
            <p>
              The goal is to build a{" "}
              <span className="text-text-primary font-medium">
                2-year historical dataset
              </span>{" "}
              spanning 25+ outlets, giving a real picture of how public
              sentiment toward AI has shifted over time — through the ChatGPT
              launch, regulation debates, open-source breakthroughs, and
              everything in between.
            </p>
            <p>
              This dataset would be open for exploration on the site, with
              richer analysis: per-source trends, topic breakdowns, and a
              public API for researchers.
            </p>
          </div>
        </section>

        {/* What Sponsorship Funds */}
        <section className="bg-card border border-border rounded-lg px-5 py-5 animate-in delay-2">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-3">
            What Your Sponsorship Funds
          </h2>
          <ul className="space-y-2.5 text-sm text-text-secondary">
            <li className="flex items-start gap-2.5">
              <span className="text-accent mt-0.5 text-xs">&#9670;</span>
              <span>
                <span className="text-text-primary font-medium">
                  Historical backfill
                </span>{" "}
                — API costs for scoring ~50,000+ archived headlines with Claude
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-accent mt-0.5 text-xs">&#9670;</span>
              <span>
                <span className="text-text-primary font-medium">
                  More sources
                </span>{" "}
                — expanding from 14 to 25+ outlets including international and
                niche tech publications
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-accent mt-0.5 text-xs">&#9670;</span>
              <span>
                <span className="text-text-primary font-medium">
                  Richer analysis
                </span>{" "}
                — topic categorization, per-source trend breakdowns, and
                structured metadata from Claude
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-accent mt-0.5 text-xs">&#9670;</span>
              <span>
                <span className="text-text-primary font-medium">
                  Infrastructure
                </span>{" "}
                — ongoing hosting, database, and compute costs to keep the
                index running and publicly accessible
              </span>
            </li>
          </ul>
        </section>

        {/* Sponsor Recognition */}
        <section className="bg-card border border-border rounded-lg px-5 py-5 animate-in delay-3">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-3">
            Sponsor Recognition
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Sponsors will be credited on the site with a logo and link. If
            you&rsquo;re a company building in the AI space, this is a way to
            support open data and get visibility with a technical audience that
            cares about AI trends.
          </p>
        </section>

        {/* Contact Form */}
        <section className="bg-card border border-border rounded-lg px-5 py-5 animate-in delay-4">
          <h2 className="text-[11px] font-mono uppercase tracking-widest text-text-tertiary mb-4">
            Get in Touch
          </h2>
          <SponsorForm />
        </section>
      </div>

      <footer className="mt-10 pt-6 border-t border-border animate-in delay-5">
        <p className="text-xs text-text-tertiary font-mono">
          Built by{" "}
          <a
            href="https://bradshroyer.com"
            className="text-accent hover:text-accent-hover transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Brad Shroyer
          </a>{" "}
          &middot;{" "}
          <Link
            href="/"
            className="text-accent hover:text-accent-hover transition-colors"
          >
            Back to Index
          </Link>
        </p>
      </footer>
    </main>
  );
}
