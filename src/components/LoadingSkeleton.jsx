export function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4">
      <div className="card p-8 max-w-sm w-full space-y-5 animate-pulse">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-bg-secondary rounded-2xl border border-ui-border" />
        </div>
        <div className="space-y-3">
          <div className="h-5 bg-bg-secondary rounded-lg w-3/4 mx-auto" />
          <div className="h-3 bg-bg-secondary/70 rounded w-2/3 mx-auto" />
        </div>
        <div className="space-y-2.5 pt-2">
          <div className="h-11 bg-bg-secondary rounded-xl w-full" />
          <div className="h-11 bg-bg-secondary/80 rounded-xl w-full" />
        </div>
        <div className="h-12 bg-accent-primary/20 rounded-xl w-full mt-4" />
      </div>
    </div>
  )
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-bg-secondary rounded-full border border-ui-border" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-bg-secondary rounded w-1/3" />
              <div className="h-2.5 bg-bg-secondary/70 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
