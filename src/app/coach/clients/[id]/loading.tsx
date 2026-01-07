export default function ClientDetailLoading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Header with avatar */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-zinc-800 rounded-full" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-zinc-800 rounded" />
          <div className="h-4 w-32 bg-zinc-800 rounded" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-zinc-900 rounded-xl p-4 space-y-2">
            <div className="h-4 w-16 bg-zinc-800 rounded" />
            <div className="h-8 w-12 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>

      {/* Content area */}
      <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
        <div className="h-5 w-32 bg-zinc-800 rounded" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-full bg-zinc-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
