'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

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

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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
  avatarUrl?: string
  workoutName: string
  programName?: string
  durationMinutes?: number
  totalVolume: number
  totalSets: number
  prExercise?: string
  time: string
  timestamp: string
}

interface AttentionItem {
  id: string
  clientId: string
  name: string
  avatar: string
  issue: string
  severity: 'high' | 'medium'
  detail: string
  time: string
}

interface TopPerformer {
  userId: string
  name: string
  avatar: string
  compliance: number
  workoutsCompleted: number
  streak: number
}

interface WeekScheduleDay {
  day: string
  date: number
  scheduled: number
  completed: number
  isToday: boolean
  isPast: boolean
  scheduledClients: string[]
  completedClients: string[]
  missedClients: string[]
  unplannedClients: string[]
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
  clientsNeedingAttention: AttentionItem[]
  topPerformers: TopPerformer[]
  weekScheduleData: WeekScheduleDay[]
}

// TEST MODE: Set to true to simulate 150 clients for tooltip testing
const TEST_LARGE_SCALE = false
const MOCK_CLIENT_NAMES = [
  'Emma Johnson', 'Liam Smith', 'Olivia Brown', 'Noah Davis', 'Ava Wilson',
  'Elijah Garcia', 'Sophia Martinez', 'James Anderson', 'Isabella Thomas', 'Benjamin Taylor',
  'Mia Moore', 'Lucas Jackson', 'Charlotte White', 'Mason Harris', 'Amelia Martin',
  'Ethan Thompson', 'Harper Robinson', 'Alexander Clark', 'Evelyn Lewis', 'Henry Walker',
  'Luna Hall', 'Sebastian Allen', 'Gianna Young', 'Jack King', 'Aria Wright',
  'Owen Scott', 'Chloe Green', 'Daniel Baker', 'Penelope Adams', 'Matthew Nelson',
  'Layla Hill', 'Aiden Ramirez', 'Riley Campbell', 'Logan Mitchell', 'Zoey Roberts',
  'Jackson Carter', 'Nora Phillips', 'Levi Evans', 'Lily Turner', 'Samuel Torres',
  'Eleanor Parker', 'David Collins', 'Hazel Edwards', 'Joseph Stewart', 'Violet Sanchez',
  'Wyatt Morris', 'Stella Rogers', 'John Reed', 'Zoe Cook', 'Michael Morgan',
]

function generateMockClients(count: number): string[] {
  const clients: string[] = []
  for (let i = 0; i < count; i++) {
    const baseName = MOCK_CLIENT_NAMES[i % MOCK_CLIENT_NAMES.length]
    if (i < MOCK_CLIENT_NAMES.length) {
      clients.push(baseName)
    } else {
      clients.push(`${baseName} ${Math.floor(i / MOCK_CLIENT_NAMES.length) + 1}`)
    }
  }
  return clients
}

