export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-7 w-48 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded mt-2" />
      </div>

      {/* Main card skeleton */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-4 w-24 bg-muted rounded mb-2" />
            <div className="h-8 w-36 bg-muted rounded" />
          </div>
          <div className="text-right">
            <div className="h-3 w-28 bg-muted rounded mb-2" />
            <div className="h-6 w-28 bg-muted rounded" />
          </div>
        </div>
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="h-4 w-16 bg-muted rounded mb-2" />
            <div className="h-6 w-24 bg-muted rounded" />
          </div>
        ))}
      </div>

      {/* Two column skeleton */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="h-5 w-40 bg-muted rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3].map((j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
