'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/NotificationBell'
import { useColors } from '@/hooks/useColors'
import { useTheme } from '@/lib/theme'

type HabitCategory = 'nutrition' | 'fitness' | 'sleep' | 'mindset' | 'lifestyle' | 'tracking'

interface HabitTemplate {
  name: string
  description: string | null
  target_value: number | null
  target_unit: string | null
  category: HabitCategory | null
}

interface ClientHabit {
  id: string
  custom_target_value: number | null
  custom_target_unit: string | null
  habit_templates: HabitTemplate | HabitTemplate[] | null
}

interface HabitCompletion {
  id: string
  client_habit_id: string
  value: number | null
}

interface WeekHabitCompletion {
  id: string
  client_habit_id: string
  completed_date: string
  value: number | null
}

interface HabitWeekDay {
  dayName: string
  dateStr: string
  isToday: boolean
  isPast: boolean
  isFuture: boolean
}

interface TodayWorkout {
  id: string
  name: string
  subtitle: string | null
  exerciseCount: number
  estimatedDuration: number
  week: number
  dayNumber: number
}

interface WeekDay {
  dayName: string
  dayNum: number
  isToday: boolean
  isPast: boolean
  completed: boolean
  hasWorkout: boolean
}

interface Rivalry {
  id: string
  habit_name: string
  opponent_name: string
  my_score: number
  opponent_score: number
  days_left: number
  user_initial: string
  opponent_initial: string
  user_avatar_url: string | null
  opponent_avatar_url: string | null
}

interface DashboardClientProps {
  userName: string
  initials: string
  userId: string
  greeting: string
  todayWorkout: TodayWorkout | null
  weekDays: WeekDay[]
  workoutsThisWeek: number
  totalWorkoutsInWeek: number
  habits: ClientHabit[]
  todayCompletions: HabitCompletion[]
  weekHabitCompletions: WeekHabitCompletion[]
  habitWeekDays: HabitWeekDay[]
  overallStreak: number
  rivalry?: Rivalry | null
}


// Helper to handle Supabase returning array or single object or null
function getHabitTemplate(habit: ClientHabit): HabitTemplate {
  const defaultTemplate: HabitTemplate = { name: 'Habit', description: null, target_value: null, target_unit: null, category: null }

  if (!habit.habit_templates) {
    return defaultTemplate
  }
  if (Array.isArray(habit.habit_templates)) {
    return habit.habit_templates[0] || defaultTemplate
  }
  return habit.habit_templates
}

// Habit card colors by category (vibrant backgrounds like the reference)
const habitCardColors: Record<HabitCategory, { bg: string; bgLight: string }> = {
  nutrition: { bg: '#10b981', bgLight: '#34d399' }, // Green
  fitness: { bg: '#8b5cf6', bgLight: '#a78bfa' }, // Purple
  sleep: { bg: '#6366f1', bgLight: '#818cf8' }, // Indigo
  mindset: { bg: '#f59e0b', bgLight: '#fbbf24' }, // Amber/Orange
  lifestyle: { bg: '#ec4899', bgLight: '#f472b6' }, // Pink
  tracking: { bg: '#0ea5e9', bgLight: '#38bdf8' }, // Sky blue
}

