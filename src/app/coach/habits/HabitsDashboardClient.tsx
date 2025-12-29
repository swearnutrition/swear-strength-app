'use client'

import { useState } from 'react'
import Link from 'next/link'

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

interface Rivalry {
  id: string
  name: string
  endDate: string
  startDate?: string
  player1: { id: string; name: string; avatar: string; score: number; avatar_url?: string | null }
  player2: { id: string; name: string; avatar: string; score: number; avatar_url?: string | null }
}

interface HabitsDashboardClientProps {
  clients: ClientData[]
  rivalries: Rivalry[]
}

type ViewMode = 'week' | 'month'

// Player color pool for visual distinction
const playerColors = [
  '#8b5cf6', // purple
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#34d399', // green
  '#fbbf24', // amber
  '#ef4444', // red
  '#60a5fa', // blue
  '#fb923c', // orange
]

// Get consistent color for a player based on their ID
function getPlayerColor(playerId: string, index: number): string {
  // Use a simple hash of the ID to get a consistent color
  let hash = 0
  for (let i = 0; i < playerId.length; i++) {
    hash = playerId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return playerColors[Math.abs(hash + index) % playerColors.length]
}

// Check if rivalry is "hot" (close match)
function isHotRivalry(p1Score: number, p2Score: number): boolean {
  const scoreDiff = Math.abs(p1Score - p2Score)
  const hasActivity = p1Score + p2Score > 0
  return hasActivity && scoreDiff <= 2
}

// Calculate days left
function getDaysLeft(endDate: string): number {
  const end = new Date(endDate)
  const now = new Date()
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function HabitsDashboardClient({
  clients,
  rivalries,
}: HabitsDashboardClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')

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

        {/* Active Rivalries - Battle Cards */}
        {rivalries.length > 0 && (
          <div className="mb-8">
            {/* Section Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚔️</span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Active Rivalries
                </h2>
                <span className="bg-purple-500 text-white text-xs font-bold px-2.5 py-1 rounded-full ml-1">
                  {rivalries.length}
                </span>
              </div>
              <Link
                href="/coach/habits/rivalries"
                className="text-sm text-purple-500 hover:text-purple-400 font-semibold hover:underline"
              >
                Manage →
              </Link>
            </div>

            {/* Battle Cards Container */}
            <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
              {rivalries.map((rivalry) => {
                const isHot = isHotRivalry(rivalry.player1.score, rivalry.player2.score)
                const daysLeft = getDaysLeft(rivalry.endDate)
                const p1Color = getPlayerColor(rivalry.player1.id, 0)
                const p2Color = getPlayerColor(rivalry.player2.id, 1)
                const total = rivalry.player1.score + rivalry.player2.score || 1
                const p1Width = (rivalry.player1.score / total) * 100
                const p2Width = (rivalry.player2.score / total) * 100
                const p1Winning = rivalry.player1.score > rivalry.player2.score
                const p2Winning = rivalry.player2.score > rivalry.player1.score
                const isTied = rivalry.player1.score === rivalry.player2.score

                return (
                  <Link
                    key={rivalry.id}
                    href={`/coach/habits/rivalries/${rivalry.id}`}
                    className={`
                      relative flex-shrink-0 min-w-[280px] max-w-[300px] rounded-[20px] p-5
                      bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50
                      transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10
                      ${isHot
                        ? 'border-2 border-amber-400/40 dark:border-amber-500/30'
                        : 'border border-slate-200 dark:border-slate-700/50'
                      }
                    `}
                  >
                    {/* Hot Badge */}
                    {isHot && (
                      <div className="absolute top-3 right-3 text-base animate-pulse">
                        🔥
                      </div>
                    )}

                    {/* Players Row */}
                    <div className="flex items-start justify-between mb-4">
                      {/* Player 1 */}
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white mb-2"
                          style={{
                            background: `linear-gradient(135deg, ${p1Color} 0%, ${p1Color}99 100%)`,
                            boxShadow: `0 4px 20px ${p1Color}40`,
                          }}
                        >
                          {rivalry.player1.avatar_url ? (
                            <img
                              src={rivalry.player1.avatar_url}
                              alt={rivalry.player1.name}
                              className="w-full h-full rounded-2xl object-cover"
                            />
                          ) : (
                            rivalry.player1.avatar
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 text-center truncate max-w-[80px]">
                          {rivalry.player1.name.split(' ')[0]}
                        </p>
                      </div>

                      {/* Score + VS */}
                      <div className="flex flex-col items-center px-3">
                        <div className="text-[28px] font-black tracking-tighter mb-1">
                          <span className={p1Winning ? 'text-emerald-500' : isTied ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
                            {rivalry.player1.score}
                          </span>
                          <span className="text-slate-300 dark:text-slate-600 mx-1">-</span>
                          <span className={p2Winning ? 'text-emerald-500' : isTied ? 'text-slate-700 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
                            {rivalry.player2.score}
                          </span>
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-md">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            VS
                          </span>
                        </div>
                      </div>

                      {/* Player 2 */}
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold text-white mb-2"
                          style={{
                            background: `linear-gradient(135deg, ${p2Color} 0%, ${p2Color}99 100%)`,
                            boxShadow: `0 4px 20px ${p2Color}40`,
                          }}
                        >
                          {rivalry.player2.avatar_url ? (
                            <img
                              src={rivalry.player2.avatar_url}
                              alt={rivalry.player2.name}
                              className="w-full h-full rounded-2xl object-cover"
                            />
                          ) : (
                            rivalry.player2.avatar
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 text-center truncate max-w-[80px]">
                          {rivalry.player2.name.split(' ')[0]}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex mb-3">
                      <div
                        className="transition-all duration-300"
                        style={{
                          width: `${rivalry.player1.score + rivalry.player2.score === 0 ? 50 : p1Width}%`,
                          backgroundColor: rivalry.player1.score + rivalry.player2.score === 0 ? `${p1Color}50` : p1Color,
                        }}
                      />
                      <div
                        className="transition-all duration-300"
                        style={{
                          width: `${rivalry.player1.score + rivalry.player2.score === 0 ? 50 : p2Width}%`,
                          backgroundColor: rivalry.player1.score + rivalry.player2.score === 0 ? `${p2Color}50` : p2Color,
                        }}
                      />
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                      <span>{daysLeft > 0 ? `${daysLeft}d left` : 'Ended'}</span>
                      <span>Ends {new Date(rivalry.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

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
                        <tr key={habit.id}>
                          <td className="text-xs text-slate-600 dark:text-slate-400 py-1 pr-4 truncate max-w-[120px]">
                            {habit.name}
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
