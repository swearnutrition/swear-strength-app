'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { NotificationBell } from '@/components/NotificationBell'
import { useColors } from '@/hooks/useColors'
import { useTheme } from '@/lib/theme'

interface WeekDay {
  date: string
  completed: boolean
  isFuture: boolean
  isBeforeRivalry: boolean
  isToday: boolean
}

interface FullDay {
  date: string
  dayNumber: number
  completed: boolean
  isFuture: boolean
  isBeforeRivalry: boolean
  isAfterRivalry: boolean
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
  fullProgress: FullDay[]
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

const reactionEmojis = ['🔥', '💪', '😤', '👀', '😏', '🎯']

type ProgressView = 'week' | '30days'

// Icons
const Icons = {
  back: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  ),
  swords: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
      <line x1="13" y1="19" x2="19" y2="13"/>
      <line x1="16" y1="16" x2="20" y2="20"/>
      <line x1="19" y1="21" x2="21" y2="19"/>
      <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/>
      <line x1="5" y1="14" x2="9" y2="18"/>
      <line x1="7" y1="17" x2="4" y2="20"/>
      <line x1="3" y1="19" x2="5" y2="21"/>
    </svg>
  ),
  check: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  home: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  calendar: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  dumbbell: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M6.5 6.5h11M6.5 17.5h11M3 10v4M21 10v4M5 8v8M19 8v8M7 6v12M17 6v12"/>
    </svg>
  ),
  user: ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
}

