"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap items-center justify-start gap-x-4 gap-y-1 sm:justify-end sm:gap-x-5"
      aria-label="Primary"
    >
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`text-[11px] font-mono uppercase tracking-[0.18em] transition-colors ${
              active
                ? "text-accent"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
