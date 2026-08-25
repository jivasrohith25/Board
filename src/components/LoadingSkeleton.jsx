export function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50 px-4">
      <div className="card p-8 max-w-sm w-full space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-warm-100 rounded-2xl animate-pulse" />
        </div>
        <div className="space-y-3">
          <div className="h-5 bg-warm-100 rounded-lg w-3/4 mx-auto" />
          <div className="h-3 bg-warm-100/60 rounded w-2/3 mx-auto" />
        </div>
        <div className="space-y-2.5 pt-2">
          <div className="h-11 bg-warm-100 rounded-xl w-full" />
          <div className="h-11 bg-warm-100/70 rounded-xl w-full" />
        </div>
        <div className="h-12 bg-primary-200/50 rounded-xl w-full mt-4" />
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
            <div className="w-9 h-9 bg-warm-100 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-warm-100 rounded w-1/3" />
              <div className="h-2.5 bg-warm-100/60 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
