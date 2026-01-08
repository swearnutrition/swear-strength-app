'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { HabitModal } from './HabitModal'
import { ImportHabitModal } from './ImportHabitModal'
import { AssignHabitModal } from './AssignHabitModal'

type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'times_per_week' | 'specific_days' | 'biweekly'
export type HabitCategory = 'nutrition' | 'fitness' | 'sleep' | 'mindset' | 'lifestyle' | 'tracking'

export interface HabitTemplate {
  id: string
  name: string
  description: string | null
  frequency: HabitFrequency
  times_per_week: number | null
  specific_days: number[] | null
  target_value: number | null
  target_unit: string | null
  category: HabitCategory | null
  is_archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface HabitStats {
  assignments: number
  activeAssignments: number
  completions: number
  completionRate: number
}

interface HabitsClientProps {
  habits: HabitTemplate[]
  habitStats?: Record<string, HabitStats>
}

export const categoryLabels: Record<HabitCategory, string> = {
  nutrition: 'Nutrition',
  fitness: 'Fitness',
  sleep: 'Sleep',
  mindset: 'Mindset',
  lifestyle: 'Lifestyle',
  tracking: 'Tracking',
}

export const categoryColors: Record<HabitCategory, string> = {
  nutrition: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  fitness: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
  sleep: 'bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400',
  mindset: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
  lifestyle: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
  tracking: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
}

export function HabitsClient({ habits: initialHabits, habitStats }: HabitsClientProps) {
  const [habits, setHabits] = useState(initialHabits)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<HabitCategory | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [editingHabit, setEditingHabit] = useState<HabitTemplate | null>(null)
  const [selectedHabits, setSelectedHabits] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filteredHabits = habits.filter((h) => {
    if (!h.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (categoryFilter !== 'all' && h.category !== categoryFilter) return false
    return true
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this habit?')) return

    await supabase
      .from('habit_templates')
      .update({ is_archived: true })
      .eq('id', id)

    setHabits(habits.filter((h) => h.id !== id))
  }

  const handleDuplicate = async (habit: HabitTemplate) => {
    const { data: userData } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('habit_templates')
      .insert({
        name: `${habit.name} (Copy)`,
        description: habit.description,
        frequency: habit.frequency,
        times_per_week: habit.times_per_week,
        specific_days: habit.specific_days,
        target_value: habit.target_value,
        target_unit: habit.target_unit,
        category: habit.category,
        created_by: userData.user?.id,
      })
      .select()
      .single()

    if (data && !error) {
      setHabits([data, ...habits])
    }
  }

  const handleSave = async (habit: Partial<HabitTemplate>) => {
    const { data: userData } = await supabase.auth.getUser()

    if (editingHabit) {
      const { data, error } = await supabase
        .from('habit_templates')
        .update({
          name: habit.name,
          description: habit.description,
          frequency: habit.frequency,
          times_per_week: habit.times_per_week,
          specific_days: habit.specific_days,
          target_value: habit.target_value,
          target_unit: habit.target_unit,
          category: habit.category,
        })
        .eq('id', editingHabit.id)
        .select()
        .single()

      if (data && !error) {
        setHabits(habits.map(h => h.id === editingHabit.id ? data : h))
      }
    } else {
      const { data, error } = await supabase
        .from('habit_templates')
        .insert({
          name: habit.name,
          description: habit.description,
          frequency: habit.frequency || 'daily',
          times_per_week: habit.times_per_week,
          specific_days: habit.specific_days,
          target_value: habit.target_value,
          target_unit: habit.target_unit,
          category: habit.category,
          created_by: userData.user?.id,
        })
        .select()
        .single()

      if (data && !error) {
        setHabits([data, ...habits])
      }
    }

    setShowModal(false)
    setEditingHabit(null)
  }

  const openCreate = () => {
    setEditingHabit(null)
    setShowModal(true)
  }

  const openEdit = (habit: HabitTemplate) => {
    if (isSelectionMode) return
    setEditingHabit(habit)
    setShowModal(true)
  }

  const toggleSelection = (habitId: string) => {
    setSelectedHabits(prev =>
      prev.includes(habitId)
        ? prev.filter(id => id !== habitId)
        : [...prev, habitId]
    )
  }

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    if (isSelectionMode) {
      setSelectedHabits([])
    }
  }

  const selectAll = () => {
    setSelectedHabits(filteredHabits.map(h => h.id))
  }

  const clearSelection = () => {
    setSelectedHabits([])
  }

  const getSelectedHabits = () => {
    return habits.filter(h => selectedHabits.includes(h.id))
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/coach" className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Habits</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectionMode}
                className={`flex items-center gap-2 font-medium py-2 px-4 rounded-xl transition-all ${
                  isSelectionMode
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isSelectionMode ? 'Done' : 'Select'}
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import
              </button>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Habit
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Selection Actions Bar */}
      {isSelectionMode && selectedHabits.length > 0 && (
        <div className="sticky top-16 z-30 bg-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium">{selectedHabits.length} selected</span>
              <button onClick={selectAll} className="text-purple-200 hover:text-white text-sm">
                Select all
              </button>
              <button onClick={clearSelection} className="text-purple-200 hover:text-white text-sm">
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Assign to Clients
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search habits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All
          </button>
          {(['nutrition', 'fitness', 'sleep', 'mindset', 'lifestyle', 'tracking'] as HabitCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                categoryFilter === cat
                  ? categoryColors[cat]
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {categoryLabels[cat]}
            </button>
          ))}
        </div>

        {/* Habit Insights */}
        {habitStats && Object.keys(habitStats).length > 0 && (
          <HabitInsights habits={habits} habitStats={habitStats} />
        )}

        <p className="text-slate-500 text-sm mb-4">
          {filteredHabits.length} habit{filteredHabits.length !== 1 ? 's' : ''}
        </p>

        {filteredHabits.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-slate-500">No habits found</p>
            <button
              onClick={openCreate}
              className="mt-4 text-purple-600 hover:text-purple-500 font-medium"
            >
              Create your first habit
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredHabits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                isSelectionMode={isSelectionMode}
                isSelected={selectedHabits.includes(habit.id)}
                onSelect={() => toggleSelection(habit.id)}
                onEdit={() => openEdit(habit)}
                onDelete={() => handleDelete(habit.id)}
                onDuplicate={() => handleDuplicate(habit)}
                onAssign={() => {
                  setSelectedHabits([habit.id])
                  setShowAssignModal(true)
                }}
              />
            ))}
          </div>
        )}
      </main>

      <HabitModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingHabit(null)
        }}
        onSave={handleSave}
        habit={editingHabit}
      />

      <ImportHabitModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          setShowImportModal(false)
          router.refresh()
        }}
      />

      <AssignHabitModal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false)
          if (!isSelectionMode) setSelectedHabits([])
        }}
        habits={getSelectedHabits()}
        onSuccess={() => {
          setShowAssignModal(false)
          setSelectedHabits([])
          setIsSelectionMode(false)
        }}
      />
    </div>
  )
}

function HabitCard({
  habit,
  isSelectionMode,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onAssign,
}: {
  habit: HabitTemplate
  isSelectionMode: boolean
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  onAssign: () => void
}) {
  const handleClick = () => {
    if (isSelectionMode) {
      onSelect()
    } else {
      onEdit()
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer bg-white dark:bg-slate-900/50 border-2 rounded-xl p-5 transition-all group shadow-sm ${
        isSelected
          ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isSelectionMode && (
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              isSelected
                ? 'bg-purple-600 text-white'
                : 'border-2 border-slate-300 dark:border-slate-600'
            }`}>
              {isSelected && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )}
          {habit.category && (
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${categoryColors[habit.category]}`}>
              {categoryLabels[habit.category]}
            </span>
          )}
        </div>
        {!isSelectionMode && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAssign()
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
              title="Assign to clients"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate()
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Duplicate"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              title="Archive"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{habit.name}</h3>

      {habit.description && (
        <p className="text-slate-500 text-sm line-clamp-2 mb-3">{habit.description}</p>
      )}

      {habit.target_value && habit.target_unit && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>Target: {habit.target_value} {habit.target_unit}</span>
        </div>
      )}
    </div>
  )
}

function HabitInsights({
  habits,
  habitStats,
}: {
  habits: HabitTemplate[]
  habitStats: Record<string, HabitStats>
}) {
  // Filter habits that have been assigned at least once
  const assignedHabits = habits.filter((h) => habitStats[h.id]?.assignments > 0)

  if (assignedHabits.length === 0) {
    return null
  }

  // Sort by completion rate for most/least completed
  const sortedByCompletion = [...assignedHabits].sort(
    (a, b) => (habitStats[b.id]?.completionRate || 0) - (habitStats[a.id]?.completionRate || 0)
  )

  // Sort by assignments for popularity
  const sortedByPopularity = [...assignedHabits].sort(
    (a, b) => (habitStats[b.id]?.assignments || 0) - (habitStats[a.id]?.assignments || 0)
  )

  // Get difficulty ranking (inverse of completion rate - lower completion = harder)
  const sortedByDifficulty = [...assignedHabits]
    .filter((h) => habitStats[h.id]?.activeAssignments > 0)
    .sort((a, b) => (habitStats[a.id]?.completionRate || 0) - (habitStats[b.id]?.completionRate || 0))

  const topCompleted = sortedByCompletion.slice(0, 3)
  const leastCompleted = sortedByCompletion.slice(-3).reverse()
  const mostPopular = sortedByPopularity.slice(0, 3)
  const hardest = sortedByDifficulty.slice(0, 3)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      {/* Most Completed */}
      <div
        className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Top Completed</h3>
        </div>
        <div className="space-y-2">
          {topCompleted.map((habit, i) => (
            <div key={habit.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">{i + 1}.</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                  {habit.name}
                </span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {habitStats[habit.id]?.completionRate}%
              </span>
            </div>
          ))}
          {topCompleted.length === 0 && (
            <p className="text-xs text-slate-400">No data yet</p>
          )}
        </div>
      </div>

      {/* Least Completed */}
      <div
        className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Needs Attention</h3>
        </div>
        <div className="space-y-2">
          {leastCompleted.map((habit, i) => (
            <div key={habit.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">{i + 1}.</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                  {habit.name}
                </span>
              </div>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {habitStats[habit.id]?.completionRate}%
              </span>
            </div>
          ))}
          {leastCompleted.length === 0 && (
            <p className="text-xs text-slate-400">No data yet</p>
          )}
        </div>
      </div>

      {/* Most Popular */}
      <div
        className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/20">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Most Popular</h3>
        </div>
        <div className="space-y-2">
          {mostPopular.map((habit, i) => (
            <div key={habit.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">{i + 1}.</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                  {habit.name}
                </span>
              </div>
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                {habitStats[habit.id]?.assignments} assigned
              </span>
            </div>
          ))}
          {mostPopular.length === 0 && (
            <p className="text-xs text-slate-400">No data yet</p>
          )}
        </div>
      </div>

      {/* Hardest Habits */}
      <div
        className="bg-white dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-500/20">
            <svg className="w-4 h-4 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Hardest Habits</h3>
        </div>
        <div className="space-y-2">
          {hardest.map((habit, i) => (
            <div key={habit.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">{i + 1}.</span>
                <span className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                  {habit.name}
                </span>
              </div>
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {habitStats[habit.id]?.completionRate}% rate
              </span>
            </div>
          ))}
          {hardest.length === 0 && (
            <p className="text-xs text-slate-400">No active habits</p>
          )}
        </div>
      </div>
    </div>
  )
}
