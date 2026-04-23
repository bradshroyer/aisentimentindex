const GRID =
  "grid-cols-[2ch_1fr_minmax(80px,1.5fr)_6ch] sm:grid-cols-[2ch_1fr_56px_minmax(160px,1.5fr)_6ch]";

export default function Loading() {
  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-serif tracking-tight">
            AI Sentiment Index
          </h1>
          <div className="w-12 h-0.5 bg-accent mt-2 rounded-full" />
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">
            Outlet leaderboard &mdash; ranked by average sentiment toward AI across the selected range.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3 animate-pulse">
          <div className="flex items-center gap-5">
            <div className="h-3 w-16 bg-surface-alt rounded" />
            <div className="h-3 w-20 bg-surface-alt rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-surface-alt" />
            <div className="h-8 w-8 rounded-full bg-surface-alt" />
          </div>
        </div>
      </header>

      <div className="space-y-4 animate-pulse">
        {/* Stats line + range pills */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="h-3 w-72 bg-surface-alt/70 rounded" />
          <div className="h-9 w-[22rem] max-w-full bg-surface-alt/50 rounded-lg" />
        </div>

        {/* Italic lede ("Over the selected range, X covers AI most positively; ...") */}
        <div className="pt-1 pb-2 space-y-2">
          <div className="h-5 w-11/12 bg-surface-alt/60 rounded" />
          <div className="h-5 w-2/3 bg-surface-alt/60 rounded" />
        </div>

        {/* Leaderboard card: header row + 14 outlet rows */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div
            className={`grid items-center gap-3 px-4 py-3 border-b border-border ${GRID}`}
          >
            <div className="h-2.5 w-3 bg-surface-alt rounded" />
            <div className="h-2.5 w-14 bg-surface-alt rounded" />
            <div className="h-2.5 w-12 bg-surface-alt rounded hidden sm:block" />
            <div className="h-2.5 w-full bg-surface-alt/60 rounded hidden sm:block" />
            <div className="h-2.5 w-12 bg-surface-alt rounded justify-self-end" />
          </div>
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className={`grid items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 ${GRID}`}
            >
              <div className="h-3 w-3 bg-surface-alt/60 rounded" />
              <div className="h-3 w-32 bg-surface-alt rounded" />
              <div className="h-4 w-14 bg-surface-alt/50 rounded hidden sm:block" />
              <div className="h-3 w-full bg-surface-alt/40 rounded" />
              <div className="h-3 w-10 bg-surface-alt rounded justify-self-end" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
