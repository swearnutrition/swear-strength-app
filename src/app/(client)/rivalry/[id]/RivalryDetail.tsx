'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/NotificationBell'
import { useColors } from '@/hooks/useColors'

interface WeekDay {
  date: string
  completed: boolean
  isFuture: boolean
  isBeforeRivalry: boolean
  isToday: boolean
}

interface Participant {
  id: string
  name: string
  email: string
  initials: string
  avatarUrl: string | null
  score: number
  streak: number
  completedToday: boolean
  weekProgress: WeekDay[]
  totalCompletions: number
}

interface Comment {
  id: string
  userId: string
  contentType: 'text' | 'reaction' | 'gif' | 'system'
  content: string | null
  gifUrl: string | null
  createdAt: string
}

interface RivalryData {
  id: string
  name: string
  status: string
  startDate: string
  endDate: string
  daysLeft: number
  daysPassed: number
  totalDays: number
  habitName: string
  habitDescription: string | null
  targetValue: number | null
  targetUnit: string | null
  habitIds: string[]
  challenger: Participant
  opponent: Participant
  comments: Comment[]
}

interface RivalryDetailProps {
  rivalry: RivalryData
  currentUserId: string
  isChallenger: boolean
}

const quickReactions = ['🔥', '💪', '😤', '👀', '😏', '🎯']

type ProgressView = 'week' | '30days'

