import Link from "next/link";
import { SiteNav } from "./SiteNav";
import { ShareButton } from "./ShareButton";
import { ThemeToggle } from "./ThemeToggle";

interface SiteHeaderProps {
  tagline: React.ReactNode;
  /**
   * Page-specific document title for subpages. When set, the brand renders
   * as a plain (linked) paragraph and an sr-only h1 carries this title —
   * "AI Sentiment Index" should be the h1 only on the homepage.
   */
  pageTitle?: string;
  /** Extra lines under the tagline (e.g. data freshness on the dashboard). */
  children?: React.ReactNode;
  className?: string;
}

export function SiteHeader({ tagline, pageTitle, children, className = "mb-8" }: SiteHeaderProps) {
  const brandClass = "text-3xl sm:text-4xl font-serif tracking-tight";
  return (
    <header
      className={`${className} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between animate-in`}
    >
      <div>
        {pageTitle && <h1 className="sr-only">{pageTitle}</h1>}
        <Link href="/" className="group inline-block" aria-label="AI Sentiment Index — home">
          {pageTitle ? (
            <p className={brandClass}>AI Sentiment Index</p>
          ) : (
            <h1 className={brandClass}>AI Sentiment Index</h1>
          )}
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full transition-all duration-300 ease-out group-hover:w-full" />
        </Link>
        <p className="text-xs text-text-secondary mt-2 leading-relaxed">{tagline}</p>
        {children}
      </div>
      {/* Mobile: one row under the title (nav left, actions right). Desktop: a
          right-aligned column so nav and actions stack at the page edge. */}
      <div className="-order-1 flex items-center justify-between gap-3 sm:order-none sm:flex-col sm:items-end sm:shrink-0">
        <SiteNav />
        <div className="flex items-center gap-2">
          <ShareButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
