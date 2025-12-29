'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useColors } from '@/hooks/useColors'

// ============================================
// TYPES
// ============================================

interface WorkoutDay {
  id: string
  name: string
  day_number: number
  week_id: string
  program_weeks: {
    week_number: number
    program_id: string
    programs: {
      name: string
    } | null
  } | null
}

interface WorkoutLog {
  id: string
  started_at: string
  completed_at: string | null
  workout_day_id: string
  assignment_id: string | null
  workout_days: WorkoutDay | null
}

interface SetLog {
  workout_log_id: string
  weight: number | null
  reps_completed: number | null
  workout_exercise_id: string
}

interface Exercise {
  id: string
  name: string
}

interface PersonalRecord {
  id: string
  exercise_id: string
  record_type: string
  value: number
  achieved_at: string
  set_log_id: string | null
  exercises: Exercise | null
}

interface WorkoutExercise {
  id: string
  day_id: string
  section: string
  sets: string | null
  exercise_id: string | null
  exercises: {
    id: string
    muscle_groups: string[] | null
    primary_muscle: string | null
    focus_area: string | null
  } | null
}

interface WorkoutHistoryClientProps {
  workoutLogs: WorkoutLog[]
  setLogs: SetLog[]
  personalRecords: PersonalRecord[]
  workoutExercises: WorkoutExercise[]
  firstWorkoutDate: string | null
}

type Tab = 'history' | 'volume'
type VolumePeriod = 'weekly' | 'monthly' | 'yearly'

// ============================================
// HELPERS
// ============================================

