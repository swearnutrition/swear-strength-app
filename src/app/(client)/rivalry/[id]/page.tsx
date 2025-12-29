import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { RivalryDetail } from './RivalryDetail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RivalryPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get rivalry with all related data
  const { data: rivalry, error } = await supabase
    .from('habit_rivalries')
    .select(`
      id,
      name,
      start_date,
      end_date,
      status,
      challenger_id,
      opponent_id,
      coach_id
    `)
    .eq('id', id)
    .single()

  if (error || !rivalry) {
    notFound()
  }

  // Check if user is part of this rivalry
  const isParticipant = rivalry.challenger_id === user.id || rivalry.opponent_id === user.id
  const isCoach = rivalry.coach_id === user.id

  if (!isParticipant && !isCoach) {
    notFound()
  }

  // Get both participants' profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url')
    .in('id', [rivalry.challenger_id, rivalry.opponent_id])

  const challengerProfile = profiles?.find(p => p.id === rivalry.challenger_id)
  const opponentProfile = profiles?.find(p => p.id === rivalry.opponent_id)

  // Get the habit associated with this rivalry
  const { data: rivalryHabits } = await supabase
    .from('client_habits')
    .select('id, client_id, habit_templates(name, description, target_value, target_unit, category)')
    .eq('rivalry_id', rivalry.id)

  const habitTemplate = rivalryHabits?.[0]?.habit_templates
  const habitInfo = Array.isArray(habitTemplate) ? habitTemplate[0] : habitTemplate

  // Get completions for both participants
  const habitIds = rivalryHabits?.map(h => h.id) || []

  const { data: completions } = await supabase
    .from('habit_completions')
    .select('id, client_id, client_habit_id, completed_date')
    .in('client_habit_id', habitIds)
    .gte('completed_date', rivalry.start_date)
    .lte('completed_date', rivalry.end_date)
    .order('completed_date', { ascending: true })

  // Get comments/reactions
  const { data: comments } = await supabase
    .from('rivalry_comments')
    .select('id, user_id, content_type, content, gif_url, created_at')
    .eq('rivalry_id', rivalry.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Calculate stats - use local date strings for consistency
  const now = new Date()
  // Get today's date in local timezone as YYYY-MM-DD
  const todayStr = now.toLocaleDateString('en-CA') // en-CA gives YYYY-MM-DD format
  const today = new Date(todayStr + 'T00:00:00') // Midnight local time

  const startDate = new Date(rivalry.start_date + 'T00:00:00')
  const endDate = new Date(rivalry.end_date + 'T00:00:00')
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const daysPassed = Math.max(1, Math.min(totalDays, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1))
  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  const challengerHabitId = rivalryHabits?.find(h => h.client_id === rivalry.challenger_id)?.id
  const opponentHabitId = rivalryHabits?.find(h => h.client_id === rivalry.opponent_id)?.id

  const challengerCompletions = (completions || []).filter(c => c.client_habit_id === challengerHabitId)
  const opponentCompletions = (completions || []).filter(c => c.client_habit_id === opponentHabitId)

  const challengerScore = Math.round((challengerCompletions.length / daysPassed) * 100)
  const opponentScore = Math.round((opponentCompletions.length / daysPassed) * 100)

  // Calculate streaks
  const calculateStreak = (userCompletions: typeof completions) => {
    if (!userCompletions || userCompletions.length === 0) return 0
    const dates = [...new Set(userCompletions.map(c => c.completed_date))].sort().reverse()
    let streak = 0
    const checkDate = new Date(todayStr + 'T00:00:00')

    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toLocaleDateString('en-CA')
      if (dates.includes(dateStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (i === 0) {
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }
    return streak
  }

  const challengerStreak = calculateStreak(challengerCompletions)
  const opponentStreak = calculateStreak(opponentCompletions)

  // Build week progress (Mon-Sun) - grey out days before rivalry started
  const getWeekProgress = (userCompletions: typeof completions) => {
    const monday = new Date(todayStr + 'T00:00:00')
    const dayOfWeek = monday.getDay()
    if (dayOfWeek === 0) {
      monday.setDate(monday.getDate() - 6)
    } else {
      monday.setDate(monday.getDate() - (dayOfWeek - 1))
    }

    const completedDates = new Set((userCompletions || []).map(c => c.completed_date))
    const rivalryStartStr = rivalry.start_date

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const dateStr = date.toLocaleDateString('en-CA')
      const isFuture = dateStr > todayStr
      const isBeforeRivalry = dateStr < rivalryStartStr
      return {
        date: dateStr,
        completed: completedDates.has(dateStr),
        isFuture,
        isBeforeRivalry,
        isToday: dateStr === todayStr,
      }
    })
  }

  // Build full progress for all days of the rivalry
  const getFullProgress = (userCompletions: typeof completions) => {
    const completedDates = new Set((userCompletions || []).map(c => c.completed_date))
    const rivalryStartStr = rivalry.start_date
    const rivalryEndStr = rivalry.end_date

    return Array.from({ length: totalDays }, (_, i) => {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      const dateStr = date.toLocaleDateString('en-CA')
      const isFuture = dateStr > todayStr
      const isBeforeRivalry = dateStr < rivalryStartStr
      const isAfterRivalry = dateStr > rivalryEndStr
      return {
        date: dateStr,
        dayNumber: i + 1,
        completed: completedDates.has(dateStr),
        isFuture,
        isBeforeRivalry,
        isAfterRivalry,
        isToday: dateStr === todayStr,
      }
    })
  }

  // Today's completion status (todayStr already defined above)
  const challengerCompletedToday = challengerCompletions.some(c => c.completed_date === todayStr)
  const opponentCompletedToday = opponentCompletions.some(c => c.completed_date === todayStr)

  // Get initials
  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const rivalryData = {
    id: rivalry.id,
    name: rivalry.name,
    status: rivalry.status,
    startDate: rivalry.start_date,
    endDate: rivalry.end_date,
    daysLeft,
    daysPassed,
    totalDays,
    habitName: habitInfo?.name || rivalry.name,
    habitDescription: habitInfo?.description || null,
    targetValue: habitInfo?.target_value || null,
    targetUnit: habitInfo?.target_unit || null,
    habitIds: habitIds,
    challenger: {
      id: rivalry.challenger_id,
      name: challengerProfile?.name || 'Challenger',
      email: challengerProfile?.email || '',
      initials: getInitials(challengerProfile?.name || null),
      avatarUrl: challengerProfile?.avatar_url || null,
      score: challengerScore,
      streak: challengerStreak,
      completedToday: challengerCompletedToday,
      weekProgress: getWeekProgress(challengerCompletions),
      fullProgress: getFullProgress(challengerCompletions),
      totalCompletions: challengerCompletions.length,
    },
    opponent: {
      id: rivalry.opponent_id,
      name: opponentProfile?.name || 'Opponent',
      email: opponentProfile?.email || '',
      initials: getInitials(opponentProfile?.name || null),
      avatarUrl: opponentProfile?.avatar_url || null,
      score: opponentScore,
      streak: opponentStreak,
      completedToday: opponentCompletedToday,
      weekProgress: getWeekProgress(opponentCompletions),
      fullProgress: getFullProgress(opponentCompletions),
      totalCompletions: opponentCompletions.length,
    },
    comments: (comments || []).map(c => ({
      id: c.id,
      userId: c.user_id,
      contentType: c.content_type as 'text' | 'reaction' | 'gif' | 'system',
      content: c.content,
      gifUrl: c.gif_url,
      createdAt: c.created_at,
    })),
  }

  return (
    <RivalryDetail
      rivalry={rivalryData}
      currentUserId={user.id}
      isChallenger={rivalry.challenger_id === user.id}
    />
  )
}
