'use client'

import { useState } from 'react'
import Link from 'next/link'

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
  demo_url: string | null
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

export function WorkoutsClient({ program, assignment, weeks, workoutLogs }: WorkoutsClientProps) {
  const [selectedWeek, setSelectedWeek] = useState(assignment.current_week)

  const currentWeekData = weeks.find(w => w.week_number === selectedWeek)

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">{program.name}</h1>
              {program.description && (
                <p className="text-sm text-slate-500 line-clamp-1">{program.description}</p>
              )}
            </div>
          </div>

          {/* Week selector */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {weeks.map(week => (
              <button
                key={week.id}
                onClick={() => setSelectedWeek(week.week_number)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedWeek === week.week_number
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Week {week.week_number}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {currentWeekData ? (
          <div className="space-y-4">
            {currentWeekData.workout_days.map(day => {
              const completed = isWorkoutCompleted(day.id)
              const started = isWorkoutStarted(day.id)
              const exercisesBySection = groupExercisesBySection(day.workout_exercises)

              return (
                <div
                  key={day.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden ${
                    completed
                      ? 'border-emerald-200 dark:border-emerald-500/30'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Day Header */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                            completed
                              ? 'bg-emerald-500 text-white'
                              : started
                              ? 'bg-amber-500 text-white'
                              : day.is_rest_day
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {completed ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            day.day_number
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{day.name}</h3>
                          {day.subtitle && (
                            <p className="text-sm text-slate-500">{day.subtitle}</p>
                          )}
                        </div>
                      </div>
                      {!day.is_rest_day && (
                        <Link
                          href={`/workouts/${day.id}`}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                            completed
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : started
                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-purple-600 text-white hover:bg-purple-500'
                          }`}
                        >
                          {completed ? 'View' : started ? 'Continue' : 'Start'}
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Day Content */}
                  {day.is_rest_day ? (
                    <div className="p-4 text-center">
                      <p className="text-slate-500">Rest Day</p>
                      {day.rest_day_notes && (
                        <p className="text-sm text-slate-400 mt-1">{day.rest_day_notes}</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {sectionOrder.map(sectionKey => {
                        const exercises = exercisesBySection[sectionKey]
                        if (!exercises || exercises.length === 0) return null

                        return (
                          <div key={sectionKey}>
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                              {sectionLabels[sectionKey] || sectionKey}
                            </h4>
                            <div className="space-y-2">
                              {exercises.map(ex => (
                                <div
                                  key={ex.id}
                                  className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
                                >
                                  <div className="flex items-center gap-3">
                                    {ex.label && (
                                      <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-2 py-0.5 rounded">
                                        {ex.label}
                                      </span>
                                    )}
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                      {ex.exercises.name}
                                    </span>
                                  </div>
                                  <span className="text-sm text-slate-500">
                                    {ex.sets && `${ex.sets}×`}
                                    {ex.reps || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
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
          <div className="text-center py-12">
            <p className="text-slate-500">No workouts found for this week.</p>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-around">
          {[
            { name: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', active: false, href: '/dashboard' },
            { name: 'Workouts', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', active: true, href: '/workouts' },
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
    </div>
  )
}
