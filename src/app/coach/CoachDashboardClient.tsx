'use client'

import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { CoachHeader } from './CoachHeader'

// Icons
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M6 12h12M3 9v6M6 7v10M18 7v10M21 9v6" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 23c-3.65 0-7-2.76-7-7.46 0-3.06 1.96-5.63 3.5-7.46.73-.87 1.94-.87 2.67 0 .45.53.93 1.15 1.33 1.79.2-.81.54-1.57.98-2.25.53-.83 1.62-.96 2.31-.29C18.02 9.48 19 12.03 19 15.54 19 20.24 15.65 23 12 23z" />
    </svg>
  )
}

function TrendUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

interface Profile {
  id: string
  name: string | null
  email: string | null
  role: string
  avatar_url: string | null
}

interface ActivityItem {
  id: string
  type: 'completion' | 'pr' | 'note'
  client: string
  avatar: string
  action: string
  detail: string
  time: string
  extra: string
}

interface CoachDashboardClientProps {
  profile: Profile | null
  user: User
  stats: {
    clientCount: number
    workoutsToday: number
    workoutsThisWeek: number
    prsThisWeek: number
    exerciseCount: number
    programCount: number
    unreadNotes: number
  }
  recentActivity: ActivityItem[]
}

export function CoachDashboardClient({ profile, user, stats, recentActivity }: CoachDashboardClientProps) {
  const greeting = getGreeting()
  const weekSchedule = getWeekScheduleData()
  const weekDateRange = getWeekDateRange()
  const todayFormatted = getTodayFormatted()

  // Clients needing attention (sample data - would come from real data in production)
  const clientsNeedingAttention: Array<{
    id: string
    name: string
    avatar: string
    issue: string
    severity: 'high' | 'medium'
    program: string
  }> = [
    { id: '1', name: 'Jordan Escoto', avatar: 'J', issue: 'No workout in 6 days', severity: 'high', program: 'General Fitness' },
    { id: '2', name: 'Heather Swear', avatar: 'H', issue: 'Missed 3 sessions this week', severity: 'medium', program: 'Powerlifting Prep' },
  ]

  // Top performers (placeholder)
  const topPerformers = [
    { name: 'Marcus Chen', metric: '100%', label: 'compliance', streak: 21 },
    { name: 'Alex Ramirez', metric: '95%', label: 'compliance', streak: 14 },
    { name: 'Anna Nazarian', metric: '92%', label: 'compliance', streak: 8 },
  ]

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <CoachHeader profile={profile} user={user} />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-[28px] font-bold text-slate-900 dark:text-white tracking-tight">
              {greeting}, {profile?.name?.split(' ')[0] || 'Coach'}
            </h2>
            <p className="text-[15px] text-slate-500 dark:text-slate-400 mt-1">
              {todayFormatted}
              {stats.workoutsToday > 0 && (
                <>
                  {' '}<span className="text-slate-400 dark:text-slate-500">·</span>{' '}
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {stats.workoutsToday} client{stats.workoutsToday !== 1 ? 's' : ''} training today
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/coach/exercises"
              className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold py-2.5 px-4 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-700"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <GridIcon className="w-4 h-4" />
              Library
            </Link>
            <Link
              href="/coach/programs"
              className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold py-2.5 px-4 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-700"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <CalendarIcon className="w-4 h-4" />
              Programs
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-5">
          {/* Row 1: Weekly Schedule */}
          <div
            className="bg-white dark:bg-slate-900 rounded-[20px] p-6"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">This Week</h3>
              <span className="text-sm text-slate-400">{weekDateRange}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
              {weekSchedule.map((day, i) => (
                <div
                  key={i}
                  className={`text-center py-4 px-2 rounded-2xl transition-all ${
                    day.isToday
                      ? 'text-white'
                      : day.completed === day.scheduled && day.scheduled > 0
                        ? 'bg-emerald-50 dark:bg-emerald-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                  style={day.isToday ? {
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)'
                  } : undefined}
                >
                  <div className={`text-[11px] font-semibold uppercase tracking-wide ${
                    day.isToday ? 'text-white/70' : 'text-slate-400'
                  }`}>
                    {day.day}
                  </div>
                  <div className={`text-xl font-bold my-1 ${
                    day.isToday ? 'text-white' : 'text-slate-900 dark:text-white'
                  }`}>
                    {day.date}
                  </div>
                  <div className={`text-[13px] font-semibold ${
                    day.isToday
                      ? 'text-white/80'
                      : day.completed === day.scheduled && day.scheduled > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                  }`}>
                    {day.completed}/{day.scheduled}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 2: Three equal columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Needs Attention */}
            <div
              className="rounded-[20px] p-6"
              style={{
                background: clientsNeedingAttention.length > 0
                  ? 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)'
                  : 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)'
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                {clientsNeedingAttention.length > 0 && (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' }}>
                    <AlertIcon className="w-4 h-4" />
                  </div>
                )}
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex-1">Needs Attention</h3>
                {clientsNeedingAttention.length > 0 && (
                  <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-2.5 py-1 rounded-full font-semibold">
                    {clientsNeedingAttention.length}
                  </span>
                )}
              </div>
              {clientsNeedingAttention.length > 0 ? (
                <div className="space-y-3">
                  {clientsNeedingAttention.map((client) => (
                    <div
                      key={client.id}
                      className="bg-white dark:bg-slate-800 rounded-[14px] p-4 cursor-pointer transition-transform duration-150 hover:translate-x-1"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-semibold"
                          style={{
                            background: client.severity === 'high'
                              ? 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)'
                              : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                          }}
                        >
                          {client.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{client.name}</div>
                          <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-md ${
                            client.severity === 'high'
                              ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                          }`}>
                            {client.issue}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">All clients on track!</p>
                </div>
              )}
            </div>

            {/* Top Performers */}
            <div
              className="bg-white dark:bg-slate-900 rounded-[20px] p-6"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Top Performers</h3>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-50 dark:bg-amber-500/10">
                  <TrophyIcon className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="space-y-2.5">
                {topPerformers.map((client, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold"
                      style={{
                        background: i === 0
                          ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                          : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                      }}
                    >
                      {client.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{client.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{client.metric} {client.label}</div>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500 text-sm font-semibold">
                      <FlameIcon className="w-4 h-4" />
                      <span>{client.streak}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div
              className="bg-white dark:bg-slate-900 rounded-[20px] p-6"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
                <button className="text-sm text-indigo-500 hover:text-indigo-600 font-medium">View all</button>
              </div>
              {recentActivity.length > 0 ? (
                <div className="space-y-2">
                  {recentActivity.slice(0, 4).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 p-3 -mx-3 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <ActivityIcon type={activity.type} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-900 dark:text-white">
                          <span className="font-semibold">{activity.client}</span>
                          <span className="text-slate-500 dark:text-slate-400"> {activity.action}</span>
                          <span className="font-medium"> {activity.detail}</span>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{activity.time}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No recent activity</p>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Activity appears as clients complete workouts</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  value,
  label,
  trend,
  suffix,
  showFlame,
  badge,
}: {
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  value: number
  label: string
  trend?: string
  subLabel?: string
  suffix?: string
  showFlame?: boolean
  highlight?: boolean
  badge?: string
}) {
  return (
    <div
      className="bg-white dark:bg-slate-900 rounded-[20px] p-6 transition-all duration-200 hover:-translate-y-0.5"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
          {icon}
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[28px] font-bold text-slate-900 dark:text-white tracking-tight">
              {value}
            </span>
            {suffix && <span className="text-sm text-slate-400 font-medium">{suffix}</span>}
            {trend && (
              <span className="text-xs text-emerald-500 font-semibold bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded-full ml-1">+{trend}</span>
            )}
            {showFlame && <FlameIcon className="w-4 h-4 text-amber-500 ml-1" />}
            {badge && (
              <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1 animate-pulse">
                {badge}
              </span>
            )}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {label}
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivityIcon({ type }: { type: 'completion' | 'pr' | 'note' }) {
  switch (type) {
    case 'completion':
      return (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' }}
        >
          <CheckIcon className="w-4 h-4" />
        </div>
      )
    case 'pr':
      return (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}
        >
          <TrophyIcon className="w-4 h-4" />
        </div>
      )
    case 'note':
      return (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
        >
          <MessageIcon className="w-4 h-4" />
        </div>
      )
  }
}

function getWeekScheduleData() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const startOfWeek = new Date(today)
  // Start from Sunday (dayOfWeek = 0)
  startOfWeek.setDate(today.getDate() - dayOfWeek)

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return days.map((day, index) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + index)
    const isToday = date.toDateString() === today.toDateString()
    const isPast = date < today && !isToday

    return {
      day,
      date: date.getDate(),
      scheduled: 3, // Placeholder - would come from real data
      completed: isPast ? 3 : (isToday ? 2 : 0),
      isToday,
    }
  })
}

function getWeekDateRange() {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - dayOfWeek)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getTodayFormatted(): string {
  const today = new Date()
  return today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  })
}
