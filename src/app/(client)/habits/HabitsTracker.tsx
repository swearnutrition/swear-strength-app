'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'times_per_week' | 'specific_days' | 'biweekly'
type HabitCategory = 'nutrition' | 'fitness' | 'sleep' | 'mindset' | 'lifestyle' | 'tracking'

interface HabitTemplate {
  name: string
  description: string | null
  frequency: HabitFrequency
  times_per_week: number | null
  specific_days: number[] | null
  target_value: number | null
  target_unit: string | null
  category: HabitCategory | null
}

interface ClientHabit {
  id: string
  client_id: string
  habit_template_id: string
  custom_frequency: HabitFrequency | null
  custom_times_per_week: number | null
  custom_specific_days: number[] | null
  custom_target_value: number | null
  custom_target_unit: string | null
  start_date: string
  end_date: string | null
  notes: string | null
  is_active: boolean
  habit_templates: HabitTemplate
}

interface Completion {
  id: string
  client_habit_id: string
  completed_date: string
  value: number | null
  note: string | null
}

interface HabitsTrackerProps {
  habits: ClientHabit[]
  todayCompletions: Completion[]
  recentCompletions: Completion[]
  initials: string
  userId: string
}

const categoryLabels: Record<HabitCategory, string> = {
  nutrition: 'Nutrition',
  fitness: 'Fitness',
  sleep: 'Sleep',
  mindset: 'Mindset',
  lifestyle: 'Lifestyle',
  tracking: 'Tracking',
}

const categoryColors: Record<HabitCategory, string> = {
  nutrition: 'bg-emerald-500',
  fitness: 'bg-rose-500',
  sleep: 'bg-violet-500',
  mindset: 'bg-amber-500',
  lifestyle: 'bg-sky-500',
  tracking: 'bg-slate-500',
}

