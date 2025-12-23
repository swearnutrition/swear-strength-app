export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="text-white font-bold text-xl">SWEAR STRENGTH</div>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold">
          ZZ
        </div>
      </header>

      {/* Main Content */}
      <main className="px-6 py-4">
        {/* Greeting */}
        <div className="mb-6">
          <p className="text-purple-300 text-sm">Good morning</p>
          <h1 className="text-white text-2xl font-bold">Welcome back!</h1>
        </div>

        {/* Today's Progress Card */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-3xl p-6 mb-6 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-purple-200 text-sm">Today&apos;s Progress</p>
                <p className="text-white text-3xl font-bold">3 of 4</p>
                <p className="text-purple-200 text-sm">habits complete</p>
              </div>
              {/* Progress Ring */}
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.2)" strokeWidth="8" fill="none" />
                  <circle cx="40" cy="40" r="36" stroke="white" strokeWidth="8" fill="none"
                    strokeDasharray={`${2 * Math.PI * 36 * 0.75} ${2 * Math.PI * 36}`}
                    strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-bold">75%</span>
                </div>
              </div>
            </div>

            {/* Streak Badge */}
            <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-3 py-1">
              <span>🔥</span>
              <span className="text-white text-sm font-medium">12 day streak</span>
            </div>
          </div>
        </div>

        {/* Habits Section */}
        <div className="mb-6">
          <h2 className="text-white text-lg font-semibold mb-4">Daily Habits</h2>

          {/* Habit Items */}
          <div className="space-y-3">
            {/* Water - Complete */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                <span className="text-white text-xl">✓</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Water</p>
                <p className="text-emerald-300 text-sm">8 glasses</p>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <span>🔥</span>
                <span className="text-sm">14</span>
              </div>
            </div>

            {/* Sleep - Complete */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                <span className="text-white text-xl">✓</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Sleep</p>
                <p className="text-emerald-300 text-sm">8 hours</p>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <span>🔥</span>
                <span className="text-sm">7</span>
              </div>
            </div>

            {/* Protein - Complete */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                <span className="text-white text-xl">✓</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Protein</p>
                <p className="text-emerald-300 text-sm">150g</p>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <span>🔥</span>
                <span className="text-sm">12</span>
              </div>
            </div>

            {/* Creatine - Incomplete */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center">
                <span className="text-2xl">💊</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Creatine</p>
                <p className="text-slate-400 text-sm">5g daily</p>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-slate-600"></div>
            </div>
          </div>
        </div>

        {/* Today's Workout Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-slate-400 text-sm">Today&apos;s Workout</p>
              <p className="text-white text-lg font-semibold">Upper Body Push</p>
            </div>
            <div className="text-right">
              <p className="text-purple-400 text-sm">Week 4</p>
              <p className="text-slate-400 text-xs">Day 2 of 4</p>
            </div>
          </div>
          <button className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:from-purple-500 hover:to-indigo-500 transition-all">
            Start Workout
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-6 py-3">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center gap-1 text-purple-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span className="text-xs">Workouts</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span className="text-xs">Lifestyle</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-slate-500 relative">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-xs">Messages</span>
            {/* Notification dot */}
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
          </button>
        </div>
      </nav>
    </div>
  );
}