export function RivalryDetail({ rivalry, currentUserId, isChallenger }: RivalryDetailProps) {
  const router = useRouter()
  const colors = useColors()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [comments, setComments] = useState<Comment[]>(rivalry.comments)
  const [showGifSearch, setShowGifSearch] = useState(false)
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string }[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [sending, setSending] = useState(false)
  const [nudgeCooldown, setNudgeCooldown] = useState(false)
  const [progressView, setProgressView] = useState<ProgressView>('week')
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const me = isChallenger ? rivalry.challenger : rivalry.opponent
  const them = isChallenger ? rivalry.opponent : rivalry.challenger

  // Rivalry colors
  const rivalryOrange = '#f97316'
  const rivalryAmber = '#fbbf24'
  const rivalryRed = '#ef4444'

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
    if (!rivalry.habitIds || rivalry.habitIds.length === 0) return

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
          const completionHabitId = (payload.new as { client_habit_id?: string })?.client_habit_id ||
                                    (payload.old as { client_habit_id?: string })?.client_habit_id
          if (completionHabitId && rivalry.habitIds.includes(completionHabitId)) {
            router.refresh()
          }
        }
      )
      .subscribe()

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

  const sendReaction = async (emoji: string) => {
    if (sending) return
    setSending(true)

    try {
      const { data, error } = await supabase
        .from('rivalry_comments')
        .insert({
          rivalry_id: rivalry.id,
          user_id: currentUserId,
          content_type: 'reaction',
          content: emoji,
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

      // Create notification for opponent
      await supabase
        .from('client_notifications')
        .insert({
          user_id: them.id,
          type: 'rivalry_reaction',
          title: `${me.name.split(' ')[0]} sent ${emoji}`,
          message: `In your ${rivalry.habitName} rivalry`,
          rivalry_id: rivalry.id,
        })
    } catch (err) {
      console.error('Send reaction error:', err)
    } finally {
      setSending(false)
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
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&limit=20&media_filter=gif,tinygif`
      )
      const data = await response.json()

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (gifQuery) searchGifs(gifQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [gifQuery])

  const sendGif = async (gifUrl: string) => {
    if (sending) return
    setSending(true)

    try {
      const { data, error } = await supabase
        .from('rivalry_comments')
        .insert({
          rivalry_id: rivalry.id,
          user_id: currentUserId,
          content_type: 'gif',
          gif_url: gifUrl,
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

      await supabase
        .from('client_notifications')
        .insert({
          user_id: them.id,
          type: 'rivalry_gif',
          title: `${me.name.split(' ')[0]} sent a GIF`,
          message: `In your ${rivalry.habitName} rivalry`,
          rivalry_id: rivalry.id,
        })

      setShowGifSearch(false)
      setGifQuery('')
    } catch (err) {
      console.error('Send GIF error:', err)
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
      return { name: rivalry.challenger.name, initials: rivalry.challenger.initials, avatarUrl: rivalry.challenger.avatarUrl, isMe: rivalry.challenger.id === currentUserId }
    }
    return { name: rivalry.opponent.name, initials: rivalry.opponent.initials, avatarUrl: rivalry.opponent.avatarUrl, isMe: rivalry.opponent.id === currentUserId }
  }

  return (
    <div className="rivalry-container">
      <style>{`
        @keyframes rivalry-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(249, 115, 22, 0.3), 0 0 60px rgba(249, 115, 22, 0.1); }
          50% { box-shadow: 0 0 50px rgba(249, 115, 22, 0.5), 0 0 80px rgba(249, 115, 22, 0.2); }
        }

        @keyframes score-glow-green {
          0%, 100% { text-shadow: 0 0 20px rgba(52, 211, 153, 0.5); }
          50% { text-shadow: 0 0 40px rgba(52, 211, 153, 0.8); }
        }

        @keyframes score-glow-orange {
          0%, 100% { text-shadow: 0 0 20px rgba(249, 115, 22, 0.5); }
          50% { text-shadow: 0 0 40px rgba(249, 115, 22, 0.8); }
        }

        @keyframes vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }

        @keyframes avatar-ring {
          0%, 100% { box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.3); }
          50% { box-shadow: 0 0 0 6px rgba(139, 92, 246, 0.1); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .rivalry-container {
          min-height: 100vh;
          background: ${colors.bg};
          padding-bottom: 100px;
        }

        .rivalry-content {
          max-width: 500px;
          margin: 0 auto;
          padding: 0 20px;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 20px;
        }

        .back-btn {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: ${colors.bgCard};
          border: ${isDark ? 'none' : `1px solid ${colors.border}`};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          text-decoration: none;
        }

        .rivalry-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, ${rivalryRed} 0%, ${rivalryOrange} 100%);
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);
        }

        .rivalry-badge-text {
          font-size: 13px;
          font-weight: 700;
          color: white;
        }

        /* Title Section */
        .title-section {
          text-align: center;
          margin-bottom: 8px;
        }

        .habit-name {
          font-size: 28px;
          font-weight: 800;
          color: ${colors.text};
          margin: 0;
        }

        .habit-subtitle {
          font-size: 14px;
          color: ${colors.textMuted};
          margin: 8px 0 0;
        }

        .days-left {
          color: ${rivalryOrange};
          font-weight: 600;
        }

        /* Main Rivalry Card */
        .rivalry-card {
          background: ${isDark
            ? 'linear-gradient(135deg, rgba(30, 20, 50, 0.9) 0%, rgba(40, 25, 60, 0.9) 100%)'
            : 'linear-gradient(135deg, #fffaf8 0%, #fff5f0 100%)'};
          border-radius: 24px;
          padding: 28px 24px;
          margin-top: 20px;
          position: relative;
          overflow: hidden;
          animation: rivalry-glow 4s ease-in-out infinite;
        }

        .rivalry-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 24px;
          padding: 2px;
          background: linear-gradient(135deg, ${rivalryOrange}, ${rivalryAmber}, ${rivalryRed}, ${rivalryOrange});
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .vs-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
          margin-bottom: 24px;
        }

        .player-info {
          text-align: center;
          flex: 1;
        }

        .avatar {
          width: 72px;
          height: 72px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px;
          font-size: 32px;
          box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
        }

        .avatar.me {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          animation: avatar-ring 3s ease-in-out infinite;
        }

        .avatar.opponent {
          background: ${rivalryAmber};
          font-size: 24px;
          font-weight: 800;
          color: white;
          box-shadow: 0 8px 25px rgba(251, 191, 36, 0.4);
        }

        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 18px;
        }

        .player-name {
          font-size: 15px;
          font-weight: 700;
          color: ${colors.text};
        }

        .player-label {
          font-size: 11px;
          color: ${colors.textMuted};
        }

        .vs-badge {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${rivalryOrange} 0%, ${rivalryAmber} 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 800;
          color: white;
          box-shadow: 0 6px 25px rgba(249, 115, 22, 0.5);
          z-index: 1;
          animation: vs-pulse 2s ease-in-out infinite;
        }

        .scores-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
        }

        .score {
          font-size: 48px;
          font-weight: 800;
          flex: 1;
          text-align: center;
        }

        .score.me {
          color: ${colors.green};
          animation: score-glow-green 2s ease-in-out infinite;
        }

        .score.opponent {
          color: ${rivalryOrange};
          animation: score-glow-orange 2s ease-in-out infinite;
        }

        /* Card styling */
        .card {
          background: ${colors.bgCard};
          border-radius: 20px;
          padding: 20px;
          margin-top: 16px;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.04)'};
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .card-title {
          font-size: 12px;
          font-weight: 700;
          color: ${colors.textMuted};
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        /* Toggle buttons */
        .toggle-group {
          display: flex;
          gap: 4px;
        }

        .toggle-btn {
          padding: 6px 12px;
          border-radius: 8px;
          border: none;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-btn.active {
          background: ${colors.purple};
          color: white;
        }

        .toggle-btn.inactive {
          background: transparent;
          color: ${colors.textMuted};
        }

        /* Week progress */
        .week-header {
          display: flex;
          margin-bottom: 12px;
          padding-left: 60px;
        }

        .day-label {
          flex: 1;
          text-align: center;
          font-size: 11px;
          color: ${colors.textMuted};
          font-weight: 500;
        }

        .progress-row {
          display: flex;
          align-items: center;
          margin-bottom: 10px;
        }

        .progress-row:last-child {
          margin-bottom: 0;
        }

        .progress-label {
          width: 60px;
          font-size: 13px;
          font-weight: 600;
        }

        .progress-label.me {
          color: ${colors.green};
        }

        .progress-label.opponent {
          color: ${rivalryOrange};
        }

        .progress-cells {
          flex: 1;
          display: flex;
          gap: 4px;
        }

        .progress-cell {
          flex: 1;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid ${colors.border};
          background: transparent;
        }

        .progress-cell.complete.me {
          background: ${colors.green};
          border-color: ${colors.green};
        }

        .progress-cell.complete.opponent {
          background: ${rivalryOrange};
          border-color: ${rivalryOrange};
        }

        .progress-cell.missed.me {
          background: ${rivalryRed};
          border-color: ${rivalryRed};
        }

        .progress-cell.missed.opponent {
          background: ${rivalryRed};
          border-color: ${rivalryRed};
        }

        .progress-cell.today {
          border: 2px solid ${colors.purple};
          box-shadow: 0 0 0 1px ${colors.purple}40;
        }

        .progress-cell.faded {
          opacity: 0.3;
          border-color: ${colors.border}50;
        }

        .progress-count {
          width: 40px;
          text-align: right;
          font-size: 12px;
          color: ${colors.textMuted};
        }

        /* 30 Days Grid */
        .full-progress-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .full-progress-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .full-progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .full-progress-label {
          font-size: 13px;
          font-weight: 600;
        }

        .full-progress-label.me {
          color: ${colors.green};
        }

        .full-progress-label.opponent {
          color: ${rivalryOrange};
        }

        .full-progress-stats {
          font-size: 12px;
          color: ${colors.textMuted};
        }

        .full-progress-row {
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          gap: 4px;
        }

        .full-progress-cell {
          aspect-ratio: 1;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid ${colors.border};
          background: transparent;
          position: relative;
          font-size: 8px;
          color: ${colors.textMuted};
        }

        .full-progress-cell.complete.me {
          background: ${colors.green};
          border-color: ${colors.green};
          color: white;
        }

        .full-progress-cell.complete.opponent {
          background: ${rivalryOrange};
          border-color: ${rivalryOrange};
          color: white;
        }

        .full-progress-cell.missed.me,
        .full-progress-cell.missed.opponent {
          background: ${rivalryRed};
          border-color: ${rivalryRed};
          color: white;
        }

        .full-progress-cell.today {
          border: 2px solid ${colors.purple};
          box-shadow: 0 0 0 1px ${colors.purple}40;
        }

        .full-progress-cell.faded {
          opacity: 0.3;
          border-color: ${colors.border}50;
        }

        .full-progress-day-num {
          font-size: 9px;
          font-weight: 600;
        }

        /* Today's Status */
        .today-header {
          font-size: 12px;
          font-weight: 700;
          color: ${colors.textMuted};
          letter-spacing: 0.5px;
          margin-bottom: 16px;
          text-align: center;
        }

        .status-boxes {
          display: flex;
          gap: 12px;
        }

        .status-box {
          flex: 1;
          background: ${colors.bgCardSolid};
          border-radius: 16px;
          padding: 20px 16px;
          text-align: center;
        }

        .status-box.me {
          border: 2px solid ${colors.green}30;
        }

        .status-box.opponent {
          border: 2px solid ${rivalryOrange}30;
        }

        .status-icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 12px;
        }

        .status-icon-box.me {
          background: ${colors.green}20;
          border: 2px dashed ${colors.green}50;
        }

        .status-icon-box.opponent {
          background: ${rivalryOrange}20;
          border: 2px dashed ${rivalryOrange}50;
        }

        .status-icon-box.complete {
          border-style: solid;
        }

        .status-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 4px;
        }

        .status-checkbox.me {
          border: 2px solid ${colors.green};
        }

        .status-checkbox.opponent {
          border: 2px solid ${rivalryOrange};
        }

        .status-name {
          font-size: 14px;
          font-weight: 600;
          color: ${colors.text};
        }

        .status-text {
          font-size: 12px;
          font-weight: 500;
        }

        .status-text.pending {
          color: ${colors.amber};
        }

        .status-text.complete {
          color: ${colors.green};
        }

        /* Nudge & Reactions */
        .nudge-header {
          font-size: 14px;
          font-weight: 700;
          color: ${colors.text};
          margin-bottom: 16px;
          text-align: center;
        }

        .emoji-buttons {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .emoji-btn {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          border: none;
          background: ${colors.bgCardSolid};
          font-size: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
          animation: float 3s ease-in-out infinite;
        }

        .emoji-btn:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 15px ${rivalryOrange}40;
        }

        .emoji-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .gif-btn-inline {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #00d9ff 0%, #00a8cc 100%);
          font-size: 12px;
          font-weight: 700;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
          animation: float 3s ease-in-out infinite;
        }

        .gif-btn-inline:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 15px rgba(0, 217, 255, 0.4);
        }

        .gif-btn-inline:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .divider {
          height: 1px;
          background: ${colors.border};
          margin: 0 -20px 16px;
        }

        /* Recent Nudges */
        .nudges-label {
          font-size: 11px;
          font-weight: 700;
          color: ${colors.textMuted};
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .nudge-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .nudge-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          background: ${colors.bgCardSolid};
          border-radius: 12px;
        }

        .nudge-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: white;
          flex-shrink: 0;
          overflow: hidden;
        }

        .nudge-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .nudge-avatar.me {
          background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%);
          font-size: 14px;
        }

        .nudge-avatar.opponent {
          background: ${rivalryAmber};
          font-size: 12px;
        }

        .nudge-emoji {
          font-size: 24px;
        }

        .nudge-gif {
          width: 120px;
          height: auto;
          border-radius: 10px;
          flex-shrink: 0;
        }

        .nudge-item-gif {
          flex-wrap: wrap;
        }

        .nudge-info {
          flex: 1;
        }

        .nudge-text {
          font-size: 13px;
          font-weight: 600;
          color: ${colors.text};
        }

        .nudge-time {
          font-size: 11px;
          color: ${colors.textMuted};
        }

        /* Nudged Today indicator */
        .nudged-today {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
          padding: 10px;
          background: ${colors.green}15;
          border-radius: 10px;
          border: 1px solid ${colors.green}30;
        }

        .nudged-today-text {
          font-size: 13px;
          font-weight: 600;
          color: ${colors.green};
        }

        /* GIF Search */
        .gif-search {
          margin-bottom: 16px;
        }

        .gif-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid ${colors.border};
          background: ${colors.bgCardSolid};
          font-size: 14px;
          outline: none;
          margin-bottom: 12px;
          color: ${colors.text};
        }

        .gif-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          max-height: 300px;
          overflow-y: auto;
        }

        .gif-btn {
          padding: 0;
          border: 2px solid transparent;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          background: ${colors.bgCardSolid};
          transition: border-color 0.15s ease;
        }

        .gif-btn img {
          width: 100%;
          height: auto;
          display: block;
        }

        .cancel-btn {
          width: 100%;
          padding: 8px;
          margin-top: 12px;
          background: transparent;
          border: none;
          color: ${colors.textMuted};
          font-size: 13px;
          cursor: pointer;
        }

        /* Activity Feed */
        .activity-feed {
          border-top: 1px solid ${colors.border};
          padding-top: 16px;
        }

        .activity-empty {
          text-align: center;
          color: ${colors.textMuted};
          font-size: 14px;
          padding: 20px 0;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid ${colors.border};
        }

        .activity-icon {
          font-size: 20px;
        }

        .activity-content {
          flex: 1;
          min-width: 0;
        }

        .activity-content img {
          max-width: 200px;
          border-radius: 12px;
          margin-bottom: 4px;
        }

        .activity-text {
          margin: 0;
          font-size: 14px;
          color: ${colors.text};
        }

        .activity-text.system {
          color: ${colors.amber};
          font-style: italic;
        }

        .activity-text span {
          font-weight: 600;
        }

        .activity-time {
          font-size: 12px;
          color: ${colors.textMuted};
          flex-shrink: 0;
        }

        /* Bottom Navigation */
        .bottom-nav {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 468px;
          background: ${colors.bgCard};
          border-radius: 20px;
          padding: 12px 20px;
          display: flex;
          justify-content: space-around;
          align-items: center;
          border: 1px solid ${colors.border};
          box-shadow: ${isDark ? 'none' : '0 -2px 10px rgba(0,0,0,0.05)'};
          z-index: 100;
        }

        .nav-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          text-decoration: none;
        }

        .nav-label {
          font-size: 10px;
          font-weight: 600;
        }
      `}</style>

      <div className="rivalry-content">
        {/* Header */}
        <header className="header">
          <Link href="/dashboard" className="back-btn">
            <Icons.back size={20} color={colors.textSecondary} />
          </Link>

          <div className="rivalry-badge">
            <Icons.swords size={16} color="white" />
            <span className="rivalry-badge-text">HABIT RIVALRY</span>
          </div>

          <NotificationBell userId={currentUserId} />
        </header>

        {/* Title */}
        <div className="title-section">
          <h1 className="habit-name">{rivalry.habitName}</h1>
          <p className="habit-subtitle">
            {rivalry.targetValue && rivalry.targetUnit ? `${rivalry.targetValue} ${rivalry.targetUnit} daily` : 'Daily'} · <span className="days-left">{rivalry.daysLeft} days left</span>
          </p>
        </div>

        {/* Main Rivalry Card */}
        <div className="rivalry-card">
          {/* VS Section */}
          <div className="vs-section">
            {/* Me */}
            <div className="player-info">
              <div className="avatar me">
                {me.avatarUrl ? (
                  <img src={me.avatarUrl} alt={me.name} />
                ) : (
                  '🤘'
                )}
              </div>
              <div className="player-name">{me.name.split(' ')[0]}</div>
              <div className="player-label">(You)</div>
            </div>

            {/* VS Badge */}
            <div className="vs-badge">VS</div>

            {/* Opponent */}
            <div className="player-info">
              <div className="avatar opponent">
                {them.avatarUrl ? (
                  <img src={them.avatarUrl} alt={them.name} />
                ) : (
                  them.initials
                )}
              </div>
              <div className="player-name">{them.name.split(' ')[0]}</div>
              <div className="player-label" style={{ opacity: 0 }}>(You)</div>
            </div>
          </div>

          {/* Scores */}
          <div className="scores-section">
            <div className="score me">{me.score}%</div>
            <div style={{ width: 60 }} />
            <div className="score opponent">{them.score}%</div>
          </div>
        </div>

        {/* Week Progress */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">WEEK PROGRESS</span>
            <div className="toggle-group">
              <button
                onClick={() => setProgressView('week')}
                className={`toggle-btn ${progressView === 'week' ? 'active' : 'inactive'}`}
              >
                Week
              </button>
              <button
                onClick={() => setProgressView('30days')}
                className={`toggle-btn ${progressView === '30days' ? 'active' : 'inactive'}`}
              >
                30 Days
              </button>
            </div>
          </div>

          {progressView === 'week' ? (
            <>
              <div className="week-header">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                  <div key={i} className="day-label">{day}</div>
                ))}
              </div>

              <div className="progress-row">
                <span className="progress-label me">You</span>
                <div className="progress-cells">
                  {me.weekProgress.map((day, i) => {
                    const isMissed = !day.completed && !day.isFuture && !day.isBeforeRivalry && !day.isToday
                    return (
                      <div
                        key={i}
                        className={`progress-cell ${day.completed ? 'complete me' : isMissed ? 'missed me' : ''} ${day.isToday ? 'today' : ''} ${(day.isFuture || day.isBeforeRivalry) ? 'faded' : ''}`}
                      >
                        {day.completed && <Icons.check size={14} color="white" />}
                        {isMissed && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✕</span>}
                      </div>
                    )
                  })}
                </div>
                <span className="progress-count">
                  {me.weekProgress.filter(d => d.completed && !d.isBeforeRivalry).length}/{me.weekProgress.filter(d => !d.isFuture && !d.isBeforeRivalry).length}
                </span>
              </div>

              <div className="progress-row">
                <span className="progress-label opponent">{them.name.split(' ')[0]}</span>
                <div className="progress-cells">
                  {them.weekProgress.map((day, i) => {
                    const isMissed = !day.completed && !day.isFuture && !day.isBeforeRivalry && !day.isToday
                    return (
                      <div
                        key={i}
                        className={`progress-cell ${day.completed ? 'complete opponent' : isMissed ? 'missed opponent' : ''} ${day.isToday ? 'today' : ''} ${(day.isFuture || day.isBeforeRivalry) ? 'faded' : ''}`}
                      >
                        {day.completed && <Icons.check size={14} color="white" />}
                        {isMissed && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✕</span>}
                      </div>
                    )
                  })}
                </div>
                <span className="progress-count">
                  {them.weekProgress.filter(d => d.completed && !d.isBeforeRivalry).length}/{them.weekProgress.filter(d => !d.isFuture && !d.isBeforeRivalry).length}
                </span>
              </div>
            </>
          ) : (
            <div className="full-progress-grid">
              {/* Me */}
              <div className="full-progress-section">
                <div className="full-progress-header">
                  <span className="full-progress-label me">You</span>
                  <span className="full-progress-stats">
                    {me.fullProgress.filter(d => d.completed).length}/{me.fullProgress.filter(d => !d.isFuture).length} completed
                  </span>
                </div>
                <div className="full-progress-row">
                  {me.fullProgress.map((day, i) => {
                    const isMissed = !day.completed && !day.isFuture && !day.isToday
                    return (
                      <div
                        key={i}
                        className={`full-progress-cell ${day.completed ? 'complete me' : isMissed ? 'missed me' : ''} ${day.isToday ? 'today' : ''} ${day.isFuture ? 'faded' : ''}`}
                        title={`Day ${day.dayNumber}: ${day.date}`}
                      >
                        <span className="full-progress-day-num">
                          {day.completed ? '✓' : isMissed ? '✕' : day.dayNumber}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Opponent */}
              <div className="full-progress-section">
                <div className="full-progress-header">
                  <span className="full-progress-label opponent">{them.name.split(' ')[0]}</span>
                  <span className="full-progress-stats">
                    {them.fullProgress.filter(d => d.completed).length}/{them.fullProgress.filter(d => !d.isFuture).length} completed
                  </span>
                </div>
                <div className="full-progress-row">
                  {them.fullProgress.map((day, i) => {
                    const isMissed = !day.completed && !day.isFuture && !day.isToday
                    return (
                      <div
                        key={i}
                        className={`full-progress-cell ${day.completed ? 'complete opponent' : isMissed ? 'missed opponent' : ''} ${day.isToday ? 'today' : ''} ${day.isFuture ? 'faded' : ''}`}
                        title={`Day ${day.dayNumber}: ${day.date}`}
                      >
                        <span className="full-progress-day-num">
                          {day.completed ? '✓' : isMissed ? '✕' : day.dayNumber}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Today's Status */}
        <div className="card">
          <div className="today-header">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div className="status-boxes">
            <div className="status-box me">
              <div className={`status-icon-box me ${me.completedToday ? 'complete' : ''}`}>
                {me.completedToday ? (
                  <Icons.check size={24} color={colors.green} />
                ) : (
                  <div className="status-checkbox me" />
                )}
              </div>
              <div className="status-name">You</div>
              <div className={`status-text ${me.completedToday ? 'complete' : 'pending'}`}>
                {me.completedToday ? 'Complete!' : 'Pending'}
              </div>
            </div>

            <div className="status-box opponent">
              <div className={`status-icon-box opponent ${them.completedToday ? 'complete' : ''}`}>
                {them.completedToday ? (
                  <Icons.check size={24} color={rivalryOrange} />
                ) : (
                  <div className="status-checkbox opponent" />
                )}
              </div>
              <div className="status-name">{them.name.split(' ')[0]}</div>
              <div className={`status-text ${them.completedToday ? 'complete' : 'pending'}`}>
                {them.completedToday ? 'Complete!' : 'Pending'}
              </div>
            </div>
          </div>
        </div>

        {/* Nudges & Reactions */}
        <div className="card">
          <div className="nudge-header">
            Let {them.name.split(' ')[0]} know you mean business 😤
          </div>

          <div className="emoji-buttons">
            {reactionEmojis.map((emoji, i) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                disabled={sending}
                className="emoji-btn"
                style={{ animationDelay: `${i * 0.2}s` }}
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowGifSearch(true)}
              disabled={sending}
              className="gif-btn-inline"
              style={{ animationDelay: `${reactionEmojis.length * 0.2}s` }}
            >
              GIF
            </button>
          </div>

          <div className="divider" />

          <div className="nudges-label">RECENT NUDGES</div>

          {comments.length === 0 ? (
            <p className="activity-empty">No activity yet. Send a reaction to get started!</p>
          ) : (
            <div className="nudge-list">
              {comments.slice(0, 5).map((comment) => {
                const userInfo = getCommentUserInfo(comment.userId)
                const isFromMe = userInfo.isMe

                if (comment.contentType === 'gif' && comment.gifUrl) {
                  return (
                    <div key={comment.id} className="nudge-item nudge-item-gif">
                      <div className={`nudge-avatar ${isFromMe ? 'me' : 'opponent'}`}>
                        {userInfo.avatarUrl ? (
                          <img src={userInfo.avatarUrl} alt={userInfo.name} />
                        ) : isFromMe ? (
                          me.avatarUrl ? <img src={me.avatarUrl} alt={me.name} /> : '🤘'
                        ) : (
                          userInfo.initials
                        )}
                      </div>
                      <img src={comment.gifUrl} alt="GIF" className="nudge-gif" />
                      <div className="nudge-time" style={{ marginLeft: 'auto' }}>{formatTime(comment.createdAt)}</div>
                    </div>
                  )
                }

                if (comment.contentType === 'system') {
                  return (
                    <div key={comment.id} className="nudge-item">
                      <span style={{ fontSize: 20 }}>👊</span>
                      <div className="nudge-info">
                        <div className="nudge-text" style={{ color: colors.amber, fontStyle: 'italic' }}>{comment.content}</div>
                        <div className="nudge-time">{formatTime(comment.createdAt)}</div>
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={comment.id} className="nudge-item">
                    <div className={`nudge-avatar ${isFromMe ? 'me' : 'opponent'}`}>
                      {userInfo.avatarUrl ? (
                        <img src={userInfo.avatarUrl} alt={userInfo.name} />
                      ) : isFromMe ? (
                        me.avatarUrl ? <img src={me.avatarUrl} alt={me.name} /> : '🤘'
                      ) : (
                        userInfo.initials
                      )}
                    </div>
                    <div className="nudge-emoji">{comment.content}</div>
                    <div className="nudge-info">
                      <div className="nudge-text">{isFromMe ? 'You' : userInfo.name.split(' ')[0]} sent a nudge</div>
                      <div className="nudge-time">{formatTime(comment.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {nudgeCooldown && (
            <div className="nudged-today">
              <Icons.check size={16} color={colors.green} />
              <span className="nudged-today-text">Nudged today</span>
            </div>
          )}

          {/* GIF Search (shows inline when open) */}
          {showGifSearch && (
            <>
              <div className="divider" style={{ marginTop: 16 }} />
              <div className="gif-search">
                <input
                  type="text"
                  value={gifQuery}
                  onChange={(e) => setGifQuery(e.target.value)}
                  placeholder="Search GIFs..."
                  className="gif-input"
                  autoFocus
                />
                {loadingGifs && <p style={{ textAlign: 'center', color: colors.textMuted, fontSize: 13 }}>Searching...</p>}
                {gifs.length > 0 && (
                  <div className="gif-grid">
                    {gifs.map((gif) => (
                      <button
                        key={gif.id}
                        onClick={() => sendGif(gif.url)}
                        disabled={sending}
                        className="gif-btn"
                      >
                        <img src={gif.preview} alt="GIF" />
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => { setShowGifSearch(false); setGifQuery(''); setGifs([]) }} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>

        <div ref={commentsEndRef} />
      </div>

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <Link href="/dashboard" className="nav-item">
          <Icons.home size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Home</span>
        </Link>
        <Link href="/dashboard" className="nav-item">
          <Icons.calendar size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Calendar</span>
        </Link>
        <Link href="/workouts" className="nav-item">
          <Icons.dumbbell size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Plans</span>
        </Link>
        <Link href="/settings" className="nav-item">
          <Icons.user size={22} color={colors.textMuted} />
          <span className="nav-label" style={{ color: colors.textMuted }}>Account</span>
        </Link>
      </nav>
    </div>
  )
}
