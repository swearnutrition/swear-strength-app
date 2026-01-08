'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ClientHabit {
  id: string
  name: string
  completions: Record<string, boolean> // date string -> completed
}

interface ClientData {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  habits: ClientHabit[]
  streak: number
  completionRate: number
}

interface HabitsDashboardClientProps {
  clients: ClientData[]
}

type ViewMode = 'week' | 'month'

export function HabitsDashboardClient({
  clients: initialClients,
}: HabitsDashboardClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [clients, setClients] = useState(initialClients)
  const [unassigning, setUnassigning] = useState<string | null>(null)
  const router = useRouter()

  const handleUnassignHabit = async (clientHabitId: string, habitName: string) => {
    if (!confirm(`Unassign "${habitName}"? This will remove the habit from the client but keep their completion history.`)) {
      return
    }

    setUnassigning(clientHabitId)
    try {
      const res = await fetch(`/api/coach/client-habits/${clientHabitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to unassign habit')
      }

      // Remove the habit from local state
      setClients(prev => prev.map(client => ({
        ...client,
        habits: client.habits.filter(h => h.id !== clientHabitId),
      })).filter(client => client.habits.length > 0))

      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unassign habit')
    } finally {
      setUnassigning(null)
    }
  }

  // Generate dates for the view
  const today = new Date()
  const dates = viewMode === 'week'
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (6 - i))
        return d
      })
    : Array.from({ length: 28 }, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (27 - i))
        return d
      })

  const formatDateKey = (d: Date) => d.toISOString().split('T')[0]
  const isToday = (d: Date) => formatDateKey(d) === formatDateKey(today)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Habits
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {clients.length} client{clients.length !== 1 ? 's' : ''} with habits
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'week'
                    ? 'bg-purple-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'month'
                    ? 'bg-purple-500 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Month
              </button>
            </div>
            <Link
              href="/coach/habits/library"
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 px-4 rounded-lg transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Assign
            </Link>
          </div>
        </div>

        {/* Clients List */}
        {clients.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-3xl">
              📋
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-2">No clients with habits yet</p>
            <Link
              href="/coach/habits/library"
              className="inline-flex items-center gap-2 text-purple-500 hover:text-purple-400 font-medium text-sm"
            >
              Assign habits to get started →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
              >
                {/* Client Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    {client.avatar_url ? (
                      <img
                        src={client.avatar_url}
                        alt={client.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold">
                        {client.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {client.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {client.habits.length} habit{client.habits.length !== 1 ? 's' : ''}
                        {client.streak > 0 && <span className="ml-2">🔥 {client.streak} day streak</span>}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      client.completionRate >= 80 ? 'text-emerald-500' :
                      client.completionRate >= 50 ? 'text-amber-500' :
                      'text-red-500'
                    }`}>
                      {client.completionRate}%
                    </p>
                    <p className="text-xs text-slate-400">this {viewMode}</p>
                  </div>
                </div>

                {/* Habits Grid */}
                <div className="p-4 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 pb-2 pr-4 min-w-[100px]">
                          Habit
                        </th>
                        {dates.map((date) => (
                          <th
                            key={date.toISOString()}
                            className={`text-center text-[10px] font-medium pb-2 px-0.5 ${
                              isToday(date) ? 'text-purple-500' : 'text-slate-400'
                            }`}
                            style={{ minWidth: viewMode === 'week' ? '36px' : '20px' }}
                          >
                            {viewMode === 'week' ? (
                              <div>
                                <div>{date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                                <div>{date.getDate()}</div>
                              </div>
                            ) : (
                              <div>{date.getDate()}</div>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {client.habits.map((habit) => (
                        <tr key={habit.id} className="group">
                          <td className="text-xs text-slate-600 dark:text-slate-400 py-1 pr-4 max-w-[120px]">
                            <div className="flex items-center gap-1">
                              <span className="truncate">{habit.name}</span>
                              <button
                                onClick={() => handleUnassignHabit(habit.id, habit.name)}
                                disabled={unassigning === habit.id}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                                title="Unassign habit"
                              >
                                {unassigning === habit.id ? (
                                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                          {dates.map((date) => {
                            const dateKey = formatDateKey(date)
                            const completed = habit.completions[dateKey]
                            const isFuture = date > today

                            return (
                              <td key={date.toISOString()} className="text-center py-1 px-0.5">
                                <div
                                  className={`mx-auto ${viewMode === 'week' ? 'w-6 h-6' : 'w-4 h-4'} rounded-md ${
                                    isFuture
                                      ? 'bg-slate-100 dark:bg-slate-800'
                                      : completed
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-200 dark:bg-slate-700'
                                  } ${isToday(date) ? 'ring-2 ring-purple-400 ring-offset-1 dark:ring-offset-slate-900' : ''}`}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
