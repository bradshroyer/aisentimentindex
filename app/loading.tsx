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
            How positive or negative are major news outlets when they write about AI? A daily score from &minus;1.0 to +1.0 across 14 sources.
          </p>
          <div className="h-3 w-48 bg-surface-alt/70 rounded mt-2 animate-pulse" />
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
        {/* Filter bar — matches FilterBar: Source label + dropdown on left, range pills on right */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-14 bg-surface-alt/70 rounded" />
            <div className="h-8 w-36 bg-card border border-border rounded-lg" />
          </div>
          <div className="h-9 w-[22rem] max-w-full bg-surface-alt/50 rounded-lg sm:ml-auto" />
        </div>

        {/* Trend strip */}
        <div className="border-l-2 border-accent/30 pl-3 -mt-1">
          <div className="h-3 w-72 bg-surface-alt rounded" />
        </div>

        {/* Chart */}
        <div className="bg-card border border-border rounded-lg p-3 sm:p-5 min-h-[340px] sm:min-h-[540px]">
          <div className="h-[280px] sm:h-[500px] bg-surface-alt/40 rounded" />
        </div>

        {/* Headlines table — matches HeadlinesTable: heading + bordered table with 4 columns */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 w-48 bg-surface-alt rounded" />
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="bg-surface-alt border-b border-border flex items-center px-4 py-3 gap-4">
              <div className="h-3 w-20 bg-surface-alt/80 rounded" />
              <div className="h-3 w-16 bg-surface-alt/80 rounded ml-auto hidden sm:block" />
              <div className="h-3 w-12 bg-surface-alt/80 rounded hidden sm:block" />
              <div className="h-3 w-12 bg-surface-alt/80 rounded" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-b-0"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-3 w-5/6 bg-surface-alt rounded" />
                  <div className="h-2 w-20 bg-surface-alt/60 rounded sm:hidden" />
                </div>
                <div className="h-3 w-28 bg-surface-alt/70 rounded hidden sm:block" />
                <div className="h-3 w-14 bg-surface-alt/70 rounded hidden sm:block" />
                <div className="h-3 w-12 bg-surface-alt rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
