import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { RivalryDetailClient } from './RivalryDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function RivalryDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get rivalry details
  const { data: rivalry, error } = await supabase
    .from('habit_rivalries')
    .select(`
      *,
      challenger:profiles!habit_rivalries_challenger_id_fkey(id, name, email, avatar_url),
      opponent:profiles!habit_rivalries_opponent_id_fkey(id, name, email, avatar_url)
    `)
    .eq('id', id)
    .single()

  if (error || !rivalry) {
    notFound()
  }

  // Verify user has access (is coach, challenger, or opponent)
  if (rivalry.coach_id !== user.id && rivalry.challenger_id !== user.id && rivalry.opponent_id !== user.id) {
    notFound()
  }

  // Get habits linked to this rivalry
  const { data: rivalryHabits } = await supabase
    .from('client_habits')
    .select(`
      *,
      habit:habit_templates(id, name, category)
    `)
    .eq('rivalry_id', id)

  // Get completions for this rivalry's date range
  const { data: completions } = await supabase
    .from('habit_completions')
    .select('*')
    .in('client_habit_id', (rivalryHabits || []).map(h => h.id))
    .gte('completed_date', rivalry.start_date)
    .lte('completed_date', rivalry.end_date)
    .order('completed_date', { ascending: false })

  // Get comments/interactions
  const { data: comments } = await supabase
    .from('rivalry_comments')
    .select(`
      *,
      user:profiles!rivalry_comments_user_id_fkey(id, name, avatar_url)
    `)
    .eq('rivalry_id', id)
    .order('created_at', { ascending: true })

  // Calculate scores
  const challengerHabits = (rivalryHabits || []).filter(h => h.client_id === rivalry.challenger_id)
  const opponentHabits = (rivalryHabits || []).filter(h => h.client_id === rivalry.opponent_id)

  const challengerScore = (completions || []).filter(c =>
    challengerHabits.some(h => h.id === c.client_habit_id)
  ).length

  const opponentScore = (completions || []).filter(c =>
    opponentHabits.some(h => h.id === c.client_habit_id)
  ).length

  // Build daily completion data for the chart
  const dailyData: { date: string; challenger: number; opponent: number }[] = []
  const startDate = new Date(rivalry.start_date)
  const endDate = new Date(rivalry.end_date)
  const today = new Date()

  for (let d = new Date(startDate); d <= endDate && d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const challengerCount = (completions || []).filter(c =>
      challengerHabits.some(h => h.id === c.client_habit_id) && c.completed_date === dateStr
    ).length
    const opponentCount = (completions || []).filter(c =>
      opponentHabits.some(h => h.id === c.client_habit_id) && c.completed_date === dateStr
    ).length

    dailyData.push({
      date: dateStr,
      challenger: challengerCount,
      opponent: opponentCount,
    })
  }

  return (
    <RivalryDetailClient
      rivalry={{
        id: rivalry.id,
        name: rivalry.name,
        status: rivalry.status,
        startDate: rivalry.start_date,
        endDate: rivalry.end_date,
        winnerId: rivalry.winner_id,
        challenger: {
          id: rivalry.challenger_id,
          name: rivalry.challenger?.name || 'Unknown',
          avatar_url: rivalry.challenger?.avatar_url,
          score: challengerScore,
        },
        opponent: {
          id: rivalry.opponent_id,
          name: rivalry.opponent?.name || 'Unknown',
          avatar_url: rivalry.opponent?.avatar_url,
          score: opponentScore,
        },
      }}
      habits={(rivalryHabits || []).map(h => ({
        id: h.id,
        name: h.habit?.name || 'Unknown',
        clientId: h.client_id,
      }))}
      dailyData={dailyData}
      comments={(comments || []).map(c => ({
        id: c.id,
        userId: c.user_id,
        userName: c.user?.name || 'Unknown',
        userAvatar: c.user?.avatar_url,
        contentType: c.content_type,
        content: c.content,
        gifUrl: c.gif_url,
        createdAt: c.created_at,
      }))}
      currentUserId={user.id}
      isCoach={rivalry.coach_id === user.id}
    />
  )
}
