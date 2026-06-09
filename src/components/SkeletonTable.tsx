export function SkeletonTable({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
      <div className="bg-muted/50 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-muted rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-t border-border px-4 py-3 flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className={`h-3 bg-muted/60 rounded ${j === 0 ? "flex-[2]" : "flex-1"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpis({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4 animate-pulse`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-3">
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-6 w-6 bg-muted rounded" />
          </div>
          <div className="h-7 w-32 bg-muted rounded" />
          <div className="h-3 w-20 bg-muted/60 rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-muted rounded" />
      <div className="h-3 w-full bg-muted/60 rounded" />
      <div className="h-3 w-3/4 bg-muted/60 rounded" />
    </div>
  );
}