export function RivalryDetail({ rivalry, currentUserId, isChallenger }: RivalryDetailProps) {
  const router = useRouter()
  const colors = useColors()
  const [comments, setComments] = useState<Comment[]>(rivalry.comments)
  const [newMessage, setNewMessage] = useState('')
  const [showGifSearch, setShowGifSearch] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [sending, setSending] = useState(false)
  const [nudging, setNudging] = useState(false)
  const [nudgeCooldown, setNudgeCooldown] = useState(false)
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null)
  const [progressView, setProgressView] = useState<ProgressView>('week')
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const me = isChallenger ? rivalry.challenger : rivalry.opponent
  const them = isChallenger ? rivalry.opponent : rivalry.challenger
  const scoreDiff = me.score - them.score
  const amWinning = scoreDiff > 0

  // Check if nudge was sent today on mount
  useEffect(() => {
    const lastNudge = localStorage.getItem(`nudge_${rivalry.id}`)
    if (lastNudge) {
      const lastNudgeDate = new Date(lastNudge).toDateString()
      const today = new Date().toDateString()
      if (lastNudgeDate === today) {
        setNudgeCooldown(true)
      }
    }
  }, [rivalry.id])

  // Subscribe to real-time updates for habit completions and comments
  useEffect(() => {
    // Skip if no habit IDs
    if (!rivalry.habitIds || rivalry.habitIds.length === 0) return

    // Subscribe to habit_completions changes for this rivalry's habits
    const completionsChannel = supabase
      .channel(`rivalry_completions_${rivalry.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'habit_completions',
        },
        (payload) => {
          // Check if this completion is for one of our rivalry habits
          const completionHabitId = (payload.new as { client_habit_id?: string })?.client_habit_id ||
                                    (payload.old as { client_habit_id?: string })?.client_habit_id
          if (completionHabitId && rivalry.habitIds.includes(completionHabitId)) {
            // Refresh the page to get updated scores
            router.refresh()
          }
        }
      )
      .subscribe()

    // Subscribe to rivalry_comments for real-time chat
    const commentsChannel = supabase
      .channel(`rivalry_comments_${rivalry.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rivalry_comments',
          filter: `rivalry_id=eq.${rivalry.id}`,
        },
        (payload) => {
          const newComment = payload.new as {
            id: string
            user_id: string
            content_type: 'text' | 'reaction' | 'gif' | 'system'
            content: string | null
            gif_url: string | null
            created_at: string
          }
          // Only add if not from current user (they already added it optimistically)
          if (newComment.user_id !== currentUserId) {
            setComments(prev => [{
              id: newComment.id,
              userId: newComment.user_id,
              contentType: newComment.content_type,
              content: newComment.content,
              gifUrl: newComment.gif_url,
              createdAt: newComment.created_at,
            }, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(completionsChannel)
      supabase.removeChannel(commentsChannel)
    }
  }, [rivalry.id, rivalry.habitIds, currentUserId, router, supabase])

  // Send nudge notification
  const sendNudge = async () => {
    if (nudging || nudgeCooldown) return

    setNudging(true)
    try {
      // Create in-app notification for opponent (primary)
      const { error: notifError } = await supabase
        .from('client_notifications')
        .insert({
          user_id: them.id,
          type: 'nudge',
          title: `${me.name.split(' ')[0]} nudged you!`,
          message: `Don't let them win the ${rivalry.habitName} rivalry!`,
          rivalry_id: rivalry.id,
        })

      if (notifError) throw notifError

      // Add a system comment to the rivalry chat
      await supabase
        .from('rivalry_comments')
        .insert({
          rivalry_id: rivalry.id,
          user_id: currentUserId,
          content_type: 'system',
          content: `${me.name.split(' ')[0]} nudged ${them.name.split(' ')[0]}!`,
        })

      // Check if opponent has email nudges enabled, then send email (fire and forget)
      if (them.email) {
        const { data: opponentProfile } = await supabase
          .from('profiles')
          .select('email_nudges')
          .eq('id', them.id)
          .single()

        if (opponentProfile?.email_nudges !== false) {
          // Send email notification (non-blocking)
          supabase.functions.invoke('send-email', {
            body: {
              to: them.email,
              template: 'rivalry-nudge',
              data: {
                senderName: me.name,
                recipientName: them.name,
                habitName: rivalry.habitName,
                senderScore: me.score,
                recipientScore: them.score,
                daysLeft: rivalry.daysLeft,
                rivalryId: rivalry.id,
                appUrl: window.location.origin,
              },
            },
          }).catch(err => console.log('Email send failed (non-blocking):', err))
        }
      }

      // Store nudge timestamp in localStorage
      localStorage.setItem(`nudge_${rivalry.id}`, new Date().toISOString())
      setNudgeCooldown(true)

      // Show success message
      setNudgeMessage('Nudge sent!')
      setTimeout(() => setNudgeMessage(null), 3000)

    } catch (err) {
      console.error('Nudge error:', err)
      setNudgeMessage('Failed to send nudge')
      setTimeout(() => setNudgeMessage(null), 3000)
    } finally {
      setNudging(false)
    }
  }

  // Search GIFs using Tenor
  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifs([])
      return
    }

    setLoadingGifs(true)
    try {
      // Using Tenor's free API - request specific formats
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=20&media_filter=gif,tinygif`
      )
      const data = await response.json()

      // Filter and map results, handling missing media formats gracefully
      const validGifs = (data.results || [])
        .filter((gif: { media_formats?: { gif?: { url?: string }; tinygif?: { url?: string } } }) =>
          gif.media_formats?.gif?.url || gif.media_formats?.tinygif?.url
        )
        .map((gif: { id: string; media_formats: { gif?: { url: string }; tinygif?: { url: string } } }) => ({
          id: gif.id,
          url: gif.media_formats.gif?.url || gif.media_formats.tinygif?.url || '',
          preview: gif.media_formats.tinygif?.url || gif.media_formats.gif?.url || '',
        }))

      setGifs(validGifs)
    } catch (err) {
      console.error('GIF search error:', err)
      setGifs([])
    } finally {
      setLoadingGifs(false)
    }
  }

  // Debounced GIF search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (gifQuery) searchGifs(gifQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [gifQuery])

  const sendMessage = async (type: 'text' | 'reaction' | 'gif', content?: string, gifUrl?: string) => {
    if (type === 'text' && !newMessage.trim()) return
    if (sending) return

    setSending(true)
    try {
      const { data, error } = await supabase
        .from('rivalry_comments')
        .insert({
          rivalry_id: rivalry.id,
          user_id: currentUserId,
          content_type: type,
          content: type === 'text' ? newMessage.trim() : content || null,
          gif_url: type === 'gif' ? gifUrl : null,
        })
        .select()
        .single()

      if (error) throw error

      setComments(prev => [{
        id: data.id,
        userId: data.user_id,
        contentType: data.content_type,
        content: data.content,
        gifUrl: data.gif_url,
        createdAt: data.created_at,
      }, ...prev])

      // Create notification for opponent (for reactions and GIFs)
      if (type === 'reaction' || type === 'gif') {
        const notificationTitle = type === 'reaction'
          ? `${me.name.split(' ')[0]} sent ${content}`
          : `${me.name.split(' ')[0]} sent a GIF`
        const notificationMessage = `In your ${rivalry.habitName} rivalry`

        await supabase
          .from('client_notifications')
          .insert({
            user_id: them.id,
            type: type === 'reaction' ? 'rivalry_reaction' : 'rivalry_gif',
            title: notificationTitle,
            message: notificationMessage,
            rivalry_id: rivalry.id,
          })
      }

      setNewMessage('')
      setShowGifSearch(false)
      setGifQuery('')
    } catch (err) {
      console.error('Send error:', err)
    } finally {
      setSending(false)
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days === 1) return 'Yesterday'
    return `${days}d ago`
  }

  const getCommentUserInfo = (userId: string) => {
    if (userId === rivalry.challenger.id) {
      return { name: rivalry.challenger.name, initials: rivalry.challenger.initials, isMe: rivalry.challenger.id === currentUserId }
    }
    return { name: rivalry.opponent.name, initials: rivalry.opponent.initials, isMe: rivalry.opponent.id === currentUserId }
  }

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', maxWidth: '430px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ padding: '50px 20px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/dashboard" style={{ color: colors.textMuted, padding: '8px', marginLeft: '-8px' }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: colors.card,
          borderRadius: '20px',
          border: `1px solid ${colors.border}`,
        }}>
          <span style={{ fontSize: '14px' }}>⚔️</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.textPrimary }}>HABIT RIVALRY</span>
        </div>
        <div style={{ flex: 1 }} />
        <NotificationBell userId={currentUserId} />
      </div>

      {/* Rivalry Title */}
      <div style={{ textAlign: 'center', padding: '0 20px 24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: colors.textPrimary }}>{rivalry.habitName}</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: colors.textMuted }}>
          {rivalry.targetValue && rivalry.targetUnit ? `${rivalry.targetValue} ${rivalry.targetUnit} daily` : 'Daily'} • {rivalry.daysLeft} days left
        </p>
      </div>

      {/* Scoreboard */}
      <div style={{
        margin: '0 20px 20px',
        background: colors.card,
        borderRadius: '24px',
        padding: '24px 20px',
        border: `1px solid ${colors.border}`,
      }}>
        {/* Avatars and VS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
          {/* Me */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {me.avatarUrl ? (
                <img
                  src={me.avatarUrl}
                  alt={me.name}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '16px',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleDark} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: 'white',
                }}>
                  {me.initials}
                </div>
              )}
              {amWinning && (
                <div style={{ position: 'absolute', top: '-10px', right: '-5px', fontSize: '24px' }}>👑</div>
              )}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '15px', fontWeight: 600, color: colors.textPrimary }}>{me.name.split(' ')[0]}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.textMuted }}>(You)</p>
          </div>

          {/* VS */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: colors.red,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 800,
              color: 'white',
            }}>
              VS
            </div>
            {scoreDiff !== 0 && (
              <div style={{
                padding: '4px 10px',
                borderRadius: '10px',
                background: amWinning ? `${colors.green}20` : `${colors.red}20`,
                fontSize: '12px',
                fontWeight: 700,
                color: amWinning ? colors.green : colors.red,
              }}>
                {amWinning ? '+' : ''}{scoreDiff}%
              </div>
            )}
          </div>

          {/* Them */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              {them.avatarUrl ? (
                <img
                  src={them.avatarUrl}
                  alt={them.name}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '16px',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, ${colors.amber} 0%, #d97706 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 700,
                  color: 'white',
                }}>
                  {them.initials}
                </div>
              )}
              {!amWinning && scoreDiff !== 0 && (
                <div style={{ position: 'absolute', top: '-10px', right: '-5px', fontSize: '24px' }}>👑</div>
              )}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '15px', fontWeight: 600, color: colors.textPrimary }}>{them.name.split(' ')[0]}</p>
          </div>
        </div>

        {/* Scores */}
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{
              margin: 0,
              fontSize: '48px',
              fontWeight: 800,
              color: amWinning ? colors.green : colors.purple,
              lineHeight: 1,
            }}>
              {me.score}%
            </p>
            {me.streak > 0 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '8px',
                padding: '4px 10px',
                background: `${colors.amber}20`,
                borderRadius: '8px',
              }}>
                <span>🔥</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.amber }}>{me.streak} day streak</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center' }}>
            <p style={{
              margin: 0,
              fontSize: '48px',
              fontWeight: 800,
              color: !amWinning && scoreDiff !== 0 ? colors.amber : colors.textSecondary,
              lineHeight: 1,
            }}>
              {them.score}%
            </p>
            {them.streak > 0 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '8px',
                padding: '4px 10px',
                background: `${colors.amber}20`,
                borderRadius: '8px',
              }}>
                <span>🔥</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: colors.amber }}>{them.streak} day streak</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Section */}
        <div style={{ padding: '16px 0 0', borderTop: `1px solid ${colors.border}` }}>
          {/* Progress Header with Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {progressView === 'week' ? 'WEEK PROGRESS' : '30 DAY PROGRESS'}
            </p>
            <div style={{
              display: 'flex',
              background: colors.cardLight,
              borderRadius: '8px',
              padding: '2px',
            }}>
              <button
                onClick={() => setProgressView('week')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: progressView === 'week' ? colors.purple : 'transparent',
                  color: progressView === 'week' ? 'white' : colors.textMuted,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Week
              </button>
              <button
                onClick={() => setProgressView('30days')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: progressView === '30days' ? colors.purple : 'transparent',
                  color: progressView === '30days' ? 'white' : colors.textMuted,
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                30 Days
              </button>
            </div>
          </div>

          {progressView === 'week' ? (
            <>
              {/* Day labels */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                <span style={{ width: '50px' }}></span>
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '10px', fontWeight: 600, color: colors.textMuted }}>
                      {day}
                    </div>
                  ))}
                </div>
                <span style={{ width: '30px' }}></span>
              </div>

              {/* My progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.purple, width: '50px' }}>You</span>
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  {me.weekProgress.map((day, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: '8px',
                        borderRadius: '4px',
                        background: day.completed ? colors.purple : colors.cardLight,
                        opacity: (day.isFuture || day.isBeforeRivalry) ? 0.3 : 1,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: colors.textMuted, width: '30px', textAlign: 'right' }}>
                  {me.weekProgress.filter(d => d.completed && !d.isBeforeRivalry).length}/{me.weekProgress.filter(d => !d.isFuture && !d.isBeforeRivalry).length}
                </span>
              </div>

              {/* Their progress */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: colors.amber, width: '50px' }}>{them.name.split(' ')[0]}</span>
                <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
                  {them.weekProgress.map((day, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: '8px',
                        borderRadius: '4px',
                        background: day.completed ? colors.amber : colors.cardLight,
                        opacity: (day.isFuture || day.isBeforeRivalry) ? 0.3 : 1,
                      }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '12px', color: colors.textMuted, width: '30px', textAlign: 'right' }}>
                  {them.weekProgress.filter(d => d.completed && !d.isBeforeRivalry).length}/{them.weekProgress.filter(d => !d.isFuture && !d.isBeforeRivalry).length}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* 30 Day Dot Grid */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.purple, width: '40px' }}>You</span>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(15, 1fr)',
                    gap: '3px',
                    flex: 1,
                  }}>
                    {Array.from({ length: 30 }, (_, i) => {
                      const date = new Date()
                      date.setDate(date.getDate() - (29 - i))
                      const dateStr = date.toLocaleDateString('en-CA')
                      const completed = me.totalCompletions > 0 &&
                        me.weekProgress.some(d => d.date === dateStr && d.completed)
                      const isFuture = dateStr > new Date().toLocaleDateString('en-CA')
                      const isBeforeRivalry = dateStr < rivalry.startDate

                      return (
                        <div
                          key={i}
                          title={dateStr}
                          style={{
                            aspectRatio: '1',
                            borderRadius: '50%',
                            background: completed ? colors.purple : colors.cardLight,
                            opacity: (isFuture || isBeforeRivalry) ? 0.2 : (completed ? 1 : 0.4),
                            maxWidth: '12px',
                            maxHeight: '12px',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: colors.amber, width: '40px' }}>{them.name.split(' ')[0]}</span>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(15, 1fr)',
                    gap: '3px',
                    flex: 1,
                  }}>
                    {Array.from({ length: 30 }, (_, i) => {
                      const date = new Date()
                      date.setDate(date.getDate() - (29 - i))
                      const dateStr = date.toLocaleDateString('en-CA')
                      const completed = them.totalCompletions > 0 &&
                        them.weekProgress.some(d => d.date === dateStr && d.completed)
                      const isFuture = dateStr > new Date().toLocaleDateString('en-CA')
                      const isBeforeRivalry = dateStr < rivalry.startDate

                      return (
                        <div
                          key={i}
                          title={dateStr}
                          style={{
                            aspectRatio: '1',
                            borderRadius: '50%',
                            background: completed ? colors.amber : colors.cardLight,
                            opacity: (isFuture || isBeforeRivalry) ? 0.2 : (completed ? 1 : 0.4),
                            maxWidth: '12px',
                            maxHeight: '12px',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: colors.textMuted, textAlign: 'center' }}>
                {rivalry.daysPassed} of {rivalry.totalDays} days complete
              </p>
            </>
          )}
        </div>
      </div>

      {/* Today's Status */}
      <div style={{
        margin: '0 20px 20px',
        background: colors.card,
        borderRadius: '20px',
        padding: '16px 20px',
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: colors.textMuted, textAlign: 'right' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{
            flex: 1,
            padding: '20px 16px',
            borderRadius: '16px',
            background: me.completedToday ? `${colors.green}15` : colors.cardLight,
            border: `2px solid ${me.completedToday ? colors.green : colors.border}`,
            textAlign: 'center',
          }}>
            {me.completedToday ? (
              <span style={{ fontSize: '32px' }}>✅</span>
            ) : (
              <div style={{ width: '32px', height: '32px', margin: '0 auto', borderRadius: '8px', border: `2px dashed ${colors.textMuted}` }} />
            )}
            <p style={{ margin: '8px 0 0', fontSize: '14px', fontWeight: 600, color: me.completedToday ? colors.green : colors.textSecondary }}>You</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: me.completedToday ? colors.green : colors.textMuted }}>
              {me.completedToday ? 'Complete!' : 'Pending'}
            </p>
          </div>

          <div style={{
            flex: 1,
            padding: '20px 16px',
            borderRadius: '16px',
            background: them.completedToday ? `${colors.green}15` : colors.cardLight,
            border: `2px solid ${them.completedToday ? colors.green : colors.border}`,
            textAlign: 'center',
          }}>
            {them.completedToday ? (
              <span style={{ fontSize: '32px' }}>✅</span>
            ) : (
              <div style={{ width: '32px', height: '32px', margin: '0 auto', borderRadius: '8px', border: `2px dashed ${colors.textMuted}` }} />
            )}
            <p style={{ margin: '8px 0 0', fontSize: '14px', fontWeight: 600, color: them.completedToday ? colors.green : colors.textSecondary }}>{them.name.split(' ')[0]}</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: them.completedToday ? colors.green : colors.textMuted }}>
              {them.completedToday ? 'Complete!' : 'Pending'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Reactions */}
      <div style={{
        margin: '0 20px 20px',
        background: colors.card,
        borderRadius: '20px',
        padding: '16px 20px',
        border: `1px solid ${colors.border}`,
      }}>
        <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 500, color: colors.textSecondary, textAlign: 'center' }}>
          Let {them.name.split(' ')[0]} know you mean business
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {quickReactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendMessage('reaction', emoji)}
              disabled={sending}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: colors.cardLight,
                border: `1px solid ${colors.border}`,
                fontSize: '22px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                opacity: sending ? 0.5 : 1,
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Nudge Button */}
        <button
          onClick={sendNudge}
          disabled={nudging || nudgeCooldown}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '14px 20px',
            borderRadius: '14px',
            background: nudgeCooldown
              ? colors.cardLight
              : `linear-gradient(135deg, ${colors.red} 0%, #dc2626 100%)`,
            border: nudgeCooldown ? `1px solid ${colors.border}` : 'none',
            fontSize: '15px',
            fontWeight: 700,
            color: nudgeCooldown ? colors.textMuted : 'white',
            cursor: nudgeCooldown ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.15s ease',
            boxShadow: nudgeCooldown ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.3)',
          }}
        >
          {nudging ? (
            <>
              <div style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              Sending...
            </>
          ) : nudgeCooldown ? (
            <>
              <span style={{ fontSize: '18px' }}>✓</span>
              Nudged today
            </>
          ) : (
            <>
              <span style={{ fontSize: '18px' }}>👊</span>
              Nudge {them.name.split(' ')[0]}
            </>
          )}
        </button>
        <p style={{
          margin: '8px 0 0',
          fontSize: '12px',
          color: colors.textMuted,
          textAlign: 'center',
        }}>
          {!them.email
            ? 'Your opponent needs to sign up first'
            : nudgeCooldown
              ? 'You can nudge again tomorrow'
              : 'Send them an email reminder to log their habit'}
        </p>

        {/* Nudge feedback toast */}
        {nudgeMessage && (
          <div style={{
            marginTop: '12px',
            padding: '10px 16px',
            borderRadius: '10px',
            background: nudgeMessage.includes('Failed') ? `${colors.red}20` : `${colors.green}20`,
            color: nudgeMessage.includes('Failed') ? colors.red : colors.green,
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'center',
          }}>
            {nudgeMessage}
          </div>
        )}
      </div>

      {/* Comments/Activity Feed */}
      <div style={{
        margin: '0 20px 100px',
        background: colors.card,
        borderRadius: '20px',
        padding: '16px 20px',
        border: `1px solid ${colors.border}`,
      }}>
        {/* GIF Search Panel */}
        {showGifSearch && (
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              value={gifQuery}
              onChange={(e) => setGifQuery(e.target.value)}
              placeholder="Search GIFs..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                background: colors.cardLight,
                fontSize: '14px',
                outline: 'none',
                marginBottom: '12px',
                color: colors.textPrimary,
              }}
            />
            {loadingGifs && <p style={{ textAlign: 'center', color: colors.textMuted, fontSize: '13px' }}>Searching...</p>}
            {gifs.length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}>
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => sendMessage('gif', undefined, gif.url)}
                    disabled={sending}
                    style={{
                      padding: 0,
                      border: `2px solid transparent`,
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: colors.cardLight,
                      transition: 'border-color 0.15s ease',
                    }}
                  >
                    <img
                      src={gif.preview}
                      alt="GIF"
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => { setShowGifSearch(false); setGifQuery(''); setGifs([]) }}
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '12px',
                background: 'transparent',
                border: 'none',
                color: colors.textMuted,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Message Input */}
        {!showGifSearch && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setShowGifSearch(true)}
              style={{
                padding: '12px 20px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, #00d9ff 0%, #00a8cc 100%)`,
                border: 'none',
                fontSize: '14px',
                fontWeight: 700,
                color: 'white',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 217, 255, 0.3)',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '16px' }}>🎬</span>
              Send GIF
            </button>
          </div>
        )}

        {/* Activity Feed */}
        <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
          {comments.length === 0 ? (
            <p style={{ textAlign: 'center', color: colors.textMuted, fontSize: '14px', padding: '20px 0' }}>
              No activity yet. Send a reaction to get started!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {comments.map((comment) => {
                const userInfo = getCommentUserInfo(comment.userId)

                return (
                  <div
                    key={comment.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px 0',
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    {comment.contentType === 'gif' ? (
                      <span style={{ fontSize: '20px' }}>🖼️</span>
                    ) : comment.contentType === 'reaction' ? (
                      <span style={{ fontSize: '20px' }}>{comment.content}</span>
                    ) : comment.contentType === 'system' ? (
                      <span style={{ fontSize: '20px' }}>👊</span>
                    ) : (
                      <span style={{ fontSize: '20px' }}>💬</span>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {comment.contentType === 'gif' && comment.gifUrl && (
                        <img
                          src={comment.gifUrl}
                          alt="GIF"
                          style={{
                            maxWidth: '200px',
                            borderRadius: '12px',
                            marginBottom: '4px',
                          }}
                        />
                      )}
                      {comment.contentType === 'system' ? (
                        <p style={{ margin: 0, fontSize: '14px', color: colors.amber, fontStyle: 'italic' }}>
                          {comment.content}
                        </p>
                      ) : (
                        <p style={{ margin: 0, fontSize: '14px', color: colors.textPrimary }}>
                          <span style={{ fontWeight: 600 }}>{userInfo.isMe ? 'You' : userInfo.name.split(' ')[0]}</span>
                          {comment.contentType === 'text' && `: ${comment.content}`}
                          {comment.contentType === 'reaction' && ` sent ${comment.content}`}
                          {comment.contentType === 'gif' && ' sent a GIF'}
                        </p>
                      )}
                    </div>

                    <span style={{ fontSize: '12px', color: colors.textMuted, flexShrink: 0 }}>
                      {formatTime(comment.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div ref={commentsEndRef} />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
