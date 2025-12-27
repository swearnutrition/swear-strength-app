'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface WorkoutCompletion {
  id: string
  difficulty_rating: number | null
  energy_level: string | null
  feeling: number | null
  notes: string | null
}

interface WeekWorkout {
  id: string
  workout_day_id: string
  started_at: string
  completed_at: string | null
  workout_days: { name: string } | { name: string }[] | null
  workout_completions: WorkoutCompletion[]
}

interface CheckInClientProps {
  initials: string
  userId: string
  weekWorkouts: WeekWorkout[]
}

const difficultyLabels = ['Too Easy', 'Easy', 'Just Right', 'Hard', 'Too Hard']
const feelingLabels = ['Terrible', 'Not Great', 'Okay', 'Good', 'Amazing']
const energyOptions = ['Low', 'Medium', 'High']

// Helper to get workout name from workout_days which could be object or array
function getWorkoutName(workout: WeekWorkout): string {
  if (!workout.workout_days) return 'Workout'
  if (Array.isArray(workout.workout_days)) {
    return workout.workout_days[0]?.name || 'Workout'
  }
  return workout.workout_days.name || 'Workout'
}

export function CheckInClient({ initials, userId, weekWorkouts }: CheckInClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // Find workouts that need check-in (completed but no completion record)
  const workoutsNeedingCheckIn = weekWorkouts.filter(
    w => w.completed_at && w.workout_completions.length === 0
  )

  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  // Form state for current workout
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [energy, setEnergy] = useState<string | null>(null)
  const [feeling, setFeeling] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const currentWorkout = workoutsNeedingCheckIn[currentIndex]

  const resetForm = () => {
    setDifficulty(null)
    setEnergy(null)
    setFeeling(null)
    setNotes('')
  }

  const handleSubmit = async () => {
    if (!currentWorkout) return

    setSaving(true)

    try {
      await supabase.from('workout_completions').insert({
        workout_log_id: currentWorkout.id,
        difficulty_rating: difficulty,
        energy_level: energy,
        feeling: feeling,
        notes: notes || null,
      })

      if (currentIndex < workoutsNeedingCheckIn.length - 1) {
        setCurrentIndex(prev => prev + 1)
        resetForm()
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (err) {
      console.error('Error saving check-in:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    if (currentIndex < workoutsNeedingCheckIn.length - 1) {
      setCurrentIndex(prev => prev + 1)
      resetForm()
    } else {
      router.push('/dashboard')
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }

  // Already checked in workouts
  const checkedInWorkouts = weekWorkouts.filter(
    w => w.completed_at && w.workout_completions.length > 0
  )

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Weekly Check-in</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-purple-500/20">
            {initials}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {workoutsNeedingCheckIn.length === 0 ? (
          // All caught up state
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">All Caught Up!</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              {checkedInWorkouts.length > 0
                ? `You've checked in for ${checkedInWorkouts.length} workout${checkedInWorkouts.length > 1 ? 's' : ''} this week.`
                : "No completed workouts to check in for yet this week."}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-500 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : (
          <>
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2">
              {workoutsNeedingCheckIn.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentIndex
                      ? 'w-8 bg-purple-600'
                      : i < currentIndex
                      ? 'bg-emerald-500'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Current workout card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(currentWorkout.started_at)}
                </p>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {getWorkoutName(currentWorkout)}
                </h2>
              </div>

              <div className="p-5 space-y-6">
                {/* Difficulty Rating */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    How was the difficulty?
                  </label>
                  <div className="flex gap-2">
                    {difficultyLabels.map((label, i) => (
                      <button
                        key={i}
                        onClick={() => setDifficulty(i + 1)}
                        className={`flex-1 py-2 px-1 rounded-xl text-xs font-medium transition-all ${
                          difficulty === i + 1
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Energy Level */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Energy level during workout
                  </label>
                  <div className="flex gap-2">
                    {energyOptions.map((option) => (
                      <button
                        key={option}
                        onClick={() => setEnergy(option)}
                        className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                          energy === option
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feeling Rating */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    How do you feel after?
                  </label>
                  <div className="flex gap-2">
                    {feelingLabels.map((label, i) => (
                      <button
                        key={i}
                        onClick={() => setFeeling(i + 1)}
                        className={`flex-1 py-2 px-1 rounded-xl text-xs font-medium transition-all ${
                          feeling === i + 1
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Any notes for your coach? (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Share how the workout went, any struggles, or wins..."
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : currentIndex < workoutsNeedingCheckIn.length - 1 ? 'Next' : 'Done'}
              </button>
            </div>
          </>
        )}

        {/* Previously checked in workouts */}
        {checkedInWorkouts.length > 0 && workoutsNeedingCheckIn.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
              Already Checked In
            </h3>
            <div className="space-y-2">
              {checkedInWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                      {getWorkoutName(workout)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(workout.started_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-around">
          <Link href="/dashboard" className="flex flex-col items-center py-2 px-4 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs mt-1 font-medium">Home</span>
          </Link>
          <Link href="/workouts" className="flex flex-col items-center py-2 px-4 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Workouts</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center py-2 px-4 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
