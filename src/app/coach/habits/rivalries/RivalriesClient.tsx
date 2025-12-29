'use client'

import { useState } from 'react'
import Link from 'next/link'
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
  rivalry_id: string | null
  habit: HabitTemplate | null
}

interface Completion {
  id: string
  client_habit_id: string
  completed_date: string
}

interface Rivalry {
  id: string
  name: string
  challenger_id: string
  opponent_id: string
  start_date: string
  end_date: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  winner_id: string | null
  challenger: Client | null
  opponent: Client | null
}

interface RivalriesClientProps {
  rivalries: Rivalry[]
  rivalryHabits: ClientHabit[]
  completions: Completion[]
  clients: Client[]
}

const statusColors = {
  pending: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  active: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  completed: 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400',
  cancelled: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
}

export function RivalriesClient({
  rivalries: initialRivalries,
  rivalryHabits,
  completions,
  clients,
}: RivalriesClientProps) {
  const router = useRouter()
  const [rivalries, setRivalries] = useState(initialRivalries)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    rivalryId: string
    action: 'cancel' | 'complete'
    rivalryName: string
  } | null>(null)

  const filteredRivalries = rivalries.filter((r) => {
    if (filter === 'all') return true
    if (filter === 'active') return r.status === 'active' || r.status === 'pending'
    if (filter === 'completed') return r.status === 'completed' || r.status === 'cancelled'
    return true
  })

  // Calculate scores for each rivalry
  const getRivalryScores = (rivalry: Rivalry) => {
    const habits = rivalryHabits.filter((h) => h.rivalry_id === rivalry.id)
    const challengerHabits = habits.filter((h) => h.client_id === rivalry.challenger_id)
    const opponentHabits = habits.filter((h) => h.client_id === rivalry.opponent_id)

    const challengerCompletions = completions.filter((c) =>
      challengerHabits.some((h) => h.id === c.client_habit_id)
    ).length

    const opponentCompletions = completions.filter((c) =>
      opponentHabits.some((h) => h.id === c.client_habit_id)
    ).length

    return { challengerCompletions, opponentCompletions }
  }

  const handleAction = async (rivalryId: string, action: 'cancel' | 'complete') => {
    setActionLoading(rivalryId)
    try {
      const res = await fetch(`/api/rivalries/${rivalryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      if (res.ok) {
        const data = await res.json()
        // Update local state
        setRivalries(prev => prev.map(r => {
          if (r.id === rivalryId) {
            return {
              ...r,
              status: data.status,
              winner_id: data.winner_id || null
            }
          }
          return r
        }))
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to update rivalry:', error)
    } finally {
      setActionLoading(null)
      setConfirmModal(null)
    }
  }

  const isExpired = (endDate: string) => {
    return new Date(endDate) < new Date()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/coach/habits"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Habit Rivalries</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Head-to-head habit challenges between clients
            </p>
          </div>
        </div>
        <Link
          href="/coach/habits/library"
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Rivalry
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' && (
              <span className="ml-2 text-xs opacity-70">
                ({rivalries.filter((r) =>
                  f === 'active'
                    ? r.status === 'active' || r.status === 'pending'
                    : r.status === 'completed' || r.status === 'cancelled'
                ).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Rivalries Grid */}
      {filteredRivalries.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRivalries.map((rivalry) => {
            const scores = getRivalryScores(rivalry)
            const isChallegerWinning = scores.challengerCompletions > scores.opponentCompletions
            const isTied = scores.challengerCompletions === scores.opponentCompletions
            const daysRemaining = Math.max(
              0,
              Math.ceil((new Date(rivalry.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            )

            return (
              <div
                key={rivalry.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 hover:shadow-lg transition-all"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{rivalry.name}</h3>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[rivalry.status]}`}>
                    {rivalry.status}
                  </span>
                </div>

                {/* VS Display */}
                <div className="flex items-center justify-between py-4">
                  {/* Challenger */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold border-4 ${
                        isChallegerWinning && !isTied
                          ? 'border-emerald-400'
                          : 'border-transparent'
                      }`}
                      style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                    >
                      {rivalry.challenger?.name?.[0] || 'C'}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white truncate max-w-[80px]">
                      {rivalry.challenger?.name?.split(' ')[0] || 'Challenger'}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {scores.challengerCompletions}
                    </p>
                  </div>

                  {/* VS */}
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-slate-300 dark:text-slate-600">VS</span>
                    {rivalry.status === 'active' && (
                      <span className="text-xs text-slate-400 mt-1">{daysRemaining}d left</span>
                    )}
                  </div>

                  {/* Opponent */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold border-4 ${
                        !isChallegerWinning && !isTied
                          ? 'border-emerald-400'
                          : 'border-transparent'
                      }`}
                      style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' }}
                    >
                      {rivalry.opponent?.name?.[0] || 'O'}
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-900 dark:text-white truncate max-w-[80px]">
                      {rivalry.opponent?.name?.split(' ')[0] || 'Opponent'}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {scores.opponentCompletions}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    <div
                      className="h-full rounded-l-full"
                      style={{
                        width: `${
                          scores.challengerCompletions + scores.opponentCompletions > 0
                            ? (scores.challengerCompletions /
                                (scores.challengerCompletions + scores.opponentCompletions)) *
                              100
                            : 50
                        }%`,
                        background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                      }}
                    />
                    <div
                      className="h-full rounded-r-full"
                      style={{
                        flex: 1,
                        background: 'linear-gradient(90deg, #ec4899 0%, #f43f5e 100%)',
                      }}
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-slate-400">
                    {new Date(rivalry.start_date).toLocaleDateString()} -{' '}
                    {new Date(rivalry.end_date).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions for active/pending rivalries */}
                {(rivalry.status === 'active' || rivalry.status === 'pending') && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    {isExpired(rivalry.end_date) ? (
                      // Rivalry has expired - show "End & Pick Winner" prominently
                      <button
                        onClick={() => setConfirmModal({ rivalryId: rivalry.id, action: 'complete', rivalryName: rivalry.name })}
                        disabled={actionLoading === rivalry.id}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading === rivalry.id ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            End & Pick Winner
                          </>
                        )}
                      </button>
                    ) : (
                      // Rivalry is still active - show subtle action menu
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === rivalry.id ? null : rivalry.id)}
                          className="w-full flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs py-1.5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                          Manage
                        </button>
                        {openMenuId === rivalry.id && (
                          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-10">
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                setConfirmModal({ rivalryId: rivalry.id, action: 'complete', rivalryName: rivalry.name })
                              }}
                              disabled={actionLoading === rivalry.id}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              End Early & Pick Winner
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null)
                                setConfirmModal({ rivalryId: rivalry.id, action: 'cancel', rivalryName: rivalry.name })
                              }}
                              disabled={actionLoading === rivalry.id}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancel Rivalry
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Winner display for completed rivalries */}
                {rivalry.status === 'completed' && rivalry.winner_id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <span>🏆</span>
                      Winner: {rivalry.winner_id === rivalry.challenger_id
                        ? rivalry.challenger?.name?.split(' ')[0]
                        : rivalry.opponent?.name?.split(' ')[0]
                      }
                    </span>
                  </div>
                )}

                {/* Tied display */}
                {rivalry.status === 'completed' && !rivalry.winner_id && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
                      <span>🤝</span>
                      It&apos;s a tie!
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div
          className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)' }}
        >
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            No rivalries yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Create head-to-head challenges to boost client motivation
          </p>
          <Link
            href="/coach/habits/library"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create First Rivalry
          </Link>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              {confirmModal.action === 'cancel' ? 'Cancel Rivalry?' : 'End Rivalry?'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {confirmModal.action === 'cancel'
                ? `Are you sure you want to cancel "${confirmModal.rivalryName}"? This cannot be undone.`
                : `End "${confirmModal.rivalryName}" now and determine the winner based on current scores?`
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => handleAction(confirmModal.rivalryId, confirmModal.action)}
                disabled={actionLoading === confirmModal.rivalryId}
                className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 ${
                  confirmModal.action === 'cancel'
                    ? 'bg-red-500 hover:bg-red-400 text-white'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                }`}
              >
                {actionLoading === confirmModal.rivalryId ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : confirmModal.action === 'cancel' ? (
                  'Cancel Rivalry'
                ) : (
                  'End & Pick Winner'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
