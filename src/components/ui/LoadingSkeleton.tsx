export function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-zinc-800 rounded-lg" />
        <div className="h-10 w-32 bg-zinc-800 rounded-lg" />
      </div>

      {/* Content skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-3">
            <div className="h-5 w-3/4 bg-zinc-800 rounded" />
            <div className="h-4 w-1/2 bg-zinc-800 rounded" />
            <div className="h-4 w-2/3 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        className="animate-spin h-8 w-8 text-purple-500"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  )
}

export function PageLoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <svg
          className="animate-spin h-10 w-10 text-purple-500 mx-auto"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-zinc-400">Loading...</p>
      </div>
    </div>
  )
}