const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `${(volume / 1000000).toFixed(1)}M`
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`
  }
  return volume.toLocaleString()
}

const formatDuration = (startedAt: string, completedAt: string): string => {
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const minutes = Math.round((end - start) / 60000)
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }
  return `${minutes} min`
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatMemberSince = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ============================================
// CALENDAR COMPONENT
// ============================================

interface CalendarProps {
  workoutLogs: WorkoutLog[]
  workoutExercises: WorkoutExercise[]
  colors: {
    purple: string
    purpleLight: string
    blue: string
    border: string
    text: string
    textSecondary: string
    textMuted: string
    bgCard: string
    bgTertiary: string
  }
}

function Calendar({ workoutLogs, workoutExercises, colors }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Build a map of "YYYY-MM-DD" -> workout info (timezone-safe)
  const workoutsByDate = useMemo(() => {
    const map = new Map<string, { count: number; type: 'strength' | 'mobility' }>()

    workoutLogs.forEach(log => {
      if (!log.completed_at) return
      // Use local date parts to create key (avoids timezone issues)
      const date = new Date(log.completed_at)
      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

      const dayId = log.workout_day_id
      const exercisesForDay = workoutExercises.filter(we => we.day_id === dayId)
      const sections = new Set(exercisesForDay.map(we => we.section))

      // Default to strength - most workouts are strength training
      let type: 'strength' | 'mobility' = 'strength'

      // Only mark as mobility if it's ONLY warmup/cooldown sections
      if (exercisesForDay.length > 0) {
        const hasStrength = sections.has('strength') || sections.has('main')
        if (!hasStrength && (sections.has('warmup') || sections.has('cooldown'))) {
          type = 'mobility'
        }
      }

      const existing = map.get(dateKey)
      if (existing) {
        existing.count++
      } else {
        map.set(dateKey, { count: 1, type })
      }
    })

    return map
  }, [workoutLogs, workoutExercises])

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = new Date(year, month, 1).getDay()
    const adjustedStartDay = startingDay === 0 ? 6 : startingDay - 1
    return { daysInMonth, adjustedStartDay, year, month }
  }

  const { daysInMonth, adjustedStartDay, year, month } = getDaysInMonth(currentMonth)

  const workoutsInMonth = useMemo(() => {
    let count = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = `${year}-${month}-${day}`
      if (workoutsByDate.has(dateKey)) {
        count += workoutsByDate.get(dateKey)!.count
      }
    }
    return count
  }, [daysInMonth, year, month, workoutsByDate])

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  const today = new Date()
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const getWorkoutTypeColor = (type: 'strength' | 'mobility') => {
    return type === 'strength' ? colors.purple : colors.blue
  }

  const prevMonthLastDay = new Date(year, month, 0).getDate()
  const prevMonthDays = Array.from({ length: adjustedStartDay }, (_, i) => prevMonthLastDay - adjustedStartDay + i + 1)
  const totalCells = Math.ceil((daysInMonth + adjustedStartDay) / 7) * 7
  const nextMonthDays = Array.from({ length: totalCells - daysInMonth - adjustedStartDay }, (_, i) => i + 1)

  return (
    <div
      className="p-4 rounded-2xl"
      style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{ background: colors.bgTertiary }}
        >
          <svg className="w-4 h-4" style={{ color: colors.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-center">
          <h3 className="font-bold" style={{ color: colors.text }}>
            {monthNames[month]} {year}
          </h3>
          <p className="text-xs" style={{ color: colors.textMuted }}>
            {workoutsInMonth} workout{workoutsInMonth !== 1 ? 's' : ''}
          </p>
        </div>

        <button
          onClick={nextMonth}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{ background: colors.bgTertiary }}
        >
          <svg className="w-4 h-4" style={{ color: colors.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayNames.map((day, i) => (
          <div key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: colors.textMuted }}>
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {prevMonthDays.map((day, i) => (
          <div key={`prev-${i}`} className="aspect-square flex items-center justify-center text-xs" style={{ color: colors.textMuted, opacity: 0.3 }}>
            {day}
          </div>
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dateKey = `${year}-${month}-${day}`
          const workout = workoutsByDate.get(dateKey)
          const isTodayDate = isToday(day)

          return (
            <div
              key={day}
              className="aspect-square flex flex-col items-center justify-center text-xs relative rounded-lg"
              style={{
                background: isTodayDate ? colors.purpleLight : 'transparent',
                color: isTodayDate ? colors.purple : colors.text,
                fontWeight: isTodayDate || workout ? 600 : 400,
              }}
            >
              {day}
              {workout && (
                <div
                  className="absolute bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                  style={{ background: getWorkoutTypeColor(workout.type) }}
                />
              )}
            </div>
          )
        })}

        {nextMonthDays.map((day, i) => (
          <div key={`next-${i}`} className="aspect-square flex items-center justify-center text-xs" style={{ color: colors.textMuted, opacity: 0.3 }}>
            {day}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: colors.border }}>
        {[
          { type: 'strength', color: colors.purple },
          { type: 'mobility', color: colors.blue },
        ].map(({ type, color }) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs capitalize" style={{ color: colors.textMuted }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// VOLUME CHART COMPONENT
// ============================================

interface VolumeChartProps {
  data: { label: string; volume: number }[]
  colors: {
    purple: string
    purpleLight: string
    purpleGradient: string
    border: string
    text: string
    textMuted: string
    green: string
    red: string
  }
}

function VolumeChart({ data, colors }: VolumeChartProps) {
  const hasAnyVolume = data.some(d => d.volume > 0)

  if (data.length === 0 || !hasAnyVolume) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm" style={{ color: colors.textMuted }}>
          No volume data yet
        </p>
      </div>
    )
  }

  const maxVolume = Math.max(...data.map(d => d.volume), 1)
  const currentVolume = data[data.length - 1]?.volume || 0
  const previousVolume = data[data.length - 2]?.volume || 0
  const trend = previousVolume > 0 ? ((currentVolume - previousVolume) / previousVolume * 100) : 0
  const trendUp = trend >= 0
  const chartHeight = 100

  return (
    <div className="space-y-3">
      {data.length >= 2 && previousVolume > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: colors.textMuted }}>Trend</span>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" style={{ color: trendUp ? colors.green : colors.red }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trendUp ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
            </svg>
            <span className="text-sm font-bold" style={{ color: trendUp ? colors.green : colors.red }}>
              {Math.abs(trend).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1" style={{ height: chartHeight }}>
        {data.map((d, i) => {
          const heightRatio = maxVolume > 0 ? d.volume / maxVolume : 0
          const barHeight = Math.max(heightRatio * chartHeight, d.volume > 0 ? 4 : 0)
          const isLast = i === data.length - 1

          return (
            <div key={i} className="flex-1 flex flex-col justify-end items-center">
              <div
                className="w-full max-w-[40px] rounded-t-md transition-all"
                style={{
                  height: barHeight,
                  background: isLast ? colors.purpleGradient : colors.purpleLight,
                  opacity: isLast ? 1 : 0.7,
                }}
              />
              {d.volume > 0 && (
                <p className="text-[9px] mt-1 font-medium" style={{ color: colors.textMuted }}>
                  {formatVolume(d.volume)}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <p className="text-[10px]" style={{ color: colors.textMuted }}>{d.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkoutHistoryClient({
  workoutLogs,
  setLogs,
  personalRecords,
  workoutExercises,
  firstWorkoutDate,
}: WorkoutHistoryClientProps) {
  const colors = useColors()
  const [activeTab, setActiveTab] = useState<Tab>('history')
  const [volumePeriod, setVolumePeriod] = useState<VolumePeriod>('weekly')

  // Build set logs map for volume calculation
  const setLogsByWorkout = useMemo(() => {
    const map = new Map<string, SetLog[]>()
    setLogs.forEach(sl => {
      const existing = map.get(sl.workout_log_id) || []
      existing.push(sl)
      map.set(sl.workout_log_id, existing)
    })
    return map
  }, [setLogs])

  // Calculate volume for a workout log
  const getWorkoutVolume = useCallback((logId: string) => {
    const logSets = setLogsByWorkout.get(logId) || []
    let volume = 0
    logSets.forEach(sl => {
      if (sl.weight && sl.reps_completed) {
        volume += sl.weight * sl.reps_completed
      }
    })
    return volume
  }, [setLogsByWorkout])

  // Weekly volume data (last 8 weeks)
  const weeklyVolumeData = useMemo(() => {
    const weeks: { label: string; volume: number }[] = []
    const now = new Date()
    const dayOfWeek = now.getDay()
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const currentMonday = new Date(now)
    currentMonday.setDate(now.getDate() - daysFromMonday)
    currentMonday.setHours(0, 0, 0, 0)

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(currentMonday)
      weekStart.setDate(currentMonday.getDate() - (i * 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      let weekVolume = 0
      workoutLogs.forEach(log => {
        if (!log.completed_at) return
        const logDate = new Date(log.completed_at)
        if (logDate >= weekStart && logDate <= weekEnd) {
          weekVolume += getWorkoutVolume(log.id)
        }
      })

      weeks.push({
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        volume: weekVolume,
      })
    }
    return weeks
  }, [workoutLogs, getWorkoutVolume])

  // Monthly volume data (last 12 months)
  const monthlyVolumeData = useMemo(() => {
    const months: { label: string; volume: number }[] = []
    const now = new Date()
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      monthEnd.setHours(23, 59, 59, 999)

      let monthVolume = 0
      workoutLogs.forEach(log => {
        if (!log.completed_at) return
        const logDate = new Date(log.completed_at)
        if (logDate >= monthStart && logDate <= monthEnd) {
          monthVolume += getWorkoutVolume(log.id)
        }
      })

      months.push({
        label: monthNames[monthStart.getMonth()],
        volume: monthVolume,
      })
    }
    return months
  }, [workoutLogs, getWorkoutVolume])

  // Yearly volume data (last 5 years)
  const yearlyVolumeData = useMemo(() => {
    const years: { label: string; volume: number }[] = []
    const currentYear = new Date().getFullYear()

    for (let i = 4; i >= 0; i--) {
      const year = currentYear - i
      const yearStart = new Date(year, 0, 1)
      const yearEnd = new Date(year, 11, 31)
      yearEnd.setHours(23, 59, 59, 999)

      let yearVolume = 0
      workoutLogs.forEach(log => {
        if (!log.completed_at) return
        const logDate = new Date(log.completed_at)
        if (logDate >= yearStart && logDate <= yearEnd) {
          yearVolume += getWorkoutVolume(log.id)
        }
      })

      years.push({
        label: year.toString(),
        volume: yearVolume,
      })
    }
    return years
  }, [workoutLogs, getWorkoutVolume])

  // Get current volume data based on period
  const currentVolumeData = volumePeriod === 'weekly' ? weeklyVolumeData : volumePeriod === 'monthly' ? monthlyVolumeData : yearlyVolumeData

  // Calculate total volume
  const totalVolume = useMemo(() => {
    let total = 0
    workoutLogs.forEach(log => {
      if (log.completed_at) {
        total += getWorkoutVolume(log.id)
      }
    })
    return total
  }, [workoutLogs, getWorkoutVolume])

  // Calculate stats
  const stats = useMemo(() => {
    const prsCount = personalRecords.length
    return {
      workouts: workoutLogs.filter(l => l.completed_at).length,
      prs: prsCount,
      totalVolume: Math.round(totalVolume),
    }
  }, [workoutLogs, personalRecords, totalVolume])

  // Workouts with volume for display
  const workoutsWithVolume = useMemo(() => {
    return workoutLogs
      .filter(log => log.completed_at)
      .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
      .map(log => {
        const volume = getWorkoutVolume(log.id)
        const logSets = setLogsByWorkout.get(log.id) || []
        const logDate = new Date(log.completed_at!)
        const prsInWorkout = personalRecords.filter(pr => {
          const prDate = new Date(pr.achieved_at)
          return Math.abs(prDate.getTime() - logDate.getTime()) < 24 * 60 * 60 * 1000
        })

        return {
          ...log,
          volume,
          exerciseCount: new Set(logSets.map(sl => sl.workout_exercise_id)).size,
          prsCount: prsInWorkout.length,
          duration: log.started_at && log.completed_at ? formatDuration(log.started_at, log.completed_at) : null,
        }
      })
  }, [workoutLogs, getWorkoutVolume, setLogsByWorkout, personalRecords])

  return (
    <div className="min-h-screen pb-24" style={{ background: colors.bgGradient }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{ background: `${colors.bgCard}`, borderColor: colors.border }}
      >
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/workouts"
              className="flex items-center justify-center w-10 h-10 rounded-xl border"
              style={{ background: colors.bgGlass, borderColor: colors.border }}
            >
              <svg className="w-5 h-5" style={{ color: colors.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold" style={{ color: colors.text }}>Workout History</h1>
            <div className="w-10" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl text-center" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
            <p className="text-2xl font-extrabold" style={{ color: colors.purple }}>{stats.workouts}</p>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>Workouts</p>
          </div>
          <div className="p-4 rounded-2xl text-center" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
            <p className="text-2xl font-extrabold" style={{ color: colors.green }}>{stats.prs}</p>
            <p className="text-xs mt-1" style={{ color: colors.textMuted }}>PRs</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          {([
            { key: 'history', label: 'History' },
            { key: 'volume', label: 'Volume' },
          ] as { key: Tab; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-3 px-2 rounded-xl text-sm font-semibold flex items-center justify-center transition-all"
              style={{
                background: activeTab === tab.key ? colors.purpleLight : colors.bgCard,
                border: `${activeTab === tab.key ? '2px' : '1px'} solid ${activeTab === tab.key ? colors.purple : colors.border}`,
                color: activeTab === tab.key ? colors.purple : colors.textMuted,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <Calendar workoutLogs={workoutLogs} workoutExercises={workoutExercises} colors={colors} />

            {/* Workout List */}
            <div className="space-y-3">
              {workoutsWithVolume.length === 0 ? (
                <div className="p-8 rounded-2xl text-center" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
                  <p className="text-4xl mb-3">🏋️</p>
                  <p className="font-semibold mb-1" style={{ color: colors.text }}>No workouts yet</p>
                  <p className="text-sm" style={{ color: colors.textMuted }}>Complete your first workout to see your history here!</p>
                </div>
              ) : (
                workoutsWithVolume.map(workout => (
                  <Link
                    key={workout.id}
                    href={`/workouts/${workout.workout_day_id}`}
                    className="block p-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold" style={{ color: colors.text }}>
                            {workout.workout_days?.name || 'Workout'}
                          </h3>
                          {workout.prsCount > 0 && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold text-white" style={{ background: colors.amberGradient }}>
                              🏆 {workout.prsCount} PR{workout.prsCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: colors.textMuted }}>
                          {workout.workout_days?.program_weeks?.programs?.name || 'Program'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-semibold" style={{ color: colors.textSecondary }}>
                            {workout.completed_at ? formatDate(workout.completed_at) : ''}
                          </p>
                          {workout.duration && (
                            <p className="text-xs" style={{ color: colors.textMuted }}>{workout.duration}</p>
                          )}
                        </div>
                        <svg className="w-4 h-4" style={{ color: colors.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-3">
                      <div>
                        <p className="text-xs" style={{ color: colors.textMuted }}>Volume</p>
                        <p className="text-sm font-bold" style={{ color: colors.purple }}>{formatVolume(workout.volume)} lbs</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: colors.textMuted }}>Exercises</p>
                        <p className="text-sm font-bold" style={{ color: colors.text }}>{workout.exerciseCount}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'volume' && (
          <div className="space-y-4">
            {/* Period Toggle */}
            <div className="flex p-1 rounded-xl" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
              {(['weekly', 'monthly', 'yearly'] as VolumePeriod[]).map(period => (
                <button
                  key={period}
                  onClick={() => setVolumePeriod(period)}
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all capitalize"
                  style={{
                    background: volumePeriod === period ? colors.purpleGradient : 'transparent',
                    color: volumePeriod === period ? '#fff' : colors.textMuted,
                  }}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Total Volume Card */}
            <div
              className="p-5 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${colors.purpleLight} 0%, ${colors.bgCard} 100%)`,
                border: `1px solid ${colors.borderGlow}`,
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: colors.textMuted }}>
                Total Volume
              </p>
              <p className="text-3xl font-extrabold" style={{ color: colors.text }}>
                {formatVolume(stats.totalVolume)} lbs
              </p>
            </div>

            {/* Volume Chart */}
            <div className="p-5 rounded-2xl" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: colors.text }}>
                {volumePeriod === 'weekly' ? 'Last 8 Weeks' : volumePeriod === 'monthly' ? 'Last 12 Months' : 'Last 5 Years'}
              </h3>
              <VolumeChart data={currentVolumeData} colors={colors} />
            </div>
          </div>
        )}

        {/* Member Since */}
        {firstWorkoutDate && (
          <div className="text-center pt-4">
            <p className="text-xs" style={{ color: colors.textMuted }}>
              Training since {formatMemberSince(firstWorkoutDate)}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