export function CoachDashboardClient({ profile, user, stats, recentActivity, clientsNeedingAttention: initialAttentionItems, topPerformers, weekScheduleData: originalWeekScheduleData }: CoachDashboardClientProps) {
  // Apply test data if TEST_LARGE_SCALE is enabled
  const weekScheduleData = TEST_LARGE_SCALE
    ? originalWeekScheduleData.map((day, i) => {
        // Only apply mock data to Mon (i=1) and Wed (i=3), preserve real data for other days
        const hasMockSchedule = i === 1 || i === 3
        if (!hasMockSchedule) {
          // Keep real data, just add mock unplanned for testing today
          const isPastOrToday = day.isPast || day.isToday
          return {
            ...day,
            // Add mock unplanned only if there's real activity or it's today
            unplannedClients: isPastOrToday && day.unplannedClients.length === 0
              ? ['Bonus Client 1', 'Bonus Client 2', 'Extra Workout Andy', 'Spontaneous Sarah', 'Wildcard Will']
              : day.unplannedClients,
          }
        }
        // For mock days (Mon/Wed), use generated clients
        const mockClients = i === 1 ? generateMockClients(150) : generateMockClients(85)
        const isPastOrToday = day.isPast || day.isToday
        const completedCount = isPastOrToday ? Math.floor(mockClients.length * 0.7) : 0
        const unplannedMock = isPastOrToday ? ['Bonus Client 1', 'Bonus Client 2', 'Extra Workout Andy', 'Spontaneous Sarah', 'Wildcard Will'] : []
        return {
          ...day,
          scheduled: mockClients.length,
          scheduledClients: mockClients,
          completedClients: isPastOrToday ? mockClients.slice(0, completedCount) : day.completedClients,
          missedClients: day.isPast ? mockClients.slice(completedCount) : day.missedClients,
          unplannedClients: unplannedMock,
        }
      })
    : originalWeekScheduleData

  const [attentionItems, setAttentionItems] = useState(initialAttentionItems)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const supabase = createClient()
  const greeting = getGreeting()
  const weekDateRange = getWeekDateRange()
  const todayFormatted = getTodayFormatted()

  const dismissNotification = async (notificationId: string) => {
    // Mark as read in database
    await supabase
      .from('coach_notifications')
      .update({ read: true })
      .eq('id', notificationId)

    // Remove from local state
    setAttentionItems(prev => prev.filter(item => item.id !== notificationId))
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <Link
              href="/coach/habits"
              className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold py-2.5 px-4 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-slate-700"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
            >
              <CheckCircleIcon className="w-4 h-4" />
              Habits
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
              {weekScheduleData.map((day, i) => (
                <div
                  key={i}
                  className={`relative text-center py-4 px-2 rounded-2xl transition-all cursor-pointer ${
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
                  onMouseEnter={() => setHoveredDay(i)}
                  onMouseLeave={() => setHoveredDay(null)}
                >
                  {/* Hover Tooltip - drops DOWN below the cell */}
                  {hoveredDay === i && (day.scheduledClients.length > 0 || day.unplannedClients.length > 0 || day.completedClients.length > 0) && (
                    <div
                      className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-56 p-3 rounded-xl bg-slate-900 dark:bg-slate-800 shadow-xl"
                      style={{ boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
                    >
                      {/* Arrow pointing up */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-slate-900 dark:border-b-slate-800" />

                      {/* For past days or today with activity, show completed/missed/unplanned sections */}
                      {(day.isPast || day.isToday) && (day.completedClients.length > 0 || day.missedClients.length > 0 || day.unplannedClients.length > 0) ? (
                        <div className="space-y-3">
                          {/* Completed Section (scheduled clients who completed) */}
                          {day.completedClients.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-2">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Completed ({day.completedClients.length})
                              </div>
                              <div className="space-y-2.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                                {day.completedClients.map((name, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold"
                                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)' }}
                                    >
                                      {name[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-xs text-white font-medium truncate flex-1">{name}</span>
                                    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unplanned Section (bonus workouts - amber/gold) */}
                          {day.unplannedClients.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-2">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Bonus ({day.unplannedClients.length})
                              </div>
                              <div className="space-y-2.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                                {day.unplannedClients.map((name, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold"
                                      style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}
                                    >
                                      {name[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-xs text-white font-medium truncate flex-1">{name}</span>
                                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Missed Section (only for past days) */}
                          {day.isPast && day.missedClients.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-2">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Missed ({day.missedClients.length})
                              </div>
                              <div className="space-y-2.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                                {day.missedClients.map((name, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <div
                                      className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold"
                                      style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' }}
                                    >
                                      {name[0]?.toUpperCase()}
                                    </div>
                                    <span className="text-xs text-white font-medium truncate flex-1">{name}</span>
                                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* For future days (or today with no activity yet), show scheduled list */
                        <>
                          <div className="text-xs font-semibold text-slate-400 mb-2">Scheduled ({day.scheduled})</div>
                          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {day.scheduledClients.map((name, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-semibold"
                                  style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                                >
                                  {name[0]?.toUpperCase()}
                                </div>
                                <span className="text-xs text-white font-medium truncate">{name}</span>
                              </div>
                            ))}
                          </div>
                          {day.scheduledClients.length > 6 && (
                            <div className="text-[10px] text-slate-500 mt-2 text-center">Scroll for more</div>
                          )}
                        </>
                      )}
                    </div>
                  )}
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
            {/* Needs Attention - with glowing red effect when items present */}
            <div
              className={`rounded-[20px] p-6 relative overflow-hidden ${attentionItems.length > 0 ? 'needs-attention-glow' : 'bg-white dark:bg-slate-900'}`}
              style={attentionItems.length > 0 ? {
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.03) 100%)',
                boxShadow: '0 0 30px rgba(239, 68, 68, 0.2), 0 0 60px rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              } : {
                boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)',
              }}
            >
              {attentionItems.length > 0 && (
                <style>{`
                  @keyframes attention-glow {
                    0%, 100% { box-shadow: 0 0 30px rgba(239, 68, 68, 0.2), 0 0 60px rgba(239, 68, 68, 0.1); }
                    50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.35), 0 0 80px rgba(239, 68, 68, 0.15); }
                  }
                  .needs-attention-glow {
                    animation: attention-glow 3s ease-in-out infinite;
                  }
                `}</style>
              )}
              <div className="flex items-center gap-3 mb-5">
                {attentionItems.length > 0 && (
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)' }}>
                    <AlertIcon className="w-4 h-4" />
                  </div>
                )}
                <h3 className={`text-base font-semibold flex-1 ${attentionItems.length > 0 ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-white'}`}>Needs Attention</h3>
                {attentionItems.length > 0 && (
                  <span className="text-xs bg-red-500 text-white px-2.5 py-1 rounded-full font-bold animate-pulse">
                    {attentionItems.length}
                  </span>
                )}
              </div>
              {attentionItems.length > 0 ? (
                <div className="space-y-3">
                  {attentionItems.map((client) => (
                    <div
                      key={client.id}
                      className="rounded-[14px] p-4 transition-all duration-150"
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                      }}
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
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-white">{client.name}</div>
                            <span className="text-xs text-red-300/70">{client.time}</span>
                          </div>
                          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-md ${
                            client.severity === 'high'
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {client.issue}
                          </span>
                        </div>
                        <button
                          onClick={() => dismissNotification(client.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Dismiss"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
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
              {topPerformers.length > 0 ? (
                <div className="space-y-2.5">
                  {topPerformers.map((client, i) => (
                    <div
                      key={client.userId}
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
                        {client.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{client.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {client.compliance}% compliance · {client.workoutsCompleted} workouts
                        </div>
                      </div>
                      {client.streak > 0 && (
                        <div className="flex items-center gap-1 text-amber-500 text-sm font-semibold">
                          <FlameIcon className="w-4 h-4" />
                          <span>{client.streak}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                    <TrophyIcon className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No activity yet this week</p>
                </div>
              )}
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
                <div className="space-y-3">
                  {recentActivity.slice(0, 5).map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 -mx-3 rounded-xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      {/* Client Avatar */}
                      {activity.avatarUrl ? (
                        <img
                          src={activity.avatarUrl}
                          alt={activity.client}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm">
                          {activity.avatar}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-900 dark:text-white">
                          <span className="font-semibold">{activity.client}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}has completed a {activity.durationMinutes || '~'}min{' '}
                          </span>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">{activity.workoutName}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {' '}workout{activity.totalVolume > 0 && ` and lifted ${activity.totalVolume.toLocaleString()} lbs over ${activity.totalSets} sets`}
                          </span>
                        </div>
                        {activity.prExercise && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-500">
                            <TrophyIcon className="w-3.5 h-3.5" />
                            <span className="font-medium">{activity.prExercise}</span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 whitespace-nowrap mt-0.5">{activity.time}</span>
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
