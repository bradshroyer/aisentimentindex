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
            How positive or negative are the world&rsquo;s top tech outlets when they write about AI? A daily score from &minus;1.0 to +1.0.
          </p>
        </div>
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-8 w-8 rounded-full bg-surface-alt" />
          <div className="h-8 w-8 rounded-full bg-surface-alt" />
        </div>
      </header>

      <div className="space-y-4 animate-pulse">
        {/* Filter bar */}
        <div className="flex items-center gap-3">
          <div className="h-3 w-14 bg-surface-alt/70 rounded" />
          <div className="h-8 w-36 bg-surface-alt rounded-lg" />
          <div className="h-8 w-56 bg-surface-alt rounded-lg ml-auto" />
        </div>

        {/* Trend strip */}
        <div className="border-l-2 border-accent/30 pl-3 -mt-1">
          <div className="h-3 w-72 bg-surface-alt rounded" />
        </div>

        {/* Chart */}
        <div className="bg-card border border-border rounded-lg p-3 sm:p-5 min-h-[340px] sm:min-h-[540px]">
          <div className="h-[280px] sm:h-[500px] bg-surface-alt/40 rounded" />
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-lg px-5 py-4 h-[88px]"
            >
              <div className="h-6 w-20 bg-surface-alt rounded mb-2" />
              <div className="h-3 w-24 bg-surface-alt/70 rounded" />
            </div>
          ))}
        </div>

        {/* Source leaderboard strip */}
        <div className="bg-card border border-border rounded-lg h-14 flex items-center px-4 gap-3">
          <div className="h-3 w-44 bg-surface-alt rounded" />
          <div className="h-3 w-64 bg-surface-alt/60 rounded" />
          <div className="ml-auto h-3 w-20 bg-surface-alt/60 rounded" />
        </div>

        {/* Headlines list */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="h-6 w-56 bg-surface-alt rounded" />
            <div className="h-4 w-20 bg-surface-alt/60 rounded" />
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-3 border-b border-border/40 last:border-b-0"
              >
                <div className="w-0.5 self-stretch bg-surface-alt rounded-full" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-3 w-5/6 bg-surface-alt rounded" />
                  <div className="h-2 w-3/5 bg-surface-alt/60 rounded" />
                  <div className="h-2 w-16 bg-surface-alt/40 rounded" />
                </div>
                <div className="h-3 w-12 bg-surface-alt rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