const categoryBgColors: Record<HabitCategory, string> = {
  nutrition: 'bg-emerald-50 dark:bg-emerald-500/10',
  fitness: 'bg-rose-50 dark:bg-rose-500/10',
  sleep: 'bg-violet-50 dark:bg-violet-500/10',
  mindset: 'bg-amber-50 dark:bg-amber-500/10',
  lifestyle: 'bg-sky-50 dark:bg-sky-500/10',
  tracking: 'bg-slate-50 dark:bg-slate-500/10',
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isDueToday(habit: ClientHabit): boolean {
  const template = habit.habit_templates
  const frequency = habit.custom_frequency || template.frequency
  const today = new Date()
  const dayOfWeek = today.getDay()

  switch (frequency) {
    case 'daily':
      return true
    case 'weekly':
    case 'biweekly':
      // Due on the day they started
      const startDate = new Date(habit.start_date)
      return startDate.getDay() === dayOfWeek
    case 'specific_days':
      const days = habit.custom_specific_days || template.specific_days || []
      return days.includes(dayOfWeek)
    case 'times_per_week':
      // Always show - user can complete on any day
      return true
    case 'monthly':
      // Due on the same day of month as start date
      const startDay = new Date(habit.start_date).getDate()
      return today.getDate() === startDay
    default:
      return true
  }
}

export function HabitsTracker({ habits, todayCompletions, recentCompletions, initials, userId }: HabitsTrackerProps) {
  const [completions, setCompletions] = useState<Completion[]>(todayCompletions)
  const [loading, setLoading] = useState<string | null>(null)
  const [showValueModal, setShowValueModal] = useState<ClientHabit | null>(null)
  const [inputValue, setInputValue] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const isCompleted = (habitId: string) => {
    return completions.some(c => c.client_habit_id === habitId)
  }

  const getCompletionValue = (habitId: string) => {
    const completion = completions.find(c => c.client_habit_id === habitId)
    return completion?.value
  }

  const toggleHabit = async (habit: ClientHabit) => {
    const template = habit.habit_templates
    const targetValue = habit.custom_target_value || template.target_value

    // If habit has a target, show value modal
    if (targetValue && !isCompleted(habit.id)) {
      setShowValueModal(habit)
      setInputValue('')
      return
    }

    await completeHabit(habit.id)
  }

  const completeHabit = async (habitId: string, value?: number) => {
    setLoading(habitId)

    try {
      if (isCompleted(habitId)) {
        // Uncomplete - delete the completion
        const completion = completions.find(c => c.client_habit_id === habitId)
        if (completion) {
          await supabase
            .from('habit_completions')
            .delete()
            .eq('id', completion.id)

          setCompletions(prev => prev.filter(c => c.id !== completion.id))
        }
      } else {
        // Complete the habit
        const { data, error } = await supabase
          .from('habit_completions')
          .insert({
            client_habit_id: habitId,
            client_id: userId,
            completed_date: today,
            value: value || null,
          })
          .select()
          .single()

        if (error) throw error

        setCompletions(prev => [...prev, data])
      }
    } catch (err) {
      console.error('Error toggling habit:', err)
    } finally {
      setLoading(null)
      setShowValueModal(null)
    }
  }

  const handleValueSubmit = async () => {
    if (!showValueModal) return
    const value = parseFloat(inputValue)
    if (isNaN(value)) return

    await completeHabit(showValueModal.id, value)
  }

  // Group habits by category
  const habitsByCategory = habits.reduce((acc, habit) => {
    const category = habit.habit_templates.category || 'tracking'
    if (!acc[category]) acc[category] = []
    acc[category].push(habit)
    return acc
  }, {} as Record<HabitCategory, ClientHabit[]>)

  // Calculate stats
  const todaysDueHabits = habits.filter(isDueToday)
  const todaysCompletedCount = todaysDueHabits.filter(h => isCompleted(h.id)).length
  const todaysProgress = todaysDueHabits.length > 0
    ? Math.round((todaysCompletedCount / todaysDueHabits.length) * 100)
    : 0

  // Calculate streak (simplified - consecutive days with all habits completed)
  const calculateStreak = () => {
    // Group recent completions by date
    const completionsByDate = recentCompletions.reduce((acc, c) => {
      if (!acc[c.completed_date]) acc[c.completed_date] = []
      acc[c.completed_date].push(c.client_habit_id)
      return acc
    }, {} as Record<string, string[]>)

    let streak = 0
    const date = new Date()

    // Check if today is complete first
    if (todaysProgress === 100) {
      streak = 1
    } else if (todaysProgress > 0) {
      // Today is in progress, don't break streak yet
      streak = 0
    }

    // Check previous days
    for (let i = 1; i <= 7; i++) {
      date.setDate(date.getDate() - 1)
      const dateStr = date.toISOString().split('T')[0]
      const dayCompletions = completionsByDate[dateStr] || []

      // Check if all due habits were completed that day
      const dueHabits = habits.filter(h => {
        const freq = h.custom_frequency || h.habit_templates.frequency
        if (freq === 'daily') return true
        if (freq === 'times_per_week') return true
        // Simplified for demo
        return true
      })

      if (dayCompletions.length >= dueHabits.length && dueHabits.length > 0) {
        streak++
      } else {
        break
      }
    }

    return streak
  }

  const streak = calculateStreak()

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
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">My Habits</h1>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-lg shadow-purple-500/20">
            {initials}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Today's Summary */}
        <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg shadow-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/80 text-sm">Today's Progress</p>
              <p className="text-3xl font-bold">{todaysCompletedCount}/{todaysDueHabits.length}</p>
            </div>
            <div className="text-right">
              <p className="text-white/80 text-sm">Streak</p>
              <p className="text-3xl font-bold">{streak} days</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${todaysProgress}%` }}
            />
          </div>
          <p className="text-center text-sm text-white/80 mt-2">{todaysProgress}% complete</p>
        </div>

        {/* Habits List */}
        {habits.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500">No habits assigned yet</p>
            <p className="text-sm text-slate-400 mt-1">Your coach will assign habits for you to track</p>
          </div>
        ) : (
          Object.entries(habitsByCategory).map(([category, categoryHabits]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${categoryColors[category as HabitCategory]}`} />
                <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {categoryLabels[category as HabitCategory]}
                </h2>
              </div>

              <div className="space-y-2">
                {categoryHabits.map(habit => {
                  const template = habit.habit_templates
                  const completed = isCompleted(habit.id)
                  const completionValue = getCompletionValue(habit.id)
                  const targetValue = habit.custom_target_value || template.target_value
                  const targetUnit = habit.custom_target_unit || template.target_unit
                  const isDue = isDueToday(habit)
                  const isLoading = loading === habit.id

                  return (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit)}
                      disabled={isLoading}
                      className={`w-full text-left p-4 rounded-xl transition-all ${
                        completed
                          ? `${categoryBgColors[template.category || 'tracking']} border-2 border-transparent`
                          : 'bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      } ${!isDue ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          completed
                            ? `${categoryColors[template.category || 'tracking']} text-white`
                            : 'border-2 border-slate-300 dark:border-slate-600'
                        }`}>
                          {isLoading ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : completed ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : null}
                        </div>

                        {/* Habit info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${completed ? 'text-slate-500 line-through' : 'text-slate-900 dark:text-white'}`}>
                            {template.name}
                          </p>
                          {targetValue && (
                            <p className="text-sm text-slate-500">
                              {completed && completionValue !== null
                                ? `${completionValue} / ${targetValue} ${targetUnit || ''}`
                                : `Target: ${targetValue} ${targetUnit || ''}`
                              }
                            </p>
                          )}
                          {habit.notes && (
                            <p className="text-sm text-slate-400 truncate">{habit.notes}</p>
                          )}
                        </div>

                        {/* Frequency badge */}
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                          {habit.custom_frequency === 'specific_days' || template.frequency === 'specific_days'
                            ? (habit.custom_specific_days || template.specific_days || []).map(d => dayLabels[d][0]).join('')
                            : habit.custom_frequency === 'times_per_week' || template.frequency === 'times_per_week'
                            ? `${habit.custom_times_per_week || template.times_per_week}x/wk`
                            : habit.custom_frequency || template.frequency
                          }
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))
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
          <Link href="/habits" className="flex flex-col items-center py-2 px-4 rounded-xl text-purple-600 dark:text-purple-400">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Habits</span>
          </Link>
          <Link href="/settings" className="flex flex-col items-center py-2 px-4 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Profile</span>
          </Link>
        </div>
      </nav>

      {/* Value Input Modal */}
      {showValueModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setShowValueModal(null)}>
          <div
            className="bg-white dark:bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {showValueModal.habit_templates.name}
            </h3>
            <p className="text-sm text-slate-500">
              Target: {showValueModal.custom_target_value || showValueModal.habit_templates.target_value} {showValueModal.custom_target_unit || showValueModal.habit_templates.target_unit}
            </p>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                How much did you achieve?
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="0"
                  step="any"
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  autoFocus
                />
                <span className="text-slate-500">
                  {showValueModal.custom_target_unit || showValueModal.habit_templates.target_unit}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowValueModal(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleValueSubmit}
                disabled={!inputValue || isNaN(parseFloat(inputValue))}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
