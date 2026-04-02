import Link from "next/link";

export function SponsorPill() {
  return (
    <Link
      href="/sponsor"
      className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-accent/25 hover:border-accent/50 bg-accent/[0.04] hover:bg-accent/[0.08] text-accent transition-all duration-200"
    >
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="w-3 h-3 transition-transform duration-200 group-hover:scale-110"
      >
        <path d="M8 0L10 6H16L11 9.5L13 16L8 12L3 16L5 9.5L0 6H6L8 0Z" />
      </svg>
      <span className="text-[10px] font-mono uppercase tracking-widest font-medium">
        Sponsor this project
      </span>
      <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-[0_0_12px_rgba(217,119,6,0.15)] dark:shadow-[0_0_12px_rgba(245,158,11,0.2)]" />
    </Link>
  );
}
