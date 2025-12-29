'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useColors } from '@/hooks/useColors'
import { useTheme } from '@/lib/theme'

interface Program {
  id: string
  name: string
  description: string | null
  type: string
}

interface Assignment {
  id: string
  current_week: number
  current_day: number
  start_date: string
}

interface Exercise {
  id: string
  name: string
  equipment: string | null
  video_url: string | null
  cues: string | null
}

interface WorkoutExercise {
  id: string
  section: string
  label: string | null
  sets: string | null
  reps: string | null
  weight: string | null
  rest_seconds: number | null
  rpe: number | null
  notes: string | null
  sort_order: number
  exercises: Exercise
}

interface WorkoutDay {
  id: string
  day_number: number
  name: string
  subtitle: string | null
  is_rest_day: boolean
  rest_day_notes: string | null
  workout_exercises: WorkoutExercise[]
}

interface ProgramWeek {
  id: string
  week_number: number
  name: string | null
  workout_days: WorkoutDay[]
}

interface WorkoutLog {
  id: string
  workout_day_id: string
  started_at: string
  completed_at: string | null
}

interface WorkoutsClientProps {
  program: Program
  assignment: Assignment
  weeks: ProgramWeek[]
  workoutLogs: WorkoutLog[]
}

const sectionOrder = ['warmup', 'strength', 'cardio', 'cooldown']
const sectionLabels: Record<string, string> = {
  warmup: 'Warm-up',
  strength: 'Strength',
  cardio: 'Cardio',
  cooldown: 'Cool-down',
}

