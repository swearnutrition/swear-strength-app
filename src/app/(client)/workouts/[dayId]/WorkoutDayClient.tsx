'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Exercise {
  id: string
  name: string
  equipment: string | null
  demo_url: string | null
  cues: string | null
  instructions: string | null
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
  workout_exercises: WorkoutExercise[]
}

interface WorkoutLog {
  id: string
  started_at: string
  completed_at: string | null
}

interface SetLog {
  id: string
  workout_exercise_id: string
  set_number: number
  weight: number | null
  reps_completed: number | null
  is_bodyweight: boolean
  notes: string | null
}

interface WorkoutDayClientProps {
  workoutDay: WorkoutDay
  workoutLog: WorkoutLog
  setLogs: SetLog[]
  programName: string
  weekNumber: number
}

interface SetData {
  weight: string
  reps: string
  completed: boolean
}

const sectionOrder = ['warmup', 'strength', 'cardio', 'cooldown']
const sectionLabels: Record<string, string> = {
  warmup: 'Warm-up',
  strength: 'Strength',
  cardio: 'Cardio',
  cooldown: 'Cool-down',
}

export function WorkoutDayClient({
  workoutDay,
  workoutLog,
  setLogs,
  programName,
  weekNumber,
}: WorkoutDayClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // Initialize sets data from existing logs or empty
  const initializeSetsData = () => {
    const data: Record<string, SetData[]> = {}
    workoutDay.workout_exercises.forEach(ex => {
      const numSets = parseInt(ex.sets?.split('-')[0] || '3', 10)
      const existingLogs = setLogs.filter(log => log.workout_exercise_id === ex.id)

      data[ex.id] = Array.from({ length: numSets }, (_, i) => {
        const existingLog = existingLogs.find(log => log.set_number === i + 1)
        return {
          weight: existingLog?.weight?.toString() || ex.weight || '',
          reps: existingLog?.reps_completed?.toString() || '',
          completed: !!existingLog,
        }
      })
    })
    return data
  }

  const [setsData, setSetsData] = useState<Record<string, SetData[]>>(initializeSetsData)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Timer effect
  useEffect(() => {
    const startTime = new Date(workoutLog.started_at).getTime()
    const interval = setInterval(() => {
      const now = Date.now()
      setElapsedTime(Math.floor((now - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [workoutLog.started_at])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSetChange = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string) => {
    setSetsData(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((set, i) =>
        i === setIndex ? { ...set, [field]: value } : set
      ),
    }))
  }

  const handleSetComplete = async (exerciseId: string, setIndex: number) => {
    const setData = setsData[exerciseId][setIndex]

    setSaving(true)

    // Check if log already exists
    const existingLog = setLogs.find(
      log => log.workout_exercise_id === exerciseId && log.set_number === setIndex + 1
    )

    if (existingLog) {
      // Update existing
      await supabase
        .from('set_logs')
        .update({
          weight: setData.weight ? parseFloat(setData.weight) : null,
          reps_completed: setData.reps ? parseInt(setData.reps, 10) : null,
        })
        .eq('id', existingLog.id)
    } else {
      // Create new
      await supabase.from('set_logs').insert({
        workout_log_id: workoutLog.id,
        workout_exercise_id: exerciseId,
        set_number: setIndex + 1,
        weight: setData.weight ? parseFloat(setData.weight) : null,
        reps_completed: setData.reps ? parseInt(setData.reps, 10) : null,
        is_bodyweight: setData.weight === 'BW' || !setData.weight,
      })
    }

    setSetsData(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((set, i) =>
        i === setIndex ? { ...set, completed: true } : set
      ),
    }))

    setSaving(false)
  }

  const handleCompleteWorkout = async () => {
    setCompleting(true)

    await supabase
      .from('workout_logs')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', workoutLog.id)

    router.push('/workouts')
    router.refresh()
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

  const exercisesBySection = groupExercisesBySection(workoutDay.workout_exercises)

  const totalSets = Object.values(setsData).flat().length
  const completedSets = Object.values(setsData).flat().filter(s => s.completed).length
  const progress = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Link href="/workouts" className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">{workoutDay.name}</h1>
                <p className="text-sm text-slate-500">Week {weekNumber} - {programName}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-mono font-bold text-purple-600 dark:text-purple-400">
                {formatTime(elapsedTime)}
              </div>
              <div className="text-xs text-slate-400">Duration</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {completedSets}/{totalSets}
            </span>
          </div>
        </div>
      </header>

      {/* Exercises */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {sectionOrder.map(sectionKey => {
          const exercises = exercisesBySection[sectionKey]
          if (!exercises || exercises.length === 0) return null

          return (
            <div key={sectionKey}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {sectionLabels[sectionKey] || sectionKey}
              </h2>
              <div className="space-y-3">
                {exercises.map(ex => {
                  const sets = setsData[ex.id] || []
                  const allCompleted = sets.every(s => s.completed)
                  const isExpanded = expandedExercise === ex.id

                  return (
                    <div
                      key={ex.id}
                      className={`bg-white dark:bg-slate-900 rounded-2xl border overflow-hidden transition-all ${
                        allCompleted
                          ? 'border-emerald-200 dark:border-emerald-500/30'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {/* Exercise header */}
                      <button
                        onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}
                        className="w-full p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          {ex.label && (
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-2 py-1 rounded">
                              {ex.label}
                            </span>
                          )}
                          <div className="text-left">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                              {ex.exercises.name}
                            </h3>
                            <p className="text-sm text-slate-500">
                              {ex.sets}×{ex.reps} {ex.weight && `@ ${ex.weight}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {allCompleted && (
                            <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                          <svg
                            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-4">
                          {/* Exercise notes/cues */}
                          {(ex.notes || ex.exercises.cues) && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-600 dark:text-slate-400">
                              {ex.notes || ex.exercises.cues}
                            </div>
                          )}

                          {/* Sets table */}
                          <div className="space-y-2">
                            <div className="grid grid-cols-4 gap-2 text-xs font-medium text-slate-400 uppercase px-2">
                              <span>Set</span>
                              <span>Weight</span>
                              <span>Reps</span>
                              <span></span>
                            </div>
                            {sets.map((set, i) => (
                              <div
                                key={i}
                                className={`grid grid-cols-4 gap-2 items-center p-2 rounded-xl transition-all ${
                                  set.completed
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10'
                                    : 'bg-slate-50 dark:bg-slate-800/50'
                                }`}
                              >
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                  {i + 1}
                                </span>
                                <input
                                  type="text"
                                  value={set.weight}
                                  onChange={(e) => handleSetChange(ex.id, i, 'weight', e.target.value)}
                                  placeholder={ex.weight || 'lbs'}
                                  disabled={set.completed}
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-center disabled:opacity-50"
                                />
                                <input
                                  type="text"
                                  value={set.reps}
                                  onChange={(e) => handleSetChange(ex.id, i, 'reps', e.target.value)}
                                  placeholder={ex.reps || 'reps'}
                                  disabled={set.completed}
                                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-center disabled:opacity-50"
                                />
                                <button
                                  onClick={() => handleSetComplete(ex.id, i)}
                                  disabled={set.completed || saving}
                                  className={`w-full py-1.5 rounded-lg text-sm font-medium transition-all ${
                                    set.completed
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50'
                                  }`}
                                >
                                  {set.completed ? (
                                    <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : (
                                    'Log'
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Rest timer suggestion */}
                          {ex.rest_seconds && (
                            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Rest: {ex.rest_seconds}s between sets
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </main>

      {/* Complete Workout Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleCompleteWorkout}
            disabled={completing || progress === 0}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-slate-400 disabled:to-slate-300 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-emerald-500/30 transition-all"
          >
            {completing ? 'Completing...' : `Complete Workout (${progress}%)`}
          </button>
        </div>
      </div>
    </div>
  )
}