export function DashboardClient({
  userName,
  initials,
  userId,
  greeting,
  todayWorkout,
  weekDays,
  workoutsThisWeek,
  totalWorkoutsInWeek,
  habits,
  todayCompletions,
  weekHabitCompletions,
  habitWeekDays,
  overallStreak,
  rivalry,
}: DashboardClientProps) {
  const colors = useColors()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [completions, setCompletions] = useState<HabitCompletion[]>(todayCompletions)
  const [weekCompletions, setWeekCompletions] = useState<WeekHabitCompletion[]>(weekHabitCompletions)
  const [loading, setLoading] = useState<string | null>(null)
  const [animatingHabit, setAnimatingHabit] = useState<string | null>(null)
  const [expandedHabit, setExpandedHabit] = useState<string | null>(null)
  const supabase = createClient()
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone

  const isCompleted = (habitId: string) => {
    return completions.some(c => c.client_habit_id === habitId)
  }

  const isCompletedOnDate = (habitId: string, dateStr: string) => {
    return weekCompletions.some(c => c.client_habit_id === habitId && c.completed_date === dateStr)
  }

  const getCompletionForDate = (habitId: string, dateStr: string) => {
    return weekCompletions.find(c => c.client_habit_id === habitId && c.completed_date === dateStr)
  }

  const toggleHabitForDate = async (habit: ClientHabit, dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card collapse
    setLoading(`${habit.id}-${dateStr}`)

    try {
      const existingCompletion = getCompletionForDate(habit.id, dateStr)

      if (existingCompletion) {
        // Remove completion
        await supabase
          .from('habit_completions')
          .delete()
          .eq('id', existingCompletion.id)

        setWeekCompletions(prev => prev.filter(c => c.id !== existingCompletion.id))
        if (dateStr === today) {
          setCompletions(prev => prev.filter(c => c.id !== existingCompletion.id))
        }
      } else {
        // Add completion
        const { data, error } = await supabase
          .from('habit_completions')
          .insert({
            client_habit_id: habit.id,
            client_id: userId,
            completed_date: dateStr,
            value: null,
          })
          .select()
          .single()

        if (error) throw error

        setWeekCompletions(prev => [...prev, data])
        if (dateStr === today) {
          setCompletions(prev => [...prev, data])
        }
      }
    } catch (err) {
      console.error('Error toggling habit:', err)
    } finally {
      setLoading(null)
    }
  }

  const toggleHabit = async (habit: ClientHabit) => {
    setLoading(habit.id)

    try {
      if (isCompleted(habit.id)) {
        const completion = completions.find(c => c.client_habit_id === habit.id)
        if (completion) {
          await supabase
            .from('habit_completions')
            .delete()
            .eq('id', completion.id)

          setCompletions(prev => prev.filter(c => c.id !== completion.id))
        }
      } else {
        // Trigger fill-up animation
        setAnimatingHabit(habit.id)

        const { data, error } = await supabase
          .from('habit_completions')
          .insert({
            client_habit_id: habit.id,
            client_id: userId,
            completed_date: today,
            value: null,
          })
          .select()
          .single()

        if (error) throw error

        setCompletions(prev => [...prev, data])

        // Clear animation after it completes
        setTimeout(() => setAnimatingHabit(null), 600)
      }
    } catch (err) {
      console.error('Error toggling habit:', err)
      setAnimatingHabit(null)
    } finally {
      setLoading(null)
    }
  }

  const completedHabits = habits.filter(h => isCompleted(h.id)).length

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <p className="greeting-text">{greeting}</p>
            <h1 className="user-name">{userName}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationBell userId={userId} />
            <Link href="/settings" className="avatar-link">
              <div className="avatar">{initials}</div>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Left Column - Workout */}
        <div className="left-column">
          {/* Today's Workout Card */}
          {todayWorkout ? (
            <Link href={`/workouts/${todayWorkout.id}`} className="workout-card-link">
              <div className="workout-card">
                {/* Decorative circles */}
                <div className="workout-card-circle-1" />
                <div className="workout-card-circle-2" />

                <div className="workout-card-content">
                  <div className="workout-card-header">
                    <div>
                      <p className="workout-label">Today's Workout</p>
                      <h2 className="workout-name">{todayWorkout.name}</h2>
                      {todayWorkout.subtitle && (
                        <p className="workout-subtitle">{todayWorkout.subtitle}</p>
                      )}
                    </div>
                    <div className="week-badge">Week {todayWorkout.week}</div>
                  </div>

                  {/* Stats */}
                  <div className="workout-stats">
                    <div className="workout-stat">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <span>{todayWorkout.estimatedDuration} min</span>
                    </div>
                    <div className="workout-stat">
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                      </svg>
                      <span>{todayWorkout.exerciseCount} exercises</span>
                    </div>
                  </div>

                  {/* Start Button */}
                  <button className="start-workout-btn">
                    Start Workout
                    <svg width={16} height={16} viewBox="0 0 24 24" fill={colors.purpleDark}>
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                  </button>
                </div>
              </div>
            </Link>
          ) : (
            <div className="rest-day-card">
              <div className="rest-day-icon">
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.green} strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 className="rest-day-title">Rest Day</h3>
              <p className="rest-day-text">No workout scheduled for today. Recovery is progress!</p>
            </div>
          )}

          {/* Week Progress */}
          <div className="week-progress-card">
            <div className="week-progress-header">
              <span className="week-progress-title">This Week</span>
              <span className="week-progress-count">{workoutsThisWeek} of {totalWorkoutsInWeek} workouts</span>
            </div>

            <div className="week-days">
              {weekDays.map((day, i) => (
                <div key={i} className="week-day">
                  <div className={`week-day-name ${day.isToday ? 'today' : ''}`}>
                    {day.dayName}
                  </div>
                  <div className={`week-day-num ${day.isToday ? 'today' : ''} ${day.completed ? 'completed' : ''} ${day.hasWorkout && !day.completed && !day.isToday ? 'has-workout' : ''}`}>
                    {day.completed ? (
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : (
                      day.dayNum
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Habits */}
        {habits.length > 0 && (
          <div className="right-column">
            {/* Rivalry Card */}
            {rivalry && (() => {
              const scoreDiff = rivalry.my_score - rivalry.opponent_score
              const isWinning = scoreDiff > 0
              const isTied = scoreDiff === 0
              const isLosing = scoreDiff < 0

              return (
                <Link href={`/rivalry/${rivalry.id}`} className={`rivalry-card ${isDark ? 'dark' : 'light'}`}>
                  {/* Top gradient bar */}
                  <div className="rivalry-gradient-bar" />

                  {/* Red glow overlay (dark mode only) */}
                  {isDark && <div className="rivalry-glow-overlay" />}

                  {/* Header */}
                  <div className="rivalry-header">
                    <div className="rivalry-header-left">
                      <div className="rivalry-icon-container">
                        {/* Crossed swords icon */}
                        <svg width={isDark ? 28 : 26} height={isDark ? 28 : 26} viewBox="0 0 24 24" fill="white">
                          <path d="M6.92 5H5L3 7l1 1h2l1-1V5.08L6.92 5zM19 3l-6.47 6.47 1 1L20 4V3h-1zM3 20l1 1 6.47-6.47-1-1L3 20zM17.08 19l.92.92V22l2-2-1-1h-2l-1 1v1.92l.08-.92zM20.59 6.42l-1.17-1.17L12 12.67l1.17 1.17 7.42-7.42zM4.58 17.42L12 10l-1.17-1.17-7.42 7.42 1.17 1.17z"/>
                        </svg>
                      </div>
                      <div className="rivalry-header-text">
                        <span className="rivalry-label">
                          {isDark ? 'RIVALRY' : 'ACTIVE RIVALRY'}
                          {isDark && (
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="#ef4444" style={{ marginLeft: 4 }}>
                              <path d="M12 23c-3.65 0-7-2.76-7-7.46 0-3.06 1.96-5.63 3.5-7.46.73-.87 1.94-.87 2.67 0 .45.53.93 1.15 1.33 1.79.2-.81.54-1.57.98-2.25.53-.83 1.62-.96 2.31-.29C18.02 9.48 19 12.03 19 15.54 19 20.24 15.65 23 12 23z"/>
                            </svg>
                          )}
                        </span>
                        <span className="rivalry-name">{rivalry.habit_name}</span>
                      </div>
                    </div>
                    <div className="rivalry-days-badge">
                      {rivalry.days_left}d left
                    </div>
                  </div>

                  {/* Score Display */}
                  <div className={`rivalry-scores-container ${!isDark ? 'light-bg' : ''}`}>
                    {/* User Score */}
                    <div className="rivalry-player">
                      <div className="rivalry-avatar user">
                        {rivalry.user_avatar_url ? (
                          <img src={rivalry.user_avatar_url} alt="You" className="rivalry-avatar-img" />
                        ) : (
                          <span>{rivalry.user_initial}</span>
                        )}
                        {isWinning && (
                          <div className="rivalry-crown">
                            <svg width={isDark ? 16 : 14} height={isDark ? 16 : 14} viewBox="0 0 24 24" fill="white">
                              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="rivalry-player-label">You</span>
                      <span className={`rivalry-player-score ${isWinning || isTied ? 'winning' : 'losing'}`}>
                        {rivalry.my_score}%
                      </span>
                    </div>

                    {/* VS Badge */}
                    <div className="rivalry-vs-container">
                      <div className="rivalry-vs-badge">VS</div>
                      {scoreDiff !== 0 && (
                        <div className={`rivalry-diff-pill ${isWinning ? 'positive' : 'negative'}`}>
                          {isWinning ? '+' : ''}{scoreDiff}%
                        </div>
                      )}
                    </div>

                    {/* Opponent Score */}
                    <div className="rivalry-player">
                      <div className="rivalry-avatar opponent">
                        {rivalry.opponent_avatar_url ? (
                          <img src={rivalry.opponent_avatar_url} alt={rivalry.opponent_name} className="rivalry-avatar-img" />
                        ) : (
                          <span>{rivalry.opponent_initial}</span>
                        )}
                        {isLosing && (
                          <div className="rivalry-crown">
                            <svg width={isDark ? 16 : 14} height={isDark ? 16 : 14} viewBox="0 0 24 24" fill="white">
                              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="rivalry-player-label">{rivalry.opponent_name.split(' ')[0]}</span>
                      <span className={`rivalry-player-score ${isLosing ? 'winning' : 'losing'}`}>
                        {rivalry.opponent_score}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="rivalry-progress">
                    <div
                      className="rivalry-progress-fill"
                      style={{ width: `${Math.max(5, rivalry.my_score)}%` }}
                    />
                  </div>

                  {/* Footer */}
                  <div className="rivalry-footer">
                    <div className="rivalry-status">
                      {/* Trophy icon */}
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="#f59e0b">
                        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                      </svg>
                      <span>
                        {isWinning ? 'Dominating!' : isLosing ? 'Time to catch up!' : 'Tied! Stay consistent'}
                      </span>
                    </div>
                    <div className="rivalry-view-btn">
                      View Details
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })()}

            <div className="habits-header">
              <div className="habits-title-row">
                <h3 className="habits-title">Daily Habits</h3>
                <span className={`habits-count ${completedHabits === habits.length ? 'complete' : ''}`}>
                  {completedHabits}/{habits.length}
                </span>
              </div>
              {overallStreak > 0 && (
                <div className="streak-badge">
                  <svg width={16} height={16} viewBox="0 0 24 24" fill={colors.amber}>
                    <path d="M12 23c-3.65 0-7-2.76-7-7.46 0-3.06 1.96-5.63 3.5-7.46.73-.87 1.94-.87 2.67 0 .45.53.93 1.15 1.33 1.79.2-.81.54-1.57.98-2.25.53-.83 1.62-.96 2.31-.29C18.02 9.48 19 12.03 19 15.54 19 20.24 15.65 23 12 23z"/>
                  </svg>
                  <span>{overallStreak}</span>
                </div>
              )}
            </div>

            <div className="habits-cards">
              {habits.map((habit) => {
                const completed = isCompleted(habit.id)
                const template = getHabitTemplate(habit)
                const category = template.category || 'tracking'
                const cardColor = habitCardColors[category]
                const target = habit.custom_target_value || template.target_value
                const unit = habit.custom_target_unit || template.target_unit
                const isAnimating = animatingHabit === habit.id
                const isExpanded = expandedHabit === habit.id
                const weekCompletedCount = habitWeekDays.filter(d => isCompletedOnDate(habit.id, d.dateStr)).length

                return (
                  <div
                    key={habit.id}
                    className={`habit-card ${completed ? 'completed' : ''} ${isAnimating ? 'animating' : ''} ${isExpanded ? 'expanded' : ''}`}
                    style={{
                      '--card-color': cardColor.bg,
                      '--card-color-light': cardColor.bgLight,
                    } as React.CSSProperties}
                  >
                    {/* Fill animation overlay */}
                    <div className="habit-card-fill" />

                    {/* Card main row */}
                    <div
                      className="habit-card-main"
                      onClick={() => setExpandedHabit(isExpanded ? null : habit.id)}
                    >
                      {/* Card content */}
                      <div className="habit-card-content">
                        {/* Icon */}
                        <div className="habit-card-icon">
                          {category === 'nutrition' && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>
                            </svg>
                          )}
                          {category === 'fitness' && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                              <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
                            </svg>
                          )}
                          {category === 'sleep' && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                              <path d="M12.34 2.02C6.59 1.82 2 6.42 2 12c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-14.96z"/>
                            </svg>
                          )}
                          {category === 'mindset' && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                          )}
                          {category === 'lifestyle' && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                          )}
                          {category === 'tracking' && (
                            <svg width={20} height={20} viewBox="0 0 24 24" fill="white">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                            </svg>
                          )}
                        </div>

                        {/* Text content */}
                        <div className="habit-card-text">
                          <span className="habit-card-name">{template.name}</span>
                          {target && unit && (
                            <span className="habit-card-target">Every day, {target} {unit}</span>
                          )}
                          {!target && <span className="habit-card-target">Every day</span>}
                        </div>
                      </div>

                      {/* Week indicator (collapsed view) */}
                      {!isExpanded && (
                        <div className="habit-week-dots">
                          {habitWeekDays.map((day) => (
                            <div
                              key={day.dateStr}
                              className={`habit-week-dot ${isCompletedOnDate(habit.id, day.dateStr) ? 'done' : ''} ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}`}
                            />
                          ))}
                        </div>
                      )}

                      {/* Action button - quick toggle for today */}
                      <div
                        className="habit-card-action"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!loading) toggleHabit(habit)
                        }}
                      >
                        {loading === habit.id ? (
                          <div className="habit-card-spinner" />
                        ) : completed ? (
                          <div className="habit-card-check">
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </div>
                        ) : (
                          <div className="habit-card-add">
                            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded week view */}
                    {isExpanded && (
                      <div className="habit-week-expanded">
                        <div className="habit-week-header">
                          <span className="habit-week-label">This week</span>
                          <span className="habit-week-count">{weekCompletedCount}/7</span>
                        </div>
                        <div className="habit-week-grid">
                          {habitWeekDays.map((day) => {
                            const isDone = isCompletedOnDate(habit.id, day.dateStr)
                            const isLoading = loading === `${habit.id}-${day.dateStr}`
                            return (
                              <div
                                key={day.dateStr}
                                className={`habit-week-day ${isDone ? 'done' : ''} ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}`}
                                onClick={(e) => !day.isFuture && !isLoading && toggleHabitForDate(habit, day.dateStr, e)}
                              >
                                <span className="habit-week-day-name">{day.dayName}</span>
                                <div className="habit-week-day-circle">
                                  {isLoading ? (
                                    <div className="habit-week-spinner" />
                                  ) : isDone ? (
                                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                  ) : null}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <Link href="/habits/history" className="view-all-habits">
              View habit stats →
            </Link>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {[
            { id: 'home', label: 'Home', href: '/dashboard', active: true },
            { id: 'workouts', label: 'Workouts', href: '/workouts', active: false },
            { id: 'profile', label: 'Profile', href: '/settings', active: false },
          ].map(tab => (
            <Link key={tab.id} href={tab.href} className={`nav-item ${tab.active ? 'active' : ''}`}>
              {tab.id === 'home' && (
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              )}
              {tab.id === 'workouts' && (
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6.5 6.5h11M6.5 17.5h11M6 12h12M3 9v6M6 7v10M18 7v10M21 9v6"/>
                </svg>
              )}
              {tab.id === 'profile' && (
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              )}
              <span>{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <style>{`
        .dashboard-container {
          background: ${colors.bg};
          min-height: 100vh;
          padding-bottom: 100px;
        }

        /* Header */
        .dashboard-header {
          padding: 50px 20px 16px;
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (min-width: 768px) {
          .dashboard-header {
            padding: 40px 40px 24px;
          }
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .greeting-text {
          margin: 0;
          font-size: 13px;
          color: ${colors.textMuted};
          font-weight: 500;
          margin-bottom: 4px;
        }

        @media (min-width: 768px) {
          .greeting-text {
            font-size: 14px;
          }
        }

        .user-name {
          margin: 0;
          font-size: 26px;
          font-weight: 700;
          color: ${colors.textPrimary};
          letter-spacing: -0.5px;
        }

        @media (min-width: 768px) {
          .user-name {
            font-size: 32px;
          }
        }

        .avatar-link {
          text-decoration: none;
        }

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
          font-weight: 600;
        }

        @media (min-width: 768px) {
          .avatar {
            width: 52px;
            height: 52px;
            font-size: 18px;
          }
        }

        /* Main Content */
        .dashboard-main {
          padding: 0 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        @media (min-width: 768px) {
          .dashboard-main {
            padding: 0 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 32px;
            align-items: start;
          }
        }

        @media (min-width: 1024px) {
          .dashboard-main {
            grid-template-columns: 1.2fr 1fr;
          }
        }

        .left-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 24px;
        }

        @media (min-width: 768px) {
          .left-column {
            margin-bottom: 0;
            gap: 24px;
          }
        }

        .right-column {
          margin-bottom: 24px;
        }

        @media (min-width: 768px) {
          .right-column {
            margin-bottom: 0;
          }
        }

        /* Workout Card */
        .workout-card-link {
          text-decoration: none;
          display: block;
        }

        .workout-card {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%);
          border-radius: 24px;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        @media (min-width: 768px) {
          .workout-card {
            padding: 32px;
          }
        }

        .workout-card-circle-1 {
          position: absolute;
          top: -40px;
          right: -40px;
          width: 140px;
          height: 140px;
          background: rgba(255,255,255,0.1);
          border-radius: 50%;
        }

        .workout-card-circle-2 {
          position: absolute;
          bottom: -20px;
          left: 30%;
          width: 80px;
          height: 80px;
          background: rgba(255,255,255,0.05);
          border-radius: 50%;
        }

        .workout-card-content {
          position: relative;
          z-index: 1;
        }

        .workout-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }

        .workout-label {
          margin: 0;
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 6px;
        }

        .workout-name {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: white;
          letter-spacing: -0.3px;
        }

        @media (min-width: 768px) {
          .workout-name {
            font-size: 28px;
          }
        }

        .workout-subtitle {
          margin: 4px 0 0;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
        }

        .week-badge {
          background: rgba(255,255,255,0.15);
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .workout-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }

        .workout-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: rgba(255,255,255,0.9);
          font-weight: 500;
        }

        .start-workout-btn {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: none;
          background: white;
          color: ${colors.purpleDark};
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: transform 0.15s ease;
        }

        .start-workout-btn:hover {
          transform: scale(1.02);
        }

        @media (min-width: 768px) {
          .start-workout-btn {
            font-size: 16px;
            padding: 18px;
          }
        }

        /* Rest Day Card */
        .rest-day-card {
          background: ${colors.card};
          border-radius: 24px;
          padding: 24px;
          border: 1px solid ${colors.border};
          text-align: center;
        }

        @media (min-width: 768px) {
          .rest-day-card {
            padding: 40px;
          }
        }

        .rest-day-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: ${colors.green}20;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .rest-day-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: ${colors.textPrimary};
          margin-bottom: 4px;
        }

        .rest-day-text {
          margin: 0;
          font-size: 14px;
          color: ${colors.textMuted};
        }

        /* Week Progress */
        .week-progress-card {
          background: ${colors.card};
          border-radius: 20px;
          padding: 20px;
          border: 1px solid ${colors.border};
        }

        @media (min-width: 768px) {
          .week-progress-card {
            padding: 24px;
          }
        }

        .week-progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .week-progress-title {
          font-size: 14px;
          font-weight: 600;
          color: ${colors.textPrimary};
        }

        .week-progress-count {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        .week-days {
          display: flex;
          justify-content: space-between;
        }

        .week-day {
          text-align: center;
        }

        .week-day-name {
          font-size: 11px;
          font-weight: 600;
          color: ${colors.textMuted};
          margin-bottom: 8px;
        }

        .week-day-name.today {
          color: ${colors.purple};
        }

        .week-day-num {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: ${colors.cardHover};
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${colors.textMuted};
          font-size: 14px;
          font-weight: 600;
        }

        @media (min-width: 768px) {
          .week-day-num {
            width: 48px;
            height: 48px;
            font-size: 15px;
          }
        }

        .week-day-num.today {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%);
          color: white;
        }

        .week-day-num.completed {
          background: ${colors.green};
          color: white;
        }

        .week-day-num.has-workout {
          border: 2px solid ${colors.purple}40;
        }

        /* Habits */
        .habits-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }

        .habits-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .habits-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: ${colors.textPrimary};
        }

        @media (min-width: 768px) {
          .habits-title {
            font-size: 18px;
          }
        }

        .habits-count {
          background: ${colors.cardHover};
          color: ${colors.textSecondary};
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .habits-count.complete {
          background: linear-gradient(135deg, ${colors.green} 0%, ${colors.greenLight} 100%);
          color: white;
        }

        .streak-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: ${colors.amber}20;
          padding: 6px 10px;
          border-radius: 10px;
        }

        .streak-badge span {
          color: ${colors.amber};
          font-weight: 700;
          font-size: 13px;
        }

        /* Colorful Habit Cards */
        .habits-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .habit-card {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 16px;
          background: ${colors.card};
          border: 2px solid var(--card-color);
          cursor: pointer;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .habit-card.completed {
          background: var(--card-color);
          border-color: var(--card-color);
        }

        .habit-card:hover:not(.expanded) {
          transform: scale(1.02);
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }

        .habit-card.expanded {
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        }

        .habit-card-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          position: relative;
          z-index: 1;
        }

        /* Fill animation overlay */
        .habit-card-fill {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--card-color);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }

        .habit-card.animating .habit-card-fill {
          transform: scaleX(1);
        }

        .habit-card.completed .habit-card-fill {
          display: none;
        }

        .habit-card-content {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          z-index: 1;
          flex: 1;
          min-width: 0;
        }

        .habit-card-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: color-mix(in srgb, var(--card-color) 15%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .habit-card-icon svg {
          fill: var(--card-color);
          transition: fill 0.3s ease;
        }

        .habit-card.completed .habit-card-icon {
          background: rgba(255,255,255,0.2);
        }

        .habit-card.completed .habit-card-icon svg {
          fill: white;
        }

        .habit-card-text {
          flex: 1;
          min-width: 0;
        }

        .habit-card-name {
          display: block;
          font-size: 15px;
          font-weight: 700;
          color: ${colors.textPrimary};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: color 0.3s ease;
        }

        .habit-card.completed .habit-card-name {
          color: white;
        }

        .habit-card-target {
          display: block;
          font-size: 12px;
          color: ${colors.textMuted};
          margin-top: 2px;
          transition: color 0.3s ease;
        }

        .habit-card.completed .habit-card-target {
          color: rgba(255,255,255,0.8);
        }

        .habit-card-action {
          position: relative;
          z-index: 1;
          flex-shrink: 0;
        }

        .habit-card-add {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: transparent;
          border: 2px solid color-mix(in srgb, var(--card-color) 50%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--card-color);
          transition: all 0.2s ease;
        }

        .habit-card:hover .habit-card-add {
          background: color-mix(in srgb, var(--card-color) 10%, transparent);
          border-color: var(--card-color);
        }

        .habit-card-check {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--card-color);
          animation: checkPop 0.3s ease-out;
        }

        .habit-card-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid color-mix(in srgb, var(--card-color) 30%, transparent);
          border-top-color: var(--card-color);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .habit-card.completed .habit-card-spinner {
          border-color: rgba(255,255,255,0.3);
          border-top-color: white;
        }

        @keyframes checkPop {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .view-all-habits {
          display: block;
          margin-top: 12px;
          text-align: center;
          font-size: 14px;
          color: ${colors.purple};
          font-weight: 500;
          text-decoration: none;
        }

        .view-all-habits:hover {
          color: ${colors.purpleDark};
        }

        /* Week dots indicator (collapsed) */
        .habit-week-dots {
          display: flex;
          gap: 4px;
          margin-right: 12px;
        }

        .habit-week-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${colors.cardHover};
          transition: all 0.2s ease;
        }

        .habit-week-dot.done {
          background: var(--card-color);
        }

        .habit-card.completed .habit-week-dot {
          background: rgba(255,255,255,0.3);
        }

        .habit-card.completed .habit-week-dot.done {
          background: white;
        }

        .habit-week-dot.today {
          box-shadow: 0 0 0 2px ${colors.bg}, 0 0 0 3px var(--card-color);
        }

        .habit-card.completed .habit-week-dot.today {
          box-shadow: 0 0 0 2px var(--card-color), 0 0 0 3px white;
        }

        .habit-week-dot.future {
          opacity: 0.4;
        }

        /* Expanded week view */
        .habit-week-expanded {
          padding: 0 16px 16px;
          border-top: 1px solid color-mix(in srgb, var(--card-color) 20%, transparent);
          margin-top: -2px;
          position: relative;
          z-index: 1;
        }

        .habit-card.completed .habit-week-expanded {
          border-top-color: rgba(255,255,255,0.2);
        }

        .habit-week-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0 10px;
        }

        .habit-week-label {
          font-size: 12px;
          font-weight: 600;
          color: ${colors.textMuted};
        }

        .habit-card.completed .habit-week-label {
          color: rgba(255,255,255,0.7);
        }

        .habit-week-count {
          font-size: 12px;
          font-weight: 700;
          color: var(--card-color);
        }

        .habit-card.completed .habit-week-count {
          color: white;
        }

        .habit-week-grid {
          display: flex;
          justify-content: space-between;
        }

        .habit-week-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .habit-week-day.future {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .habit-week-day-name {
          font-size: 11px;
          font-weight: 600;
          color: ${colors.textMuted};
        }

        .habit-card.completed .habit-week-day-name {
          color: rgba(255,255,255,0.7);
        }

        .habit-week-day.today .habit-week-day-name {
          color: var(--card-color);
        }

        .habit-card.completed .habit-week-day.today .habit-week-day-name {
          color: white;
        }

        .habit-week-day-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: ${colors.cardHover};
          border: 2px solid transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${colors.textMuted};
          transition: all 0.15s ease;
        }

        .habit-card.completed .habit-week-day-circle {
          background: rgba(255,255,255,0.15);
        }

        .habit-week-day.today .habit-week-day-circle {
          border-color: var(--card-color);
        }

        .habit-card.completed .habit-week-day.today .habit-week-day-circle {
          border-color: white;
        }

        .habit-week-day.done .habit-week-day-circle {
          background: var(--card-color);
          color: white;
        }

        .habit-card.completed .habit-week-day.done .habit-week-day-circle {
          background: white;
          color: var(--card-color);
        }

        .habit-week-day:not(.future):hover .habit-week-day-circle {
          transform: scale(1.1);
        }

        .habit-week-day:not(.future):active .habit-week-day-circle {
          transform: scale(0.95);
        }

        .habit-week-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid ${colors.textMuted}30;
          border-top-color: ${colors.textMuted};
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .habit-card.completed .habit-week-spinner {
          border-color: rgba(255,255,255,0.3);
          border-top-color: white;
        }

        /* Rivalry Card - Base */
        .rivalry-card {
          display: block;
          text-decoration: none;
          position: relative;
          border-radius: 24px;
          padding: 28px;
          margin-bottom: 16px;
          overflow: hidden;
          transition: transform 0.2s ease;
        }

        .rivalry-card:hover {
          transform: translateY(-2px);
        }

        /* Dark Mode Styles */
        .rivalry-card.dark {
          background: linear-gradient(145deg, #1a1625 0%, #0f0a1a 100%);
          border: 2px solid rgba(239, 68, 68, 0.3);
          animation: pulse-glow-dark 3s ease-in-out infinite;
        }

        /* Light Mode Styles */
        .rivalry-card.light {
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #ede9fe 100%);
          border: 2px solid #c4b5fd;
          animation: pulse-glow-light 3s ease-in-out infinite;
        }

        /* Top Gradient Bar */
        .rivalry-gradient-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(135deg, #8b5cf6, #ef4444, #f59e0b, #8b5cf6);
          background-size: 300% 300%;
          animation: gradient-shift 4s ease infinite;
        }

        .rivalry-card.light .rivalry-gradient-bar {
          height: 5px;
        }

        /* Red Glow Overlay (dark mode) */
        .rivalry-glow-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 120px;
          background: radial-gradient(ellipse at top, rgba(239, 68, 68, 0.15) 0%, transparent 70%);
          pointer-events: none;
        }

        /* Header */
        .rivalry-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 20px;
          position: relative;
          z-index: 1;
        }

        .rivalry-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .rivalry-icon-container {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: float 2.5s ease-in-out infinite;
        }

        .rivalry-card.dark .rivalry-icon-container {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.4);
        }

        .rivalry-card.light .rivalry-icon-container {
          width: 52px;
          height: 52px;
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          box-shadow: 0 8px 20px rgba(139, 92, 246, 0.35);
        }

        .rivalry-header-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .rivalry-label {
          display: flex;
          align-items: center;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .rivalry-card.dark .rivalry-label {
          color: #ef4444;
        }

        .rivalry-card.light .rivalry-label {
          color: #7c3aed;
        }

        .rivalry-name {
          font-size: 18px;
          font-weight: 700;
        }

        .rivalry-card.dark .rivalry-name {
          color: white;
        }

        .rivalry-card.light .rivalry-name {
          color: #1e293b;
        }

        .rivalry-days-badge {
          padding: 8px 14px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          box-shadow: 0 4px 16px rgba(245, 158, 11, 0.4);
        }

        .rivalry-card.light .rivalry-days-badge {
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        /* Scores Container */
        .rivalry-scores-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 0;
          position: relative;
          z-index: 1;
        }

        .rivalry-scores-container.light-bg {
          background: white;
          border-radius: 20px;
          padding: 24px;
          border: 1px solid #e9d5ff;
          margin: 0 -8px 16px;
        }

        /* Player */
        .rivalry-player {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }

        .rivalry-avatar {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .rivalry-card.light .rivalry-avatar {
          width: 64px;
          height: 64px;
          border-radius: 20px;
        }

        .rivalry-avatar.user {
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          box-shadow: 0 8px 24px rgba(139, 92, 246, 0.4);
        }

        .rivalry-card.light .rivalry-avatar.user {
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        .rivalry-avatar.opponent {
          background: #1e1a2e;
          border: 2px solid #2a2640;
        }

        .rivalry-card.light .rivalry-avatar.opponent {
          background: #f1f5f9;
          border: 2px solid #e2e8f0;
        }

        .rivalry-avatar span {
          font-size: 26px;
          font-weight: 700;
          color: white;
        }

        .rivalry-card.light .rivalry-avatar span {
          font-size: 22px;
        }

        .rivalry-avatar.opponent span {
          color: #64748b;
        }

        .rivalry-card.light .rivalry-avatar.opponent span {
          color: #94a3b8;
        }

        .rivalry-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
        }

        .rivalry-crown {
          position: absolute;
          top: -10px;
          right: -10px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 3px solid #0f0a1a;
        }

        .rivalry-card.light .rivalry-crown {
          width: 26px;
          height: 26px;
          top: -8px;
          right: -8px;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
        }

        .rivalry-player-label {
          font-size: 12px;
          font-weight: 500;
          color: #94a3b8;
        }

        .rivalry-card.light .rivalry-player-label {
          color: #64748b;
        }

        .rivalry-player-score {
          font-size: 42px;
          font-weight: 900;
        }

        .rivalry-card.light .rivalry-player-score {
          font-size: 36px;
        }

        .rivalry-player-score.winning {
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .rivalry-card.light .rivalry-player-score.winning {
          background: none;
          -webkit-text-fill-color: #10b981;
          color: #10b981;
        }

        .rivalry-player-score.losing {
          color: #ef4444;
        }

        /* VS Badge */
        .rivalry-vs-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .rivalry-vs-badge {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 800;
        }

        .rivalry-card.dark .rivalry-vs-badge {
          background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
          color: white;
        }

        .rivalry-card.light .rivalry-vs-badge {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%);
          border: 2px solid #c4b5fd;
          color: #7c3aed;
        }

        .rivalry-diff-pill {
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          color: white;
        }

        .rivalry-card.light .rivalry-diff-pill {
          padding: 5px 12px;
          border-radius: 8px;
          font-size: 12px;
        }

        .rivalry-diff-pill.positive {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .rivalry-diff-pill.negative {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }

        /* Progress Bar */
        .rivalry-progress {
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          z-index: 1;
        }

        .rivalry-card.dark .rivalry-progress {
          background: #1e1a2e;
        }

        .rivalry-card.light .rivalry-progress {
          height: 10px;
          border-radius: 5px;
          background: #e9d5ff;
        }

        .rivalry-progress-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(90deg, #10b981 0%, #34d399 100%);
          transition: width 0.3s ease;
        }

        .rivalry-card.dark .rivalry-progress-fill {
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
        }

        .rivalry-card.light .rivalry-progress-fill {
          border-radius: 5px;
        }

        /* Footer */
        .rivalry-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 16px;
          position: relative;
          z-index: 1;
        }

        .rivalry-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #f59e0b;
        }

        .rivalry-card.light .rivalry-status {
          font-weight: 700;
        }

        .rivalry-view-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.4);
        }

        .rivalry-card.light .rivalry-view-btn {
          padding: 10px 16px;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }

        /* Animations */
        @keyframes pulse-glow-dark {
          0%, 100% {
            box-shadow: 0 4px 30px rgba(239, 68, 68, 0.2), 0 8px 40px rgba(139, 92, 246, 0.15);
          }
          50% {
            box-shadow: 0 8px 40px rgba(239, 68, 68, 0.35), 0 12px 50px rgba(139, 92, 246, 0.25);
          }
        }

        @keyframes pulse-glow-light {
          0%, 100% {
            box-shadow: 0 4px 20px rgba(139, 92, 246, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.1);
          }
          50% {
            box-shadow: 0 8px 30px rgba(139, 92, 246, 0.25), 0 0 0 2px rgba(139, 92, 246, 0.15);
          }
        }

        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px 24px 28px;
          background: linear-gradient(180deg, transparent 0%, ${colors.bg} 20%);
          z-index: 50;
        }

        @media (min-width: 768px) {
          .bottom-nav {
            padding: 12px 40px 24px;
          }
        }

        .bottom-nav-inner {
          max-width: 500px;
          margin: 0 auto;
          background: ${colors.card};
          border-radius: 20px;
          padding: 8px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          border: 1px solid ${colors.border};
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 10px 24px;
          border-radius: 14px;
          cursor: pointer;
          background: transparent;
          text-decoration: none;
          color: ${colors.textMuted};
          transition: all 0.15s ease;
        }

        .nav-item.active {
          background: linear-gradient(135deg, ${colors.purple}20 0%, ${colors.purpleDark}20 100%);
          color: ${colors.purple};
        }

        .nav-item:hover:not(.active) {
          color: ${colors.textSecondary};
        }

        .nav-item span {
          font-size: 11px;
          font-weight: 600;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