// Icons component
const Icons = {
  home: ({ size = 24, color = 'currentColor', filled = false }: { size?: number; color?: string; filled?: boolean }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  calendar: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  dumbbell: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M3 10v4M21 10v4M5 8v8M19 8v8M7 6v12M17 6v12"/>
    </svg>
  ),
  user: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  check: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  chevronDown: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  chevronLeft: ({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
}

export function WorkoutsClient({ program, assignment, weeks, workoutLogs }: WorkoutsClientProps) {
  const colors = useColors()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [selectedWeek, setSelectedWeek] = useState(assignment.current_week)
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  const currentWeekData = weeks.find(w => w.week_number === selectedWeek)

  const toggleDay = (dayId: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev)
      if (next.has(dayId)) {
        next.delete(dayId)
      } else {
        next.add(dayId)
      }
      return next
    })
  }

  const isWorkoutCompleted = (dayId: string) => {
    return workoutLogs.some(log => log.workout_day_id === dayId && log.completed_at)
  }

  const isWorkoutStarted = (dayId: string) => {
    return workoutLogs.some(log => log.workout_day_id === dayId && !log.completed_at)
  }

  const groupExercisesBySection = (exercises: WorkoutExercise[]) => {
    const groups: Record<string, WorkoutExercise[]> = {}
    exercises.forEach(ex => {
      if (!groups[ex.section]) {
        groups[ex.section] = []
      }
      groups[ex.section].push(ex)
    })
    return groups
  }

  return (
    <div className="plans-container">
      <style>{`
        .plans-container {
          min-height: 100vh;
          background: ${colors.bg};
          padding-bottom: 100px;
        }

        .plans-content {
          max-width: 500px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 0 20px;
        }

        .back-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: ${colors.bgCard};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .header-info {
          flex: 1;
        }

        .program-name {
          font-size: 20px;
          font-weight: 700;
          color: ${colors.text};
          margin: 0;
        }

        .program-desc {
          font-size: 13px;
          color: ${colors.textMuted};
          margin-top: 2px;
        }

        /* Week Selector */
        .week-selector {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 20px;
          margin: 0 -20px;
          padding-left: 20px;
          padding-right: 20px;
          -webkit-overflow-scrolling: touch;
        }

        .week-selector::-webkit-scrollbar {
          display: none;
        }

        .week-btn {
          flex-shrink: 0;
          padding: 10px 18px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .week-btn.active {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          color: white;
          box-shadow: 0 4px 12px ${isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(124, 58, 237, 0.25)'};
        }

        .week-btn.inactive {
          background: ${colors.bgCard};
          color: ${colors.textSecondary};
          border: 1px solid ${colors.border};
        }

        /* Workout Card */
        .workout-card {
          background: ${colors.bgCard};
          border-radius: 16px;
          margin-bottom: 12px;
          border: 1px solid ${colors.border};
          overflow: hidden;
          box-shadow: ${isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'};
        }

        .workout-card.completed {
          border-color: ${isDark ? 'rgba(52, 211, 153, 0.3)' : 'rgba(16, 185, 129, 0.4)'};
        }

        .workout-card.started {
          border-color: ${isDark ? 'rgba(251, 191, 36, 0.3)' : 'rgba(245, 158, 11, 0.4)'};
        }

        .workout-header {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .workout-header:hover {
          background: ${isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'};
        }

        .workout-header.rest-day {
          cursor: default;
        }

        .workout-header.rest-day:hover {
          background: transparent;
        }

        .day-number {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .day-number.default {
          background: ${isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(124, 58, 237, 0.1)'};
          color: ${colors.purple};
        }

        .day-number.completed {
          background: ${colors.green};
          color: white;
        }

        .day-number.started {
          background: ${colors.amber};
          color: white;
        }

        .day-number.rest {
          background: ${colors.bgCardSolid};
          color: ${colors.textMuted};
        }

        .workout-info {
          flex: 1;
          min-width: 0;
        }

        .workout-name {
          font-size: 15px;
          font-weight: 600;
          color: ${colors.text};
          margin-bottom: 2px;
        }

        .workout-subtitle {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        .workout-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .start-btn {
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .start-btn.default {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          color: white;
        }

        .start-btn.completed {
          background: ${isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)'};
          color: ${colors.green};
        }

        .start-btn.started {
          background: ${isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 158, 11, 0.1)'};
          color: ${colors.amber};
        }

        .expand-icon {
          transition: transform 0.2s;
        }

        .expand-icon.expanded {
          transform: rotate(180deg);
        }

        /* Workout Content - Exercises */
        .workout-content {
          padding: 0 16px 16px;
          border-top: 1px solid ${colors.border};
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          color: ${colors.textMuted};
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 16px 0 10px;
        }

        .exercise-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: ${colors.bgCardSolid};
          border-radius: 10px;
          margin-bottom: 6px;
        }

        .exercise-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .exercise-label {
          font-size: 11px;
          font-weight: 600;
          color: ${colors.purple};
          background: ${isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(124, 58, 237, 0.1)'};
          padding: 3px 8px;
          border-radius: 6px;
        }

        .exercise-name {
          font-size: 14px;
          font-weight: 500;
          color: ${colors.text};
        }

        .exercise-reps {
          font-size: 13px;
          color: ${colors.textMuted};
        }

        /* Rest Day */
        .rest-day-text {
          text-align: center;
          padding: 8px 16px 16px;
          color: ${colors.textMuted};
          font-size: 14px;
        }

        .rest-day-notes {
          font-size: 13px;
          color: ${colors.textMuted};
          margin-top: 4px;
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: ${isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(245, 158, 11, 0.1)'};
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .empty-title {
          font-size: 18px;
          font-weight: 600;
          color: ${colors.text};
          margin-bottom: 8px;
        }

        .empty-text {
          font-size: 14px;
          color: ${colors.textMuted};
          max-width: 260px;
          margin: 0 auto;
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 468px;
          background: ${colors.bgCard};
          border-radius: 20px;
          padding: 12px 20px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 -2px 10px rgba(0,0,0,0.05)'};
          z-index: 100;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          text-decoration: none;
        }

        .nav-label {
          font-size: 10px;
          font-weight: 600;
        }
      `}</style>

      <div className="plans-content">
        {/* Header */}
        <header className="header">
          <Link href="/dashboard" className="back-btn">
            <Icons.chevronLeft size={20} color={colors.textSecondary} />
          </Link>
          <div className="header-info">
            <h1 className="program-name">{program.name}</h1>
            {program.description && (
              <p className="program-desc">{program.description}</p>
            )}
          </div>
          <Link href="/workouts/history" className="back-btn" title="Workout History">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </Link>
        </header>

        {/* Week Selector */}
        <div className="week-selector">
          {weeks.map(week => (
            <button
              key={week.id}
              onClick={() => setSelectedWeek(week.week_number)}
              className={`week-btn ${selectedWeek === week.week_number ? 'active' : 'inactive'}`}
            >
              Week {week.week_number}
            </button>
          ))}
        </div>

        {/* Workouts List */}
        {weeks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <span style={{ fontSize: 28 }}>⚠️</span>
            </div>
            <h2 className="empty-title">Program Not Ready</h2>
            <p className="empty-text">
              Your coach is still building this program. Check back soon for your workouts!
            </p>
          </div>
        ) : currentWeekData ? (
          <div>
            {currentWeekData.workout_days.map(day => {
              const completed = isWorkoutCompleted(day.id)
              const started = isWorkoutStarted(day.id)
              const exercisesBySection = groupExercisesBySection(day.workout_exercises)
              const isExpanded = expandedDays.has(day.id)
              const exerciseCount = day.workout_exercises.length

              return (
                <div
                  key={day.id}
                  className={`workout-card ${completed ? 'completed' : started ? 'started' : ''}`}
                >
                  {/* Day Header */}
                  <div
                    className={`workout-header ${day.is_rest_day ? 'rest-day' : ''}`}
                    onClick={() => !day.is_rest_day && toggleDay(day.id)}
                  >
                    <div className={`day-number ${
                      completed ? 'completed' :
                        started ? 'started' :
                          day.is_rest_day ? 'rest' : 'default'
                    }`}>
                      {completed ? (
                        <Icons.check size={20} color="white" />
                      ) : (
                        day.day_number
                      )}
                    </div>
                    <div className="workout-info">
                      <div className="workout-name">{day.name}</div>
                      {day.subtitle ? (
                        <div className="workout-subtitle">{day.subtitle}</div>
                      ) : !day.is_rest_day && (
                        <div className="workout-subtitle">{exerciseCount} exercises</div>
                      )}
                    </div>
                    {!day.is_rest_day && (
                      <div className="workout-actions">
                        <Link
                          href={`/workouts/${day.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className={`start-btn ${
                            completed ? 'completed' :
                              started ? 'started' : 'default'
                          }`}>
                            {completed ? 'View' : started ? 'Continue' : 'Start'}
                          </button>
                        </Link>
                        <div className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                          <Icons.chevronDown size={18} color={colors.textMuted} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Rest Day Content */}
                  {day.is_rest_day && (
                    <div className="rest-day-text">
                      Rest Day
                      {day.rest_day_notes && (
                        <div className="rest-day-notes">{day.rest_day_notes}</div>
                      )}
                    </div>
                  )}

                  {/* Exercises Content */}
                  {!day.is_rest_day && isExpanded && (
                    <div className="workout-content">
                      {sectionOrder.map(sectionKey => {
                        const exercises = exercisesBySection[sectionKey]
                        if (!exercises || exercises.length === 0) return null

                        return (
                          <div key={sectionKey}>
                            <div className="section-title">
                              {sectionLabels[sectionKey] || sectionKey}
                            </div>
                            {exercises.map(ex => (
                              <div key={ex.id} className="exercise-row">
                                <div className="exercise-left">
                                  {ex.label && (
                                    <span className="exercise-label">{ex.label}</span>
                                  )}
                                  <span className="exercise-name">{ex.exercises.name}</span>
                                </div>
                                <span className="exercise-reps">
                                  {ex.sets && `${ex.sets}×`}
                                  {ex.reps || ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p className="empty-text">No workouts found for this week.</p>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <Link href="/dashboard" className="nav-item">
          <Icons.home size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Home</span>
        </Link>
        <Link href="/dashboard" className="nav-item">
          <Icons.calendar size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Calendar</span>
        </Link>
        <div className="nav-item">
          <Icons.dumbbell size={22} color={colors.purple} />
          <span className="nav-label" style={{ color: colors.purple }}>Plans</span>
        </div>
        <Link href="/settings" className="nav-item">
          <Icons.user size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Account</span>
        </Link>
      </nav>
    </div>
  )
}
