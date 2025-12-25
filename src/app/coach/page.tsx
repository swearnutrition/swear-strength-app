import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachDashboardClient } from './CoachDashboardClient'

export default async function CoachDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get coach profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get all clients
  const { data: clients } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'client')

  const clientCount = clients?.length || 0

  // Get program count
  const { count: programCount } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })

  // Get exercise count
  const { count: exerciseCount } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true })

  // Get today's date info
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  // Get workouts completed today
  const todayStart = new Date(today)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const { count: workoutsToday } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .not('completed_at', 'is', null)
    .gte('completed_at', todayStart.toISOString())
    .lte('completed_at', todayEnd.toISOString())

  // Get workouts this week
  const { count: workoutsThisWeek } = await supabase
    .from('workout_logs')
    .select('*', { count: 'exact', head: true })
    .not('completed_at', 'is', null)
    .gte('completed_at', startOfWeek.toISOString())

  // Get PRs this week
  const { count: prsThisWeek } = await supabase
    .from('personal_records')
    .select('*', { count: 'exact', head: true })
    .gte('achieved_at', startOfWeek.toISOString())

  // Get recent workout completions
  const { data: recentCompletions } = await supabase
    .from('workout_logs')
    .select(`
      *,
      profiles!workout_logs_user_id_fkey(name, email),
      workout_days(name)
    `)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5)

  // Get recent PRs
  const { data: recentPRs } = await supabase
    .from('personal_records')
    .select(`
      *,
      profiles!personal_records_user_id_fkey(name, email),
      exercises(name)
    `)
    .order('achieved_at', { ascending: false })
    .limit(5)

  // Build recent activity
  type ActivityItem = {
    id: string
    type: 'completion' | 'pr' | 'note'
    client: string
    avatar: string
    action: string
    detail: string
    time: string
    extra: string
    timestamp: string
  }

  const recentActivity: ActivityItem[] = []

  if (recentCompletions) {
    recentCompletions.forEach((completion) => {
      const clientName = (completion.profiles as { name?: string })?.name || 'Unknown'
      recentActivity.push({
        id: `completion-${completion.id}`,
        type: 'completion',
        client: clientName,
        avatar: clientName[0]?.toUpperCase() || 'U',
        action: 'completed',
        detail: (completion.workout_days as { name?: string })?.name || 'Workout',
        time: formatRelativeDate(completion.completed_at),
        extra: completion.duration_minutes ? `${completion.duration_minutes} min` : '',
        timestamp: completion.completed_at || '',
      })
    })
  }

  if (recentPRs) {
    recentPRs.forEach((pr) => {
      const clientName = (pr.profiles as { name?: string })?.name || 'Unknown'
      recentActivity.push({
        id: `pr-${pr.id}`,
        type: 'pr',
        client: clientName,
        avatar: clientName[0]?.toUpperCase() || 'U',
        action: 'hit a PR',
        detail: (pr.exercises as { name?: string })?.name || 'Exercise',
        time: formatRelativeDate(pr.achieved_at),
        extra: `${pr.value} ${pr.weight_unit || 'lbs'}`,
        timestamp: pr.achieved_at || '',
      })
    })
  }

  // Sort by timestamp
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <CoachDashboardClient
      profile={profile}
      user={user}
      stats={{
        clientCount,
        workoutsToday: workoutsToday || 0,
        workoutsThisWeek: workoutsThisWeek || 0,
        prsThisWeek: prsThisWeek || 0,
        exerciseCount: exerciseCount || 0,
        programCount: programCount || 0,
        unreadNotes: 0,
      }}
      recentActivity={recentActivity}
    />
  )
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
