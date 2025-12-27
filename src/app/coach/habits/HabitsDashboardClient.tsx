'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Client {
  id: string
  name: string | null
  email: string | null
  avatar_url: string | null
}

interface HabitTemplate {
  id: string
  name: string
  category: string | null
}

interface ClientHabit {
  id: string
  client_id: string
  habit_template_id: string
  frequency: string
  is_active: boolean
  habit: HabitTemplate | null
  client: Client | null
}

interface Completion {
  id: string
  client_habit_id: string
  completed_date: string
  value: number | null
}

interface Rivalry {
  id: string
  name: string
  challenger_id: string
  opponent_id: string
  start_date: string
  end_date: string
  status: string
  challenger: { id: string; name: string | null; avatar_url: string | null } | null
  opponent: { id: string; name: string | null; avatar_url: string | null } | null
}

interface HabitsDashboardClientProps {
  clients: Client[]
  clientHabits: ClientHabit[]
  completions: Completion[]
  rivalries: Rivalry[]
}

export function HabitsDashboardClient({
  clients,
  clientHabits,
  completions,
  rivalries,
}: HabitsDashboardClientProps) {
  const [selectedClient, setSelectedClient] = useState<string | 'all'>('all')
  const [expandedClient, setExpandedClient] = useState<string | null>(null)
  const [removingHabit, setRemovingHabit] = useState<string | null>(null)
  const [localClientHabits, setLocalClientHabits] = useState(clientHabits)
  const [showArchived, setShowArchived] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const removeHabit = async (clientHabitId: string) => {
    if (!confirm('Remove this habit from the client? This will also delete all completion history for this habit.')) return

    setRemovingHabit(clientHabitId)
    try {
      // First delete completions for this habit
      await supabase
        .from('habit_completions')
        .delete()
        .eq('client_habit_id', clientHabitId)

      // Then delete the client habit assignment
      const { error } = await supabase
        .from('client_habits')
        .delete()
        .eq('id', clientHabitId)

      if (error) throw error

      // Update local state
      setLocalClientHabits(prev => prev.filter(ch => ch.id !== clientHabitId))
    } catch (err) {
      console.error('Error removing habit:', err)
      alert('Failed to remove habit')
    } finally {
      setRemovingHabit(null)
    }
  }

  const archiveHabit = async (clientHabitId: string) => {
    setRemovingHabit(clientHabitId)
    try {
      const { error } = await supabase
        .from('client_habits')
        .update({ is_active: false })
        .eq('id', clientHabitId)

      if (error) throw error

      // Update local state
      setLocalClientHabits(prev => prev.map(ch =>
        ch.id === clientHabitId ? { ...ch, is_active: false } : ch
      ))
    } catch (err) {
      console.error('Error archiving habit:', err)
      alert('Failed to archive habit')
    } finally {
      setRemovingHabit(null)
    }
  }

  const reactivateHabit = async (clientHabitId: string) => {
    setRemovingHabit(clientHabitId)
    try {
      const { error } = await supabase
        .from('client_habits')
        .update({ is_active: true })
        .eq('id', clientHabitId)

      if (error) throw error

      // Update local state
      setLocalClientHabits(prev => prev.map(ch =>
        ch.id === clientHabitId ? { ...ch, is_active: true } : ch
      ))
    } catch (err) {
      console.error('Error reactivating habit:', err)
      alert('Failed to reactivate habit')
    } finally {
      setRemovingHabit(null)
    }
  }

  // Calculate stats
  const totalHabitsAssigned = localClientHabits.filter(ch => ch.is_active).length
  const archivedHabitsCount = localClientHabits.filter(ch => !ch.is_active).length
  const clientsWithHabits = new Set(localClientHabits.filter(ch => ch.is_active).map((ch) => ch.client_id)).size
  const activeRivalries = rivalries.length

  // Get last 7 days for the chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return date.toISOString().split('T')[0]
  })

  // Calculate completion rate per day
  const completionsByDay = last7Days.map((day) => {
    const dayCompletions = completions.filter((c) => c.completed_date === day)
    return {
      date: day,
      count: dayCompletions.length,
      label: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
    }
  })

  const maxCompletions = Math.max(...completionsByDay.map((d) => d.count), 1)

  // Group habits by client
  const habitsByClient = localClientHabits.reduce(
    (acc, ch) => {
      const clientId = ch.client_id
      if (!acc[clientId]) {
        acc[clientId] = {
          client: ch.client,
          habits: [],
          completionCount: 0,
        }
      }
      acc[clientId].habits.push(ch)
      return acc
    },
    {} as Record<string, { client: Client | null; habits: ClientHabit[]; completionCount: number }>
  )

  // Count completions per client
  completions.forEach((c) => {
    const habit = localClientHabits.find((ch) => ch.id === c.client_habit_id)
    if (habit && habitsByClient[habit.client_id]) {
      habitsByClient[habit.client_id].completionCount++
    }
  })

  // Sort clients by completion count
  const sortedClients = Object.entries(habitsByClient)
    .sort(([, a], [, b]) => b.completionCount - a.completionCount)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Habits</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Track client habit progress and consistency
          </p>
        </div>
        <div className="flex items-center gap-3">
          {archivedHabitsCount > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 font-medium py-2.5 px-4 rounded-xl border transition-all ${
                showArchived
                  ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              {showArchived ? 'Hide Archived' : 'Archived'}
              <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                {archivedHabitsCount}
              </span>
            </button>
          )}
          <Link
            href="/coach/habits/rivalries"
            className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Rivalries
            {activeRivalries > 0 && (
              <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                {activeRivalries}
              </span>
            )}
          </Link>
          <Link
            href="/coach/habits/library"
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Assign Habits
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalHabitsAssigned}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Habits Assigned</p>
            </div>
          </div>
        </div>

        <div
          className="bg-white dark:bg-slate-900 rounded-2xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{clientsWithHabits}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Clients Tracking</p>
            </div>
          </div>
        </div>

        <div
          className="bg-white dark:bg-slate-900 rounded-2xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{completions.length}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Completions (7 days)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Completion Chart */}
        <div
          className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            Weekly Completions
          </h3>
          <div className="flex items-end justify-between h-40 gap-2">
            {completionsByDay.map((day, i) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-indigo-100 dark:bg-indigo-500/20 rounded-t-lg transition-all"
                  style={{
                    height: `${(day.count / maxCompletions) * 100}%`,
                    minHeight: day.count > 0 ? '8px' : '2px',
                    background: day.count > 0
                      ? 'linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%)'
                      : undefined,
                  }}
                />
                <span className="text-xs text-slate-400">{day.label}</span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  {day.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Active Rivalries */}
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl p-6"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Active Rivalries
            </h3>
            <Link
              href="/coach/habits/rivalries"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-medium"
            >
              View all
            </Link>
          </div>
          {rivalries.length > 0 ? (
            <div className="space-y-3">
              {rivalries.slice(0, 3).map((rivalry) => (
                <div
                  key={rivalry.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex -space-x-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white dark:border-slate-900"
                      style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                    >
                      {rivalry.challenger?.name?.[0] || 'C'}
                    </div>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold border-2 border-white dark:border-slate-900"
                      style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' }}
                    >
                      {rivalry.opponent?.name?.[0] || 'O'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {rivalry.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ends {new Date(rivalry.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">No active rivalries</p>
              <Link
                href="/coach/habits/library"
                className="mt-2 inline-block text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:text-indigo-500"
              >
                Create a rivalry
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Client Leaderboard */}
      <div
        className="mt-6 bg-white dark:bg-slate-900 rounded-2xl p-6"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Client Progress
        </h3>
        {sortedClients.length > 0 ? (
          <div className="space-y-3">
            {sortedClients.map(([clientId, data], index) => {
              const activeHabits = data.habits.filter(h => h.is_active)
              const expectedCompletions = activeHabits.length * 7 // Simplified: assume daily habits
              const completionRate = expectedCompletions > 0
                ? Math.round((data.completionCount / expectedCompletions) * 100)
                : 0
              const isExpanded = expandedClient === clientId

              return (
                <div key={clientId} className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <button
                    onClick={() => setExpandedClient(isExpanded ? null : clientId)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <span className="text-lg font-bold text-slate-300 dark:text-slate-600 w-6">
                      {index + 1}
                    </span>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                      style={{
                        background: index === 0
                          ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                          : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      }}
                    >
                      {data.client?.name?.[0] || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {data.client?.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {activeHabits.length} habit{activeHabits.length !== 1 ? 's' : ''} assigned
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        {data.completionCount}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">completions</p>
                    </div>
                    <div className="w-24">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(completionRate, 100)}%`,
                              background: completionRate >= 80
                                ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                                : completionRate >= 50
                                  ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
                                  : 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)',
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8">
                          {completionRate}%
                        </span>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Expanded habits list */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Assigned Habits</h4>
                        <Link
                          href="/coach/habits/library"
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          + Assign more
                        </Link>
                      </div>
                      {data.habits.filter(h => showArchived ? true : h.is_active).length === 0 ? (
                        <p className="text-sm text-slate-500">
                          {showArchived ? 'No habits assigned' : 'No active habits'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {data.habits.filter(h => showArchived ? true : h.is_active).map((habit) => (
                            <div
                              key={habit.id}
                              className={`flex items-center justify-between p-3 rounded-lg ${
                                habit.is_active
                                  ? 'bg-white dark:bg-slate-900'
                                  : 'bg-amber-50 dark:bg-amber-500/10'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{
                                    background: habit.is_active
                                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                                      : '#94a3b8',
                                  }}
                                >
                                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <p className={`font-medium ${habit.is_active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {habit.habit?.name || 'Unknown habit'}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    {habit.habit?.category && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {habit.habit.category}
                                      </span>
                                    )}
                                    {!habit.is_active && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                        Archived
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {habit.is_active ? (
                                  <button
                                    onClick={() => archiveHabit(habit.id)}
                                    disabled={removingHabit === habit.id}
                                    className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all disabled:opacity-50"
                                    title="Archive (keeps history)"
                                  >
                                    {removingHabit === habit.id ? (
                                      <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                      </svg>
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => reactivateHabit(habit.id)}
                                    disabled={removingHabit === habit.id}
                                    className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 transition-all disabled:opacity-50"
                                    title="Reactivate habit"
                                  >
                                    {removingHabit === habit.id ? (
                                      <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => removeHabit(habit.id)}
                                  disabled={removingHabit === habit.id}
                                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all disabled:opacity-50"
                                  title="Remove completely"
                                >
                                  {removingHabit === habit.id ? (
                                    <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400">No habits assigned yet</p>
            <Link
              href="/coach/habits/library"
              className="mt-3 inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-500"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Assign habits to clients
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
