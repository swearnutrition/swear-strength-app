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

  // Get coach's programs first
  const { data: coachPrograms } = await supabase
    .from('programs')
    .select('id')
    .eq('created_by', user.id)

  const coachProgramIds = (coachPrograms || []).map(p => p.id)

  // Get client IDs assigned to coach's programs
  const { data: coachClientAssignments } = coachProgramIds.length > 0
    ? await supabase
        .from('user_program_assignments')
        .select('user_id')
        .in('program_id', coachProgramIds)
        .eq('is_active', true)
    : { data: [] }

  const coachClientIds = [...new Set((coachClientAssignments || []).map(a => a.user_id))]

  // Get recent workout completions with set data for volume calculation
  // Only show workouts from clients assigned to coach's programs
  const { data: recentCompletions, error: completionsError } = coachClientIds.length > 0
    ? await supabase
        .from('workout_logs')
        .select(`
          *,
          profiles!workout_logs_user_id_fkey(name, email, avatar_url),
          workout_days(name)
        `)
        .in('user_id', coachClientIds)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(10)
    : { data: [], error: null }

  // For each completion, get the sets to calculate volume and find PRs
  const completionsWithDetails = await Promise.all(
    (recentCompletions || []).map(async (completion) => {
      // Get sets for this workout log
      const { data: sets } = await supabase
        .from('set_logs')
        .select('weight, reps_completed')
        .eq('workout_log_id', completion.id)

      // Calculate total volume and set count
      let totalVolume = 0
      let totalSets = 0
      if (sets) {
        for (const set of sets) {
          if (set.weight && set.reps_completed) {
            totalVolume += Number(set.weight) * Number(set.reps_completed)
          }
          totalSets++
        }
      }

      // Check if any PRs were achieved in this workout
      const { data: prs } = await supabase
        .from('personal_records')
        .select('exercise_id, exercises(name)')
        .eq('user_id', completion.user_id)
        .gte('achieved_at', new Date(new Date(completion.completed_at!).getTime() - 60000).toISOString())
        .lte('achieved_at', new Date(new Date(completion.completed_at!).getTime() + 60000).toISOString())
        .limit(1)

      const prExercise = prs && prs.length > 0
        ? (prs[0].exercises as { name?: string })?.name
        : null

      // Calculate duration from started_at and completed_at
      let durationMinutes: number | undefined
      if (completion.started_at && completion.completed_at) {
        const startTime = new Date(completion.started_at).getTime()
        const endTime = new Date(completion.completed_at).getTime()
        durationMinutes = Math.round((endTime - startTime) / 60000)
      }

      return {
        ...completion,
        totalVolume,
        totalSets,
        prExercise,
        durationMinutes,
      }
    })
  )

  // Get top performers - clients with best compliance this week
  const { data: clientAssignments } = await supabase
    .from('user_program_assignments')
    .select(`
      user_id,
      profiles!user_program_assignments_user_id_fkey(name, avatar_url)
    `)
    .eq('is_active', true)

  // Calculate compliance for each client
  type TopPerformer = {
    userId: string
    name: string
    avatar: string
    compliance: number
    workoutsCompleted: number
    streak: number
  }

  const topPerformers: TopPerformer[] = []

  if (clientAssignments && clientAssignments.length > 0) {
    for (const assignment of clientAssignments) {
      const clientProfile = assignment.profiles as { name?: string; avatar_url?: string } | null
      if (!clientProfile?.name) continue

      // Get workouts completed this week for this client
      const { count: clientWorkoutsThisWeek } = await supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', assignment.user_id)
        .not('completed_at', 'is', null)
        .gte('completed_at', startOfWeek.toISOString())

      // Get streak (consecutive days with completed workouts)
      const { data: recentWorkouts } = await supabase
        .from('workout_logs')
        .select('completed_at')
        .eq('user_id', assignment.user_id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(30)

      let streak = 0
      if (recentWorkouts && recentWorkouts.length > 0) {
        const workoutDates = new Set(
          recentWorkouts.map(w => new Date(w.completed_at!).toDateString())
        )
        const checkDate = new Date()
        // Check if there's a workout today or yesterday to start streak
        const todayStr = checkDate.toDateString()
        checkDate.setDate(checkDate.getDate() - 1)
        const yesterdayStr = checkDate.toDateString()

        if (workoutDates.has(todayStr) || workoutDates.has(yesterdayStr)) {
          // Count consecutive days backwards
          const startDate = workoutDates.has(todayStr) ? new Date() : new Date(Date.now() - 86400000)
          for (let i = 0; i < 30; i++) {
            const dateStr = new Date(startDate.getTime() - i * 86400000).toDateString()
            if (workoutDates.has(dateStr)) {
              streak++
            } else {
              break
            }
          }
        }
      }

      // Assume 4 scheduled workouts per week for compliance calculation
      const scheduledPerWeek = 4
      const compliance = Math.min(100, Math.round(((clientWorkoutsThisWeek || 0) / scheduledPerWeek) * 100))

      topPerformers.push({
        userId: assignment.user_id,
        name: clientProfile.name,
        avatar: clientProfile.name[0]?.toUpperCase() || 'C',
        compliance,
        workoutsCompleted: clientWorkoutsThisWeek || 0,
        streak,
      })
    }

    // Sort by compliance, then by streak
    topPerformers.sort((a, b) => {
      if (b.compliance !== a.compliance) return b.compliance - a.compliance
      return b.streak - a.streak
    })
  }

  // Get weekly schedule data - actual workouts completed per day
  // First, get all client scheduled_days with their names to show in tooltips
  const { data: allAssignments } = await supabase
    .from('user_program_assignments')
    .select(`
      user_id,
      scheduled_days,
      profiles!user_program_assignments_user_id_fkey(name)
    `)
    .eq('is_active', true)

  // Track clients scheduled for each day of the week (0=Sun, 6=Sat)
  const scheduledClientsPerDay: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

  if (allAssignments) {
    for (const assignment of allAssignments) {
      const clientName = (assignment.profiles as { name?: string } | null)?.name || 'Unknown'
      if (assignment.scheduled_days && Array.isArray(assignment.scheduled_days)) {
        // Client has specific scheduled days
        for (const day of assignment.scheduled_days) {
          if (!scheduledClientsPerDay[day]) scheduledClientsPerDay[day] = []
          scheduledClientsPerDay[day].push(clientName)
        }
      }
      // If no scheduled_days, client is in flexible mode - don't count them as "scheduled"
    }
  }

  // Build a map of user_id -> client name for quick lookups
  const clientNameMap: Record<string, string> = {}
  if (allAssignments) {
    for (const assignment of allAssignments) {
      const clientName = (assignment.profiles as { name?: string } | null)?.name || 'Unknown'
      clientNameMap[assignment.user_id] = clientName
    }
  }

  // Also build a map of which days each client is scheduled (user_id -> day numbers)
  const clientScheduledDays: Record<string, number[]> = {}
  if (allAssignments) {
    for (const assignment of allAssignments) {
      if (assignment.scheduled_days && Array.isArray(assignment.scheduled_days)) {
        clientScheduledDays[assignment.user_id] = assignment.scheduled_days
      }
    }
  }

  const weekScheduleData: {
    day: string
    date: number
    scheduled: number
    completed: number
    isToday: boolean
    isPast: boolean
    scheduledClients: string[]
    completedClients: string[]
    missedClients: string[]
    unplannedClients: string[] // Clients who completed but weren't scheduled for this day
  }[] = []
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayOfWeek = today.getDay()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(weekStart)
    dayDate.setDate(weekStart.getDate() + i)
    const dayStart = new Date(dayDate)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayDate)
    dayEnd.setHours(23, 59, 59, 999)

    const isPast = dayDate < today && dayDate.toDateString() !== today.toDateString()
    const isToday = dayDate.toDateString() === today.toDateString()

    // Get completed workouts for this day with user info
    const { data: dayCompletions } = await supabase
      .from('workout_logs')
      .select('user_id')
      .not('completed_at', 'is', null)
      .gte('completed_at', dayStart.toISOString())
      .lte('completed_at', dayEnd.toISOString())

    const completedUserIds = new Set((dayCompletions || []).map(c => c.user_id))
    const scheduledClientNames = scheduledClientsPerDay[i] || []

    // For past days and today, determine who completed vs who missed vs unplanned
    const completedClients: string[] = []
    const missedClients: string[] = []
    const unplannedClients: string[] = []

    if (isPast || isToday) {
      // Track which user IDs were scheduled for this day
      const scheduledUserIds = new Set<string>()
      for (const [userId, scheduledDays] of Object.entries(clientScheduledDays)) {
        if (scheduledDays.includes(i)) {
          scheduledUserIds.add(userId)
        }
      }

      // Find which scheduled clients completed their workout
      for (const [userId, scheduledDays] of Object.entries(clientScheduledDays)) {
        if (scheduledDays.includes(i)) {
          const clientName = clientNameMap[userId] || 'Unknown'
          if (completedUserIds.has(userId)) {
            completedClients.push(clientName)
          } else if (isPast) {
            // Only mark as missed if the day has passed
            missedClients.push(clientName)
          }
        }
      }

      // Find unplanned completions - people who completed but weren't scheduled
      for (const userId of completedUserIds) {
        if (!scheduledUserIds.has(userId)) {
          const clientName = clientNameMap[userId] || 'Unknown'
          unplannedClients.push(clientName)
        }
      }
    }

    weekScheduleData.push({
      day: days[i],
      date: dayDate.getDate(),
      scheduled: scheduledClientsPerDay[i]?.length || 0,
      completed: completedUserIds.size,
      isToday,
      isPast,
      scheduledClients: scheduledClientNames,
      completedClients,
      missedClients,
      unplannedClients,
    })
  }

  // Get unread coach notifications (missed workouts, etc.)
  const { data: coachNotifications } = await supabase
    .from('coach_notifications')
    .select(`
      id,
      type,
      title,
      message,
      data,
      read,
      created_at,
      client_id,
      profiles!coach_notifications_client_id_fkey(name, avatar_url)
    `)
    .eq('coach_id', user.id)
    .eq('read', false)
    .order('created_at', { ascending: false })
    .limit(10)

  // Build recent activity
  type ActivityItem = {
    id: string
    type: 'completion' | 'pr' | 'note'
    client: string
    avatar: string
    avatarUrl?: string
    workoutName: string
    programName?: string
    durationMinutes?: number
    totalVolume: number
    totalSets: number
    prExercise?: string
    time: string
    timestamp: string
  }

  const recentActivity: ActivityItem[] = []

  if (completionsWithDetails) {
    completionsWithDetails.forEach((completion) => {
      const clientProfile = completion.profiles as { name?: string; avatar_url?: string } | null
      const clientName = clientProfile?.name || 'Unknown'
      const workoutDay = completion.workout_days as { name?: string } | null

      recentActivity.push({
        id: `completion-${completion.id}`,
        type: 'completion',
        client: clientName,
        avatar: clientName[0]?.toUpperCase() || 'U',
        avatarUrl: clientProfile?.avatar_url || undefined,
        workoutName: workoutDay?.name || 'Workout',
        programName: undefined,
        durationMinutes: completion.durationMinutes || undefined,
        totalVolume: completion.totalVolume,
        totalSets: completion.totalSets,
        prExercise: completion.prExercise || undefined,
        time: formatRelativeDate(completion.completed_at),
        timestamp: completion.completed_at || '',
      })
    })
  }

  // Sort by timestamp (already sorted from DB but ensure order)
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Transform coach notifications into "needs attention" items
  type AttentionItem = {
    id: string
    clientId: string
    name: string
    avatar: string
    issue: string
    severity: 'high' | 'medium'
    detail: string
    time: string
  }

  const clientsNeedingAttention: AttentionItem[] = (coachNotifications || []).map((notification) => {
    const clientProfile = notification.profiles as { name?: string; avatar_url?: string } | null
    const clientName = clientProfile?.name || 'Client'
    const data = notification.data as { program_name?: string; missed_date?: string } | null

    return {
      id: notification.id,
      clientId: notification.client_id,
      name: clientName,
      avatar: clientName[0]?.toUpperCase() || 'C',
      issue: notification.message || 'Needs attention',
      severity: notification.type === 'missed_workout' ? 'high' : 'medium',
      detail: data?.program_name || '',
      time: formatRelativeDate(notification.created_at),
    }
  })

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
      clientsNeedingAttention={clientsNeedingAttention}
      topPerformers={topPerformers.slice(0, 5)}
      weekScheduleData={weekScheduleData}
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
