'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  name: string
  email: string
  avatar_url: string | null
  created_at: string
  last_login: string | null
}

interface Program {
  id: string
  name: string
  currentWeek: number
  startedAt: string
}

interface Stats {
  daysSinceWorkout: number | null
  weekStreak: number
  thisWeekWorkouts: number
  targetWorkouts: number
  thisWeekVolume: number
  volumeChange: number
  fourWeekConsistency: number
  fourWeekWorkouts: number
}

interface WeeklyVolume {
  week: string
  volume: number
}

interface WorkoutLog {
  id: string
  date: string
  dayName: string
  completed: boolean
  difficulty: number | null
  feeling: string | null
  notes: string | null
  setCount: number
  totalVolume: number
  section: string | null
}

interface PersonalRecord {
  id: string
  exerciseName: string
  muscle: string | null
  recordType: string
  value: number
  reps: number | null
  weight: number | null
  unit: string
  achievedAt: string
}

interface HabitStat {
  id: string
  name: string
  category: string
  streak: number
  completionRate: number
  completions: string[]
  startDate: string
}

interface Rivalry {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  winnerId: string | null
  clientScore: number
  rivalScore: number
  rival: {
    id: string
    name: string
    avatar_url: string | null
  }
  isWinner: boolean
  isTied: boolean
}

interface CoachProgram {
  id: string
  name: string
}

interface HabitTemplate {
  id: string
  name: string
  category: string
}

interface ClientDetailClientProps {
  client: Client
  program: Program | null
  stats: Stats
  weeklyVolume: WeeklyVolume[]
  volumeByMuscle: Record<string, number>
  workoutLogs: WorkoutLog[]
  personalRecords: PersonalRecord[]
  habitStats: HabitStat[]
  rivalries: Rivalry[]
  coachPrograms: CoachProgram[]
  habitTemplates: HabitTemplate[]
  currentUserId: string
}

const categoryColors: Record<string, string> = {
  nutrition: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400',
  fitness: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  sleep: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  mindset: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  lifestyle: 'bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
  tracking: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
}

const muscleColors: Record<string, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f59e0b',
  legs: '#22c55e',
  arms: '#8b5cf6',
  core: '#ec4899',
  other: '#6b7280',
}

