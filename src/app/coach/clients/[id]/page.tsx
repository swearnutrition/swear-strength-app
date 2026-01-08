import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ClientDetailClient } from './ClientDetailClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get client profile
  const { data: client, error: clientError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('role', 'client')
    .single()

  if (clientError || !client) {
    notFound()
  }

  // Get active program assignment
  const { data: assignment } = await supabase
    .from('user_program_assignments')
    .select(`
      *,
      program:programs(
        id,
        name,
        weeks:program_weeks(
          id,
          week_number,
          days:workout_days(
            id,
            day_number,
            name,
            exercises:workout_exercises(
              id,
              exercise:exercises(id, name, primary_muscle, secondary_muscles),
              sets,
              section
            )
          )
        )
      )
    `)
    .eq('user_id', id)
    .eq('is_active', true)
    .single()

  // Get archived program assignments (past programs)
  const { data: archivedAssignments } = await supabase
    .from('user_program_assignments')
    .select(`
      id,
      started_at,
      current_week,
      is_active,
      program:programs(id, name)
    `)
    .eq('user_id', id)
    .eq('is_active', false)
    .order('started_at', { ascending: false })

  // Get archived habits
  const { data: archivedHabits } = await supabase
    .from('client_habits')
    .select(`
      id,
      start_date,
      is_active,
      habit:habit_templates(id, name, category)
    `)
    .eq('client_id', id)
    .eq('is_active', false)
    .order('start_date', { ascending: false })

  // Get workout logs (last 8 weeks for weekly volume chart)
  const eightWeeksAgo = new Date()
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56)

  const { data: workoutLogs } = await supabase
    .from('workout_logs')
    .select(`
      *,
      workout_day:workout_days(id, name, day_number),
      completion:workout_completions(difficulty_rating, energy_level, feeling, notes),
      set_logs(
        id,
        set_number,
        weight,
        weight_unit,
        reps_completed,
        workout_exercise:workout_exercises(
          exercise:exercises!workout_exercises_exercise_id_fkey(id, name, primary_muscle),
          section
        )
      )
    `)
    .eq('user_id', id)
    .gte('started_at', eightWeeksAgo.toISOString())
    .order('started_at', { ascending: false })

  // Get personal records
  const { data: personalRecords } = await supabase
    .from('personal_records')
    .select(`
      *,
      exercise:exercises(id, name, primary_muscle)
    `)
    .eq('user_id', id)
    .order('achieved_at', { ascending: false })
    .limit(10)

  // Get client habits with completions (last 28 days)
  const twentyEightDaysAgo = new Date()
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28)

  const { data: clientHabits } = await supabase
    .from('client_habits')
    .select(`
      *,
      habit:habit_templates(id, name, category, frequency)
    `)
    .eq('client_id', id)
    .eq('is_active', true)

  const habitIds = (clientHabits || []).map(h => h.id)

  const { data: habitCompletions } = await supabase
    .from('habit_completions')
    .select('*')
    .in('client_habit_id', habitIds.length > 0 ? habitIds : ['none'])
    .gte('completed_date', twentyEightDaysAgo.toISOString().split('T')[0])
    .order('completed_date', { ascending: false })

  // Get coach's programs for assignment
  const { data: coachPrograms } = await supabase
    .from('programs')
    .select('id, name')
    .eq('created_by', user.id)
    .eq('is_archived', false)
    .order('name')

  // Get coach's habit templates for assignment
  const { data: habitTemplates } = await supabase
    .from('habit_templates')
    .select('id, name, category')
    .eq('created_by', user.id)
    .eq('is_archived', false)
    .order('name')

  // Get all bookings for this client with this coach
  const { data: clientBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select(`
      id,
      coach_id,
      client_id,
      package_id,
      booking_type,
      starts_at,
      ends_at,
      status,
      notes,
      google_meet_link,
      created_at
    `)
    .eq('client_id', id)
    .eq('coach_id', user.id)
    .order('starts_at', { ascending: false })


  // Calculate in-person session stats
  const completedInPersonSessions = (clientBookings || []).filter(
    b => b.booking_type === 'session' && b.status === 'completed'
  ).length

  const upcomingInPersonSessions = (clientBookings || []).filter(
    b => b.booking_type === 'session' && b.status === 'confirmed' && new Date(b.starts_at) > new Date()
  ).length

  // Calculate volume by muscle from actual workout logs
  const volumeByMuscle: Record<string, number> = {}
  const thisWeekStart = new Date()
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay())
  thisWeekStart.setHours(0, 0, 0, 0)

  // Calculate weekly volume data for chart (last 8 weeks)
  const weeklyVolume: { week: string; volume: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    // Include workouts with logged sets (even if not marked complete)
    const weekLogs = (workoutLogs || []).filter(log => {
      const logDate = new Date(log.started_at)
      const hasSetLogs = (log.set_logs?.length || 0) > 0
      return logDate >= weekStart && logDate < weekEnd && (log.completed_at || hasSetLogs)
    })

    let weekVolume = 0
    for (const log of weekLogs) {
      for (const setLog of log.set_logs || []) {
        weekVolume += (setLog.weight || 0) * (setLog.reps_completed || 0)
      }
    }

    weeklyVolume.push({
      week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      volume: Math.round(weekVolume),
    })
  }

  // Calculate this week's volume and last week for comparison
  // Include workouts with logged sets (even if not marked complete)
  const thisWeekLogs = (workoutLogs || []).filter(log => {
    const logDate = new Date(log.started_at)
    const hasSetLogs = (log.set_logs?.length || 0) > 0
    return logDate >= thisWeekStart && (log.completed_at || hasSetLogs)
  })

  let thisWeekVolume = 0
  for (const log of thisWeekLogs) {
    for (const setLog of log.set_logs || []) {
      thisWeekVolume += (setLog.weight || 0) * (setLog.reps_completed || 0)
      // Also track volume by muscle for this week
      const muscle = (setLog.workout_exercise as { exercise?: { primary_muscle?: string } })?.exercise?.primary_muscle
      if (muscle) {
        volumeByMuscle[muscle] = (volumeByMuscle[muscle] || 0) + (setLog.weight || 0) * (setLog.reps_completed || 0)
      }
    }
  }

  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekLogs = (workoutLogs || []).filter(log => {
    const logDate = new Date(log.started_at)
    const hasSetLogs = (log.set_logs?.length || 0) > 0
    return logDate >= lastWeekStart && logDate < thisWeekStart && (log.completed_at || hasSetLogs)
  })

  let lastWeekVolume = 0
  for (const log of lastWeekLogs) {
    for (const setLog of log.set_logs || []) {
      lastWeekVolume += (setLog.weight || 0) * (setLog.reps_completed || 0)
    }
  }

  const volumeChange = lastWeekVolume > 0
    ? Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100)
    : 0

  // Calculate days since last workout (include in-progress workouts with logged sets)
  const lastWorkout = (workoutLogs || []).find(log => log.completed_at || (log.set_logs?.length || 0) > 0)
  const daysSinceWorkout = lastWorkout
    ? Math.floor((Date.now() - new Date(lastWorkout.completed_at || lastWorkout.started_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  // Calculate week streak (consecutive weeks with at least 1 workout)
  let weekStreak = 0
  for (let i = 0; i < 52; i++) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const hasWorkout = (workoutLogs || []).some(log => {
      const logDate = new Date(log.started_at)
      const hasSetLogs = (log.set_logs?.length || 0) > 0
      return logDate >= weekStart && logDate < weekEnd && (log.completed_at || hasSetLogs)
    })

    if (hasWorkout) {
      weekStreak++
    } else if (i > 0) {
      break
    }
  }

  // This week workouts
  const thisWeekWorkouts = thisWeekLogs.length
  const targetWorkouts = 4 // Default target

  // Calculate habit stats
  const habitStats = (clientHabits || []).map(habit => {
    const completions = (habitCompletions || []).filter(c => c.client_habit_id === habit.id)
    const completionDates = new Set(completions.map(c => c.completed_date))

    // Calculate streak
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 28; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      if (completionDates.has(dateStr)) {
        streak++
      } else if (i > 0) {
        break
      }
    }

    // Completion rate based on days since assignment (not arbitrary 28 days)
    const startDate = new Date(habit.start_date)
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    startDate.setHours(0, 0, 0, 0)
    const daysSinceAssignment = Math.max(1, Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    // Cap at 28 days for rate calculation (don't penalize old habits)
    const daysToCount = Math.min(daysSinceAssignment, 28)
    const rate = Math.round((completionDates.size / daysToCount) * 100)

    return {
      id: habit.id,
      name: habit.habit?.name || 'Unknown',
      category: habit.habit?.category || 'lifestyle',
      streak,
      completionRate: rate,
      completions: Array.from(completionDates),
      startDate: habit.start_date,
    }
  })

  // Calculate 4-week consistency (include workouts with logged sets)
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const fourWeekLogs = (workoutLogs || []).filter(log => {
    const logDate = new Date(log.started_at)
    const hasSetLogs = (log.set_logs?.length || 0) > 0
    return logDate >= fourWeeksAgo && (log.completed_at || hasSetLogs)
  })
  const fourWeekConsistency = Math.round((fourWeekLogs.length / (targetWorkouts * 4)) * 100)

  return (
    <ClientDetailClient
      client={{
        id: client.id,
        name: client.name || 'Unknown',
        email: client.email || '',
        avatar_url: client.avatar_url,
        created_at: client.created_at,
        last_login: client.last_login,
        clientType: client.client_type || 'online',
        hybridSessionsPerMonth: client.hybrid_sessions_per_month || 4,
      }}
      program={assignment ? {
        id: assignment.program?.id,
        name: assignment.program?.name || 'Unknown Program',
        currentWeek: assignment.current_week,
        startedAt: assignment.started_at,
      } : null}
      stats={{
        daysSinceWorkout,
        weekStreak,
        thisWeekWorkouts,
        targetWorkouts,
        thisWeekVolume: Math.round(thisWeekVolume),
        volumeChange,
        fourWeekConsistency,
        fourWeekWorkouts: fourWeekLogs.length,
        completedInPersonSessions,
        upcomingInPersonSessions,
        soloWorkouts: fourWeekLogs.length, // Solo workouts from the app
      }}
      weeklyVolume={weeklyVolume}
      volumeByMuscle={volumeByMuscle}
      workoutLogs={(workoutLogs || []).filter(log => log.completed_at || (log.set_logs?.length || 0) > 0).slice(0, 10).map(log => ({
        id: log.id,
        date: log.started_at,
        dayName: log.workout_day?.name || 'Workout',
        completed: !!log.completed_at,
        difficulty: log.completion?.[0]?.difficulty_rating,
        feeling: log.completion?.[0]?.feeling,
        notes: log.completion?.[0]?.notes,
        setCount: log.set_logs?.length || 0,
        totalVolume: (log.set_logs || []).reduce((sum: number, s: { weight?: number; reps_completed?: number }) => {
          return sum + (s.weight || 0) * (s.reps_completed || 0)
        }, 0),
        section: (log.set_logs?.[0]?.workout_exercise as { section?: string })?.section ?? null,
      }))}
      personalRecords={(personalRecords || []).map(pr => ({
        id: pr.id,
        exerciseName: pr.exercise?.name || 'Unknown',
        muscle: pr.exercise?.primary_muscle,
        recordType: pr.record_type,
        value: pr.value,
        reps: pr.record_type === 'max_weight' ? null : pr.value,
        weight: pr.record_type === 'max_weight' ? pr.value : null,
        unit: pr.weight_unit,
        achievedAt: pr.achieved_at,
      }))}
      habitStats={habitStats}
      coachPrograms={(coachPrograms || []).map(p => ({ id: p.id, name: p.name }))}
      habitTemplates={(habitTemplates || []).map(h => ({ id: h.id, name: h.name, category: h.category }))}
      currentUserId={user.id}
      archivedPrograms={(archivedAssignments || []).map(a => {
        const prog = Array.isArray(a.program) ? a.program[0] : a.program
        return {
          id: a.id,
          name: prog?.name || 'Unknown Program',
          startedAt: a.started_at,
          endedWeek: a.current_week,
        }
      })}
      archivedHabits={(archivedHabits || []).map(h => {
        const habit = Array.isArray(h.habit) ? h.habit[0] : h.habit
        return {
          id: h.id,
          name: habit?.name || 'Unknown Habit',
          category: habit?.category || 'lifestyle',
          startDate: h.start_date,
        }
      })}
      bookedSessions={(clientBookings || []).map(b => ({
        id: b.id,
        bookingType: b.booking_type,
        startsAt: b.starts_at,
        endsAt: b.ends_at,
        status: b.status,
        notes: b.notes,
        googleMeetLink: b.google_meet_link,
        createdAt: b.created_at,
      }))}
    />
  )
}
