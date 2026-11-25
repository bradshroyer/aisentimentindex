import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/", label: "Dashboard", body: "The live index and today's headlines." },
  { href: "/monthly", label: "Monthly recaps", body: "Every month since January 2025, with links to each day." },
  { href: "/leaderboard", label: "Leaderboard", body: "Outlets ranked by how they cover AI." },
  { href: "/data", label: "Data & API", body: "JSON, CSV, RSS and the full dataset." },
];

export default function NotFound() {
  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SiteHeader
        className="mb-12"
        ownHeading
        tagline={<>How positive or negative are major news outlets when they write about AI?</>}
      />
      <div className="max-w-2xl mx-auto pb-24">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-text-tertiary mb-3">
          404
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight mb-4">
          Nothing is tracked at this address
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-8">
          The page may have moved, or it points at a day the index has no
          data for. These will get you back on the map:
        </p>
        <ul className="rounded-xl border border-border bg-card card-glow overflow-hidden">
          {LINKS.map((l) => (
            <li key={l.href} className="border-b border-border last:border-b-0">
              <Link
                href={l.href}
                className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-surface-alt/60 transition-colors"
              >
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-primary group-hover:text-accent transition-colors">
                  {l.label}
                </span>
                <span className="text-xs text-text-secondary">{l.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
