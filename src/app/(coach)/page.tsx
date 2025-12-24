import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CoachDashboard() {
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

  if (!profile || profile.role !== 'coach') {
    redirect('/dashboard')
  }

  // Get stats
  const { count: clientCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'client')

  const { count: programCount } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })
    .eq('is_archived', false)

  const { count: exerciseCount } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            SWEAR STRENGTH
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 text-sm">Coach Dashboard</span>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
              {(profile.name as string).split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome back, {profile.name.split(' ')[0]}
          </h2>
          <p className="text-slate-400">Manage your clients and programs</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-purple-900/30 to-slate-900 border border-purple-800/30 rounded-2xl p-6">
            <div className="text-4xl font-bold text-white mb-1">{clientCount || 0}</div>
            <div className="text-purple-300">Active Clients</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-900/30 to-slate-900 border border-indigo-800/30 rounded-2xl p-6">
            <div className="text-4xl font-bold text-white mb-1">{programCount || 0}</div>
            <div className="text-indigo-300">Programs</div>
          </div>
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900 border border-slate-700 rounded-2xl p-6">
            <div className="text-4xl font-bold text-white mb-1">{exerciseCount || 0}</div>
            <div className="text-slate-300">Exercises</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { name: 'Invite Client', href: '/coach/clients/invite', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
            { name: 'Create Program', href: '/coach/programs/new', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
            { name: 'Exercise Library', href: '/coach/exercises', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
            { name: 'View Clients', href: '/coach/clients', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
          ].map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="bg-slate-900/50 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center gap-3 transition-all group"
            >
              <div className="w-10 h-10 bg-slate-800 group-hover:bg-purple-900/50 rounded-lg flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-slate-400 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={action.icon} />
                </svg>
              </div>
              <span className="text-slate-300 group-hover:text-white font-medium transition-colors">
                {action.name}
              </span>
            </Link>
          ))}
        </div>

        {/* Recent Activity Placeholder */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-400">No recent activity yet</p>
            <p className="text-slate-500 text-sm mt-1">Activity from your clients will appear here</p>
          </div>
        </div>
      </main>
    </div>
  )
}