// Circular progress component
function CircularProgress({
  value,
  max,
  size = 48,
  strokeWidth = 4,
  color = '#a855f7'
}: {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = Math.min(value / max, 1)
  const offset = circumference - progress * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-200 dark:text-slate-700"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  )
}

export function ClientDetailClient({
  client,
  program,
  stats,
  weeklyVolume,
  volumeByMuscle,
  workoutLogs,
  personalRecords,
  habitStats,
  rivalries,
  coachPrograms,
  habitTemplates,
  currentUserId,
}: ClientDetailClientProps) {
  const [volumeTimeframe, setVolumeTimeframe] = useState<'weekly' | 'monthly'>('weekly')
  const [muscleTimeframe, setMuscleTimeframe] = useState<'week' | 'month' | 'year'>('week')
  const [showAssignProgram, setShowAssignProgram] = useState(false)
  const [showAssignHabit, setShowAssignHabit] = useState(false)
  const [assigningHabit, setAssigningHabit] = useState(false)
  const [assigningProgram, setAssigningProgram] = useState(false)
  const [selectedHabitId, setSelectedHabitId] = useState<string>('')
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [programStartDate, setProgramStartDate] = useState(new Date().toISOString().split('T')[0])

  const activeRivalries = rivalries.filter(r => r.status === 'active' || r.status === 'pending')
  const completedRivalries = rivalries.filter(r => r.status === 'completed' || r.status === 'cancelled')

  // Determine what assignments this client has
  const hasWorkouts = !!program
  const hasHabits = habitStats.length > 0

  // Find max volume for chart scaling
  const maxVolume = Math.max(...weeklyVolume.map(w => w.volume), 1)

  // Group muscles for display
  const normalizedVolume: Record<string, number> = {}
  for (const [muscle, vol] of Object.entries(volumeByMuscle)) {
    const normalized = muscle.toLowerCase().replace(/_/g, ' ')
    let group = 'other'
    if (['chest', 'pecs'].some(m => normalized.includes(m))) group = 'chest'
    else if (['back', 'lats', 'traps', 'rhomboids'].some(m => normalized.includes(m))) group = 'back'
    else if (['shoulder', 'delt'].some(m => normalized.includes(m))) group = 'shoulders'
    else if (['quad', 'hamstring', 'glute', 'calf', 'leg'].some(m => normalized.includes(m))) group = 'legs'
    else if (['bicep', 'tricep', 'forearm', 'arm'].some(m => normalized.includes(m))) group = 'arms'
    else if (['core', 'ab', 'oblique'].some(m => normalized.includes(m))) group = 'core'

    normalizedVolume[group] = (normalizedVolume[group] || 0) + vol
  }

  const handleAssignHabit = async () => {
    if (!selectedHabitId) return
    setAssigningHabit(true)
    try {
      const res = await fetch('/api/habits/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client.id,
          habitTemplateId: selectedHabitId,
        }),
      })
      if (!res.ok) throw new Error('Failed to assign habit')
      setShowAssignHabit(false)
      setSelectedHabitId('')
      window.location.reload()
    } catch {
      alert('Failed to assign habit')
    } finally {
      setAssigningHabit(false)
    }
  }

  const handleAssignProgram = async () => {
    if (!selectedProgramId) return
    setAssigningProgram(true)
    try {
      const supabase = createClient()

      // Mark any existing active assignments as completed
      await supabase
        .from('user_program_assignments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('user_id', client.id)
        .eq('status', 'active')

      // Create new assignment
      const { error } = await supabase
        .from('user_program_assignments')
        .insert({
          user_id: client.id,
          program_id: selectedProgramId,
          started_at: programStartDate,
          current_week: 1,
          current_day: 1,
          status: 'active',
        })

      if (error) throw error

      setShowAssignProgram(false)
      setSelectedProgramId('')
      window.location.reload()
    } catch {
      alert('Failed to assign program')
    } finally {
      setAssigningProgram(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Link
            href="/coach/clients"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors mt-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <div className="flex items-center gap-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl font-bold text-white overflow-hidden">
              {client.avatar_url ? (
                <img src={client.avatar_url} alt={client.name} className="w-full h-full object-cover" />
              ) : (
                client.name[0]?.toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{client.name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{client.email}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAssignProgram(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Assign Program
            </button>
            <button
              onClick={() => setShowAssignHabit(true)}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-lg transition-colors"
            >
              Assign Habit
            </button>
          </div>
        </div>

        {/* Current Program Banner */}
        {program && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-200 text-sm">Current Program</p>
                <p className="font-semibold text-lg">{program.name}</p>
              </div>
              <div className="text-right">
                <p className="text-purple-200 text-sm">Week</p>
                <p className="font-semibold text-2xl">{program.currentWeek}</p>
              </div>
            </div>
          </div>
        )}

        {/* Top Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Days Since Workout */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Days Since Workout</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.daysSinceWorkout !== null ? stats.daysSinceWorkout : '-'}
                </p>
              </div>
              <div className="relative">
                <CircularProgress
                  value={stats.daysSinceWorkout !== null ? Math.max(0, 7 - stats.daysSinceWorkout) : 0}
                  max={7}
                  color={stats.daysSinceWorkout !== null && stats.daysSinceWorkout <= 2 ? '#22c55e' : stats.daysSinceWorkout !== null && stats.daysSinceWorkout <= 4 ? '#f59e0b' : '#ef4444'}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-slate-500">
                    {stats.daysSinceWorkout !== null && stats.daysSinceWorkout <= 2 ? '✓' : '!'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Week Streak */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Week Streak</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.weekStreak}</p>
              </div>
              <div className="relative">
                <CircularProgress value={stats.weekStreak} max={12} color="#f59e0b" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg">🔥</span>
                </div>
              </div>
            </div>
          </div>

          {/* This Week */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">This Week</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.thisWeekWorkouts}<span className="text-lg text-slate-400">/{stats.targetWorkouts}</span>
                </p>
              </div>
              <div className="relative">
                <CircularProgress value={stats.thisWeekWorkouts} max={stats.targetWorkouts} color="#a855f7" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    {Math.round((stats.thisWeekWorkouts / stats.targetWorkouts) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Week Volume */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Week Volume</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {stats.thisWeekVolume >= 1000 ? `${(stats.thisWeekVolume / 1000).toFixed(1)}k` : stats.thisWeekVolume}
                  </p>
                  {stats.volumeChange !== 0 && (
                    <span className={`text-sm font-medium ${stats.volumeChange > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {stats.volumeChange > 0 ? '+' : ''}{stats.volumeChange}%
                    </span>
                  )}
                </div>
              </div>
              <div className="relative">
                <CircularProgress value={Math.abs(stats.volumeChange)} max={50} color={stats.volumeChange >= 0 ? '#22c55e' : '#ef4444'} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg">{stats.volumeChange >= 0 ? '📈' : '📉'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Week at a Glance */}
        <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">Week at a Glance</h2>
            <div className="flex items-center gap-3 text-sm">
              {hasHabits && (
                <span className={`font-bold ${
                  (() => {
                    const avgRate = Math.round(habitStats.reduce((sum, h) => sum + h.completionRate, 0) / habitStats.length)
                    return avgRate >= 70 ? 'text-emerald-500' : avgRate >= 40 ? 'text-amber-500' : 'text-red-500'
                  })()
                }`}>
                  {Math.round(habitStats.reduce((sum, h) => sum + h.completionRate, 0) / habitStats.length)}%
                </span>
              )}
              {(() => {
                const maxStreak = Math.max(...habitStats.map(h => h.streak), 0)
                return maxStreak > 0 ? (
                  <span className="text-amber-500 font-medium">🔥 {maxStreak}d</span>
                ) : null
              })()}
            </div>
          </div>

            {/* Table layout */}
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: '500px' }}>
                <thead>
                  <tr>
                    <th className="text-left pb-2 pr-3" style={{ width: '140px' }}></th>
                    {Array.from({ length: 7 }).map((_, i) => {
                      const date = new Date()
                      date.setDate(date.getDate() - (6 - i))
                      const isToday = i === 6
                      return (
                        <th key={i} className="pb-2 text-center" style={{ width: '52px' }}>
                          <div className={`text-[10px] uppercase tracking-wide ${isToday ? 'text-purple-500 font-bold' : 'text-slate-400'}`}>
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className={`text-sm font-semibold ${isToday ? 'text-purple-500' : 'text-slate-500 dark:text-slate-400'}`}>
                            {date.getDate()}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Workouts row - only if has program */}
                  {hasWorkouts && (
                    <tr>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0 bg-purple-500" />
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">Workouts</span>
                        </div>
                      </td>
                      {Array.from({ length: 7 }).map((_, i) => {
                        const date = new Date()
                        date.setDate(date.getDate() - (6 - i))
                        const dateStr = date.toISOString().split('T')[0]
                        const isToday = i === 6
                        const dayWorkouts = workoutLogs.filter(log => {
                          const logDate = new Date(log.date).toISOString().split('T')[0]
                          return logDate === dateStr
                        })
                        const hasWorkoutDay = dayWorkouts.length > 0
                        return (
                          <td key={i} className="py-1.5 text-center">
                            <div
                              className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center ${
                                hasWorkoutDay
                                  ? 'bg-purple-500'
                                  : isToday
                                    ? 'bg-slate-200 dark:bg-slate-700 ring-2 ring-purple-400'
                                    : 'bg-slate-200 dark:bg-slate-700'
                              }`}
                            >
                              {hasWorkoutDay && (
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )}

                  {/* Habit rows */}
                  {habitStats.map((habit) => {
                    const habitStartDate = new Date(habit.startDate)
                    habitStartDate.setHours(0, 0, 0, 0)

                    return (
                      <tr key={habit.id}>
                        <td className="py-1.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-500" />
                            <span className="text-sm text-slate-700 dark:text-slate-300 truncate" title={habit.name}>
                              {habit.name}
                            </span>
                          </div>
                        </td>
                        {Array.from({ length: 7 }).map((_, i) => {
                          const date = new Date()
                          date.setDate(date.getDate() - (6 - i))
                          date.setHours(0, 0, 0, 0)
                          const dateStr = date.toISOString().split('T')[0]
                          const completed = habit.completions.includes(dateStr)
                          const isToday = i === 6
                          const isBeforeAssignment = date < habitStartDate

                          return (
                            <td key={i} className="py-1.5 text-center">
                              <div
                                className={`w-9 h-9 mx-auto rounded-lg flex items-center justify-center ${
                                  isBeforeAssignment
                                    ? 'bg-slate-100 dark:bg-slate-800/50'
                                    : completed
                                      ? 'bg-emerald-500'
                                      : isToday
                                        ? 'bg-slate-200 dark:bg-slate-700 ring-2 ring-purple-400'
                                        : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                              >
                                {completed && (
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Consistency */}
            <div className="space-y-6">
              {/* Consistency Ring */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <h2 className="font-semibold text-slate-900 dark:text-white mb-4">4-Week Consistency</h2>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative">
                    <CircularProgress
                      value={stats.fourWeekConsistency}
                      max={100}
                      size={120}
                      strokeWidth={8}
                      color={stats.fourWeekConsistency >= 75 ? '#22c55e' : stats.fourWeekConsistency >= 50 ? '#f59e0b' : '#ef4444'}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {stats.fourWeekConsistency}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.fourWeekWorkouts}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Workouts</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.targetWorkouts * 4}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Target</p>
                  </div>
                </div>
              </div>

              {/* Volume by Muscle Group */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Volume by Muscle</h2>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    {(['week', 'month', 'year'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setMuscleTimeframe(t)}
                        className={`px-2 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                          muscleTimeframe === t
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {Object.keys(normalizedVolume).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(normalizedVolume)
                      .sort((a, b) => b[1] - a[1])
                      .map(([muscle, vol]) => {
                        const maxVol = Math.max(...Object.values(normalizedVolume), 1)
                        return (
                          <div key={muscle}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="capitalize text-slate-700 dark:text-slate-300">{muscle}</span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : Math.round(vol)} lbs
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${(vol / maxVol) * 100}%`,
                                  backgroundColor: muscleColors[muscle] || muscleColors.other,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-400 dark:text-slate-500">
                      {!program ? 'No program assigned' : 'No workout data'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Middle Column - Volume Chart */}
            <div className="space-y-6">
              {/* Volume Over Time */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Volume Over Time</h2>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                    {(['weekly', 'monthly'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setVolumeTimeframe(t)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                          volumeTimeframe === t
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="h-48 flex items-end gap-2">
                  {weeklyVolume.map((week, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-purple-500 rounded-t-md transition-all duration-300 hover:bg-purple-400"
                        style={{ height: `${(week.volume / maxVolume) * 160}px` }}
                        title={`${week.volume.toLocaleString()} lbs`}
                      />
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate w-full text-center">
                        {week.week}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column - Workouts & PRs */}
            <div className="space-y-6">
              {/* Recent Workouts */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Workouts</h2>
                {workoutLogs.length > 0 ? (
                  <div className="space-y-2">
                    {workoutLogs.slice(0, 8).map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="w-12 text-center">
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {new Date(log.date).toLocaleDateString('en-US', { month: 'short' })}
                          </p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white">
                            {new Date(log.date).getDate()}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{log.dayName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {log.setCount} sets • {log.totalVolume >= 1000 ? `${(log.totalVolume / 1000).toFixed(1)}k` : log.totalVolume} lbs
                          </p>
                        </div>
                        {!log.completed && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs rounded font-medium">
                            In Progress
                          </span>
                        )}
                        {log.section && log.completed && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs rounded font-medium">
                            {log.section}
                          </span>
                        )}
                        {log.notes && (
                          <button
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            title={log.notes}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-slate-400 dark:text-slate-500">
                      {!program ? 'No program assigned' : 'No workouts logged'}
                    </p>
                  </div>
                )}
              </div>

              {/* Personal Records */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
                <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Personal Records</h2>
                {personalRecords.length > 0 ? (
                  <div className="space-y-2">
                    {personalRecords.slice(0, 6).map(pr => (
                      <div key={pr.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                          <span className="text-sm">🏆</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{pr.exerciseName}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(pr.achievedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                          {pr.recordType === 'max_weight' ? (
                            <>{pr.value} {pr.unit}</>
                          ) : pr.recordType === 'max_reps' ? (
                            <>{pr.value} reps</>
                          ) : (
                            <>{pr.weight} {pr.unit} × {pr.reps}</>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-slate-400 dark:text-slate-500">
                    {!program ? 'No program assigned' : 'No personal records yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rivalries Section */}
        {rivalries.length > 0 && (
          <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Rivalries</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rivalries.slice(0, 4).map(rivalry => {
                const isActive = rivalry.status === 'active' || rivalry.status === 'pending'
                const daysLeft = Math.ceil(
                  (new Date(rivalry.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                )
                const totalDays = Math.ceil(
                  (new Date(rivalry.endDate).getTime() - new Date(rivalry.startDate).getTime()) / (1000 * 60 * 60 * 24)
                )
                const daysElapsed = totalDays - Math.max(0, daysLeft)
                const progress = Math.min(100, (daysElapsed / totalDays) * 100)
                const clientWinning = rivalry.clientScore > rivalry.rivalScore
                const rivalWinning = rivalry.rivalScore > rivalry.clientScore
                const isTied = rivalry.clientScore === rivalry.rivalScore

                return (
                  <Link
                    key={rivalry.id}
                    href={`/coach/habits/rivalries/${rivalry.id}`}
                    className="block p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-[1.01]"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">{rivalry.name}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        isActive
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : rivalry.isWinner
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {isActive ? 'Active' : rivalry.isWinner ? 'Won' : rivalry.isTied ? 'Tied' : 'Completed'}
                      </span>
                    </div>

                    {/* Players & Score */}
                    <div className="flex items-center justify-between mb-4">
                      {/* Client */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white mb-1.5 overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #8b5cf699 100%)',
                            boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                          }}
                        >
                          {client.avatar_url ? (
                            <img src={client.avatar_url} alt={client.name} className="w-full h-full object-cover" />
                          ) : (
                            client.name[0]?.toUpperCase()
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[70px]">
                          {client.name.split(' ')[0]}
                        </p>
                        {rivalry.status === 'completed' && rivalry.isWinner && (
                          <span className="text-[10px] text-amber-500 font-medium mt-0.5">🏆</span>
                        )}
                      </div>

                      {/* Score */}
                      <div className="flex flex-col items-center px-4">
                        <div className="text-2xl font-black tracking-tight">
                          <span className={clientWinning ? 'text-emerald-500' : isTied ? 'text-slate-700 dark:text-white' : 'text-slate-400'}>
                            {rivalry.clientScore}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 mx-1.5">-</span>
                          <span className={rivalWinning ? 'text-emerald-500' : isTied ? 'text-slate-700 dark:text-white' : 'text-slate-400'}>
                            {rivalry.rivalScore}
                          </span>
                        </div>
                        <div className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          VS
                        </div>
                      </div>

                      {/* Rival */}
                      <div className="flex flex-col items-center">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white mb-1.5 overflow-hidden"
                          style={{
                            background: 'linear-gradient(135deg, #f59e0b 0%, #f59e0b99 100%)',
                            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          {rivalry.rival.avatar_url ? (
                            <img src={rivalry.rival.avatar_url} alt={rivalry.rival.name} className="w-full h-full object-cover" />
                          ) : (
                            rivalry.rival.name[0]?.toUpperCase()
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[70px]">
                          {rivalry.rival.name.split(' ')[0]}
                        </p>
                        {rivalry.status === 'completed' && !rivalry.isWinner && !rivalry.isTied && (
                          <span className="text-[10px] text-amber-500 font-medium mt-0.5">🏆</span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {isActive && (
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                          <span>{new Date(rivalry.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <span>{daysLeft > 0 ? `${daysLeft}d left` : 'Ending'}</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-amber-500 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Completed status */}
                    {!isActive && (
                      <div className="text-center text-xs text-slate-400 dark:text-slate-500">
                        {rivalry.isWinner ? (
                          <span className="text-emerald-500 font-medium">Victory!</span>
                        ) : rivalry.isTied ? (
                          <span>Draw - Ended {new Date(rivalry.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        ) : (
                          <span>Ended {new Date(rivalry.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        )}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Assign Program Modal */}
      {showAssignProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Assign Program</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Select a program to assign to {client.name}
            </p>

            {coachPrograms.length > 0 ? (
              <>
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white mb-4"
                >
                  <option value="">Select a program...</option>
                  {coachPrograms.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={programStartDate}
                    onChange={(e) => setProgramStartDate(e.target.value)}
                    className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                {program && (
                  <p className="text-amber-600 dark:text-amber-400 text-sm mb-4">
                    Note: This will replace their current program ({program.name})
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAssignProgram(false)
                      setSelectedProgramId('')
                    }}
                    className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignProgram}
                    disabled={!selectedProgramId || assigningProgram}
                    className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigningProgram ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 dark:text-slate-400 mb-4">No programs available</p>
                <Link
                  href="/coach/programs"
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Create a program first
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assign Habit Modal */}
      {showAssignHabit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Assign Habit</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Select a habit to assign to {client.name}
            </p>

            {habitTemplates.length > 0 ? (
              <>
                <select
                  value={selectedHabitId}
                  onChange={(e) => setSelectedHabitId(e.target.value)}
                  className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white mb-4"
                >
                  <option value="">Select a habit...</option>
                  {habitTemplates.map(habit => (
                    <option key={habit.id} value={habit.id}>
                      {habit.name} ({habit.category})
                    </option>
                  ))}
                </select>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAssignHabit(false)
                      setSelectedHabitId('')
                    }}
                    className="flex-1 py-2 px-4 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignHabit}
                    disabled={!selectedHabitId || assigningHabit}
                    className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {assigningHabit ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 dark:text-slate-400 mb-4">No habit templates available</p>
                <Link
                  href="/coach/habits"
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Create a habit template first
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
