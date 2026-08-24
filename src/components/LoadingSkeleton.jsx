export function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-50">
      <div className="card p-8 max-w-md w-full space-y-4 animate-pulse">
        <div className="h-8 bg-warm-200 rounded-lg w-3/4 mx-auto" />
        <div className="h-4 bg-warm-100 rounded w-full" />
        <div className="h-4 bg-warm-100 rounded w-5/6" />
        <div className="h-12 bg-warm-200 rounded-xl w-full mt-6" />
        <div className="h-12 bg-warm-100 rounded-xl w-full" />
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
            <div className="w-8 h-8 bg-warm-200 rounded-full" />
            <div className="flex-1">
              <div className="h-4 bg-warm-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-warm-100 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}