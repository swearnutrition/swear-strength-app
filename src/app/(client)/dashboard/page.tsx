import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function ClientDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get user's active program assignment
  const { data: assignment } = await supabase
    .from('user_program_assignments')
    .select(`
      *,
      programs(name, description)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // Get workout stats
  const { count: totalWorkouts } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)

  // Get initials for avatar
  const initials = (profile.name as string)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const greeting = getGreeting()

  // Generate this week's days
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      dayNum: date.getDate(),
      isToday: date.toDateString() === today.toDateString(),
      isPast: date < today && date.toDateString() !== today.toDateString(),
      completed: false, // TODO: Check if workout completed
    }
  })

  const workoutsThisWeek = 0 // TODO: Calculate from actual data
  const totalWorkoutsInWeek = 4 // TODO: Get from program
  const weeklyProgress = totalWorkoutsInWeek > 0 ? Math.round((workoutsThisWeek / totalWorkoutsInWeek) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            SWEAR STRENGTH
          </h1>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-purple-500/20">
            {initials}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Announcement Banner (optional) */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-4 text-white shadow-lg shadow-purple-500/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎄</span>
            <div className="flex-1">
              <h3 className="font-semibold">Holiday Schedule Update</h3>
              <p className="text-sm text-white/80">Check out our holiday hours and special sessions!</p>
            </div>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* This Week Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">This Week</h2>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm rounded-full">
              {workoutsThisWeek} of {totalWorkoutsInWeek} workouts
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Week Calendar */}
            <div className="grid grid-cols-7 gap-2 mb-5">
              {weekDays.map((day, index) => (
                <div key={index} className="text-center">
                  <span className={`text-xs font-medium ${day.isToday ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                    {day.dayName}
                  </span>
                  <div
                    className={`mt-1 w-10 h-10 mx-auto rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      day.completed
                        ? 'bg-emerald-500 text-white'
                        : day.isToday
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                        : day.isPast
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {day.completed ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      day.dayNum
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Weekly Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">Weekly Progress</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{weeklyProgress}%</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${weeklyProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Quick Links</h2>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { name: 'My Workouts', icon: '💪', href: '/workouts' },
              { name: 'Weekly Check-in', icon: '📊', href: '/check-in' },
              { name: 'Book a Session', icon: '📅', href: '/book' },
              { name: 'Resources', icon: '📚', href: '/resources' },
              { name: 'My Account', icon: '👤', href: '/settings' },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
                    {item.icon}
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                </div>
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-around">
          {[
            { name: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', active: true, href: '/dashboard' },
            { name: 'History', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', active: false, href: '/history' },
            { name: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', active: false, href: '/settings' },
          ].map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center py-2 px-4 rounded-xl transition-colors ${
                item.active
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={item.active ? 2 : 1.5} d={item.icon} />
              </svg>
              <span className="text-xs mt-1 font-medium">{item.name}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Floating Chat Button */}
      <button className="fixed bottom-20 right-4 w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center text-white hover:scale-105 transition-transform">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div>
  )
}
