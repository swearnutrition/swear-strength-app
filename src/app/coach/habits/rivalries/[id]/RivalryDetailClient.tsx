'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Player {
  id: string
  name: string
  avatar_url: string | null
  score: number
}

interface Rivalry {
  id: string
  name: string
  status: 'pending' | 'active' | 'completed' | 'cancelled'
  startDate: string
  endDate: string
  winnerId: string | null
  challenger: Player
  opponent: Player
}

interface Habit {
  id: string
  name: string
  clientId: string
}

interface DailyData {
  date: string
  challenger: number
  opponent: number
}

interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar: string | null
  contentType: 'text' | 'reaction' | 'gif' | 'system'
  content: string | null
  gifUrl: string | null
  createdAt: string
}

interface RivalryDetailClientProps {
  rivalry: Rivalry
  habits: Habit[]
  dailyData: DailyData[]
  comments: Comment[]
  currentUserId: string
  isCoach: boolean
}

// Player colors
const playerColors = {
  challenger: '#8b5cf6', // purple
  opponent: '#f59e0b', // amber
}

type OverviewMode = 'week' | 'month'

// Quick reaction emojis
const quickReactions = ['🔥', '💪', '😤', '🏆', '👊', '😎', '🎯', '⚡']

export function RivalryDetailClient({
  rivalry,
  habits,
  dailyData,
  comments: initialComments,
  currentUserId,
  isCoach,
}: RivalryDetailClientProps) {
  const router = useRouter()
  const [comments, setComments] = useState(initialComments)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('week')

  const isChallenger = currentUserId === rivalry.challenger.id
  const isOpponent = currentUserId === rivalry.opponent.id
  const canInteract = isChallenger || isOpponent

  const daysLeft = Math.ceil(
    (new Date(rivalry.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )
  const totalDays = Math.ceil(
    (new Date(rivalry.endDate).getTime() - new Date(rivalry.startDate).getTime()) / (1000 * 60 * 60 * 24)
  )
  const daysElapsed = totalDays - Math.max(0, daysLeft)
  const progress = Math.min(100, (daysElapsed / totalDays) * 100)

  const p1Winning = rivalry.challenger.score > rivalry.opponent.score
  const p2Winning = rivalry.opponent.score > rivalry.challenger.score
  const isTied = rivalry.challenger.score === rivalry.opponent.score

  // Get the data for week/month view
  const overviewData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (overviewMode === 'week') {
      // Get last 7 days
      const days: DailyData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        const found = dailyData.find(d => d.date === dateStr)
        days.push(found || { date: dateStr, challenger: 0, opponent: 0 })
      }
      return days
    } else {
      // Get all days in the rivalry (month view)
      return dailyData
    }
  }, [dailyData, overviewMode])

  // Get max value for chart scaling
  const maxDailyValue = useMemo(() => {
    return Math.max(
      ...overviewData.map(d => Math.max(d.challenger, d.opponent)),
      1
    )
  }, [overviewData])

  // Calculate weekly/monthly totals
  const overviewTotals = useMemo(() => {
    const challengerTotal = overviewData.reduce((sum, d) => sum + d.challenger, 0)
    const opponentTotal = overviewData.reduce((sum, d) => sum + d.opponent, 0)
    return { challengerTotal, opponentTotal }
  }, [overviewData])

  // Scroll to bottom when comments change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments])

  // Search GIFs using Giphy
  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifs([])
      return
    }
    const giphyKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY
    if (!giphyKey) {
      console.error('NEXT_PUBLIC_GIPHY_API_KEY not configured')
      setLoadingGifs(false)
      return
    }
    setLoadingGifs(true)
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${giphyKey}&q=${encodeURIComponent(query)}&limit=12&rating=pg`
      )
      const data = await res.json()
      setGifs(
        data.data.map((g: any) => ({
          id: g.id,
          url: g.images.original.url,
          preview: g.images.fixed_width_small.url,
        }))
      )
    } catch (error) {
      console.error('Failed to search GIFs:', error)
    } finally {
      setLoadingGifs(false)
    }
  }

  // Debounced GIF search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showGifPicker) {
        searchGifs(gifSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [gifSearch, showGifPicker])

  const sendMessage = async (contentType: 'text' | 'reaction' | 'gif', content?: string, gifUrl?: string) => {
    if (!canInteract) return
    if (contentType === 'text' && !newMessage.trim()) return

    setSending(true)
    try {
      const res = await fetch(`/api/rivalries/${rivalry.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          content: contentType === 'text' ? newMessage : content,
          gif_url: gifUrl,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setComments(prev => [...prev, {
          id: data.id,
          userId: currentUserId,
          userName: isChallenger ? rivalry.challenger.name : rivalry.opponent.name,
          userAvatar: isChallenger ? rivalry.challenger.avatar_url : rivalry.opponent.avatar_url,
          contentType,
          content: contentType === 'text' ? newMessage : content || null,
          gifUrl: gifUrl || null,
          createdAt: new Date().toISOString(),
        }])
        setNewMessage('')
        setShowGifPicker(false)
        setGifSearch('')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (days === 1) {
      return 'Yesterday'
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/coach/habits/rivalries"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{rivalry.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {rivalry.status === 'active' && daysLeft > 0
                ? `${daysLeft} days left`
                : rivalry.status === 'completed'
                  ? 'Completed'
                  : rivalry.status === 'cancelled'
                    ? 'Cancelled'
                    : 'Ended'}
            </p>
          </div>
          {rivalry.status === 'active' && (
            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
              isTied
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isTied ? 'Tied!' : p1Winning ? `${rivalry.challenger.name.split(' ')[0]} leads` : `${rivalry.opponent.name.split(' ')[0]} leads`}
            </div>
          )}
        </div>

        {/* Score Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 mb-6 border border-slate-200 dark:border-slate-800">
          {/* Players & Score */}
          <div className="flex items-center justify-between mb-6">
            {/* Challenger */}
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white mb-2 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${playerColors.challenger} 0%, ${playerColors.challenger}99 100%)`,
                  boxShadow: `0 4px 20px ${playerColors.challenger}40`,
                }}
              >
                {rivalry.challenger.avatar_url ? (
                  <img
                    src={rivalry.challenger.avatar_url}
                    alt={rivalry.challenger.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  rivalry.challenger.name[0]?.toUpperCase()
                )}
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {rivalry.challenger.name.split(' ')[0]}
              </p>
              {rivalry.status === 'completed' && rivalry.winnerId === rivalry.challenger.id && (
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1 mt-1">
                  <span>🏆</span> Winner
                </span>
              )}
            </div>

            {/* Score */}
            <div className="flex flex-col items-center px-6">
              <div className="text-4xl font-black tracking-tighter mb-2">
                <span className={p1Winning ? 'text-emerald-500' : isTied ? 'text-slate-700 dark:text-white' : 'text-slate-400'}>
                  {rivalry.challenger.score}
                </span>
                <span className="text-slate-300 dark:text-slate-600 mx-2">-</span>
                <span className={p2Winning ? 'text-emerald-500' : isTied ? 'text-slate-700 dark:text-white' : 'text-slate-400'}>
                  {rivalry.opponent.score}
                </span>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-lg">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  VS
                </span>
              </div>
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center flex-1">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-white mb-2 overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${playerColors.opponent} 0%, ${playerColors.opponent}99 100%)`,
                  boxShadow: `0 4px 20px ${playerColors.opponent}40`,
                }}
              >
                {rivalry.opponent.avatar_url ? (
                  <img
                    src={rivalry.opponent.avatar_url}
                    alt={rivalry.opponent.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  rivalry.opponent.name[0]?.toUpperCase()
                )}
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {rivalry.opponent.name.split(' ')[0]}
              </p>
              {rivalry.status === 'completed' && rivalry.winnerId === rivalry.opponent.id && (
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1 mt-1">
                  <span>🏆</span> Winner
                </span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>{new Date(rivalry.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span>{Math.round(progress)}% complete</span>
              <span>{new Date(rivalry.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Score Split Bar */}
          <div className="h-3 rounded-full overflow-hidden flex">
            <div
              className="transition-all duration-300"
              style={{
                width: `${rivalry.challenger.score + rivalry.opponent.score === 0 ? 50 : (rivalry.challenger.score / (rivalry.challenger.score + rivalry.opponent.score)) * 100}%`,
                backgroundColor: playerColors.challenger,
              }}
            />
            <div
              className="transition-all duration-300"
              style={{
                width: `${rivalry.challenger.score + rivalry.opponent.score === 0 ? 50 : (rivalry.opponent.score / (rivalry.challenger.score + rivalry.opponent.score)) * 100}%`,
                backgroundColor: playerColors.opponent,
              }}
            />
          </div>
        </div>

        {/* Week/Month Overview */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 mb-6 border border-slate-200 dark:border-slate-800">
          {/* Header with tabs */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📊</span> Activity Overview
            </h2>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setOverviewMode('week')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  overviewMode === 'week'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setOverviewMode('month')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  overviewMode === 'month'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Full Challenge
              </button>
            </div>
          </div>

          {/* Period Totals */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: playerColors.challenger }}
              >
                {rivalry.challenger.avatar_url ? (
                  <img
                    src={rivalry.challenger.avatar_url}
                    alt={rivalry.challenger.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  rivalry.challenger.name[0]?.toUpperCase()
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {rivalry.challenger.name.split(' ')[0]}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {overviewTotals.challengerTotal}
                  <span className="text-xs font-normal text-slate-400 ml-1">completions</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: playerColors.opponent }}
              >
                {rivalry.opponent.avatar_url ? (
                  <img
                    src={rivalry.opponent.avatar_url}
                    alt={rivalry.opponent.name}
                    className="w-full h-full rounded-xl object-cover"
                  />
                ) : (
                  rivalry.opponent.name[0]?.toUpperCase()
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {rivalry.opponent.name.split(' ')[0]}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white">
                  {overviewTotals.opponentTotal}
                  <span className="text-xs font-normal text-slate-400 ml-1">completions</span>
                </p>
              </div>
            </div>
          </div>

          {/* Daily Bar Chart */}
          <div className="overflow-x-auto -mx-2 px-2">
            <div className={`flex gap-1 ${overviewMode === 'month' ? 'min-w-max' : ''}`}>
              {overviewData.map((day) => {
                const date = new Date(day.date)
                const isToday = day.date === new Date().toISOString().split('T')[0]
                const dayLabel = overviewMode === 'week'
                  ? date.toLocaleDateString('en-US', { weekday: 'short' })
                  : date.getDate().toString()

                return (
                  <div
                    key={day.date}
                    className={`flex-1 ${overviewMode === 'month' ? 'min-w-[28px]' : 'min-w-[40px]'}`}
                  >
                    {/* Bars container */}
                    <div className="h-24 flex items-end justify-center gap-0.5 mb-1">
                      {/* Challenger bar */}
                      <div
                        className="w-3 rounded-t transition-all duration-300"
                        style={{
                          height: `${(day.challenger / maxDailyValue) * 100}%`,
                          minHeight: day.challenger > 0 ? '4px' : '0',
                          backgroundColor: playerColors.challenger,
                        }}
                        title={`${rivalry.challenger.name.split(' ')[0]}: ${day.challenger}`}
                      />
                      {/* Opponent bar */}
                      <div
                        className="w-3 rounded-t transition-all duration-300"
                        style={{
                          height: `${(day.opponent / maxDailyValue) * 100}%`,
                          minHeight: day.opponent > 0 ? '4px' : '0',
                          backgroundColor: playerColors.opponent,
                        }}
                        title={`${rivalry.opponent.name.split(' ')[0]}: ${day.opponent}`}
                      />
                    </div>
                    {/* Day label */}
                    <p className={`text-[10px] text-center ${
                      isToday
                        ? 'font-bold text-purple-500'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}>
                      {dayLabel}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: playerColors.challenger }}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {rivalry.challenger.name.split(' ')[0]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: playerColors.opponent }}
              />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {rivalry.opponent.name.split(' ')[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>💬</span> Trash Talk
            </h2>
          </div>

          {/* Messages */}
          <div className="h-[400px] overflow-y-auto p-4 space-y-3">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-3xl">
                  😤
                </div>
                <p className="text-slate-500 dark:text-slate-400 mb-1">No trash talk yet</p>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {canInteract ? 'Start the banter!' : 'Waiting for the competitors to engage'}
                </p>
              </div>
            ) : (
              comments.map((comment) => {
                const isMine = comment.userId === currentUserId
                const isFromChallenger = comment.userId === rivalry.challenger.id
                const color = isFromChallenger ? playerColors.challenger : playerColors.opponent

                if (comment.contentType === 'system') {
                  return (
                    <div key={comment.id} className="text-center text-xs text-slate-400 py-2">
                      {comment.content}
                    </div>
                  )
                }

                return (
                  <div
                    key={comment.id}
                    className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-sm font-bold overflow-hidden"
                      style={{ backgroundColor: color }}
                    >
                      {comment.userAvatar ? (
                        <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                      ) : (
                        comment.userName[0]?.toUpperCase()
                      )}
                    </div>

                    {/* Content */}
                    <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
                      {comment.contentType === 'reaction' ? (
                        <div className="text-4xl">{comment.content}</div>
                      ) : comment.contentType === 'gif' ? (
                        <div className="rounded-xl overflow-hidden">
                          <img
                            src={comment.gifUrl || ''}
                            alt="GIF"
                            className="max-w-full max-h-48 object-contain"
                          />
                        </div>
                      ) : (
                        <div
                          className={`rounded-2xl px-4 py-2 ${
                            isMine
                              ? 'bg-purple-500 text-white rounded-br-md'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      )}
                      <p className={`text-[10px] text-slate-400 mt-1 ${isMine ? 'text-right' : ''}`}>
                        {formatTime(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {canInteract && rivalry.status === 'active' && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              {/* Quick Reactions */}
              <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                {quickReactions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendMessage('reaction', emoji)}
                    disabled={sending}
                    className="w-10 h-10 flex-shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-xl transition-colors disabled:opacity-50"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => setShowGifPicker(!showGifPicker)}
                  className={`px-4 h-10 flex-shrink-0 rounded-full flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    showGifPicker
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  GIF
                </button>
              </div>

              {/* GIF Picker */}
              {showGifPicker && (
                <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <input
                    type="text"
                    value={gifSearch}
                    onChange={(e) => setGifSearch(e.target.value)}
                    placeholder="Search GIFs..."
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm mb-2"
                  />
                  {loadingGifs ? (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                  ) : gifs.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                      {gifs.map((gif) => (
                        <button
                          key={gif.id}
                          onClick={() => sendMessage('gif', undefined, gif.url)}
                          className="aspect-square rounded-lg overflow-hidden hover:ring-2 ring-purple-500 transition-all"
                        >
                          <img src={gif.preview} alt="GIF" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  ) : gifSearch ? (
                    <p className="text-center text-sm text-slate-400 py-4">No GIFs found</p>
                  ) : (
                    <p className="text-center text-sm text-slate-400 py-4">Search for GIFs</p>
                  )}
                </div>
              )}

              {/* Text Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage('text')}
                  placeholder="Send a message..."
                  disabled={sending}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-0 text-sm placeholder:text-slate-400 focus:ring-2 ring-purple-500 disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage('text')}
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-medium text-sm transition-colors disabled:opacity-50"
                >
                  {sending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Coach View Notice */}
          {isCoach && !canInteract && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-sm text-slate-400">
                You&apos;re viewing as coach. Only rivals can send messages.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
