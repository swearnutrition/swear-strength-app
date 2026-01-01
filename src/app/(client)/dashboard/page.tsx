import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

interface WorkoutDay {
  id: string
  day_number: number
  name: string
  subtitle: string | null
  is_rest_day: boolean
  workout_exercises: { id: string }[]
}

interface WeekWorkoutInfo {
  id: string
  name: string
  subtitle: string | null
  exerciseCount: number
  estimatedDuration: number
  week: number
  dayNumber: number
  completed: boolean
}

interface ProgramWeek {
  id: string
  week_number: number
  workout_days: WorkoutDay[]
}

export default async function ClientDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get user's active program assignment (including scheduled_days)
  const { data: assignment } = await supabase
    .from('user_program_assignments')
    .select(`
      *,
      programs(name, description)
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  // Check if schedule needs to be set
  const needsSchedule = assignment && !assignment.scheduled_days

  // Get initials for avatar
  const initials = (profile.name as string)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const greeting = getGreeting()
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.

  // Generate this week's days (Monday start)
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // Monday
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  // Get this week's workout logs
  const { data: thisWeekLogs } = await supabase
    .from('workout_logs')
    .select('id, workout_day_id, started_at, completed_at')
    .eq('user_id', user.id)
    .gte('started_at', startOfWeek.toISOString())
    .lte('started_at', endOfWeek.toISOString())

  // Get completed workout dates
  const completedDates = new Set(
    (thisWeekLogs || [])
      .filter(log => log.completed_at)
      .map(log => new Date(log.started_at).toDateString())
  )

  // Get program structure for today's workout and scheduled days
  let todayWorkout = null
  let totalWorkoutsInWeek = 4 // default
  const scheduledDays = new Set<number>()
  let workoutDaysCount = 0
  const weekWorkouts: Record<number, WeekWorkoutInfo> = {} // Map day index (0-6) to workout
  let programWorkoutDays: Array<{
    id: string
    name: string
    subtitle: string | null
    exerciseCount: number
    estimatedDuration: number
    week: number
    dayNumber: number
  }> = []
  let isFlexibleMode = false

  if (assignment) {
    const { data: programWeeks } = await supabase
      .from('program_weeks')
      .select(`
        id,
        week_number,
        workout_days(
          id,
          day_number,
          name,
          subtitle,
          is_rest_day,
          workout_exercises(id)
        )
      `)
      .eq('program_id', assignment.program_id)
      .eq('week_number', assignment.current_week)
      .single()

    if (programWeeks?.workout_days) {
      const weeks = programWeeks as ProgramWeek
      // Filter to only days that have actual workout exercises (not rest days or cardio-only days)
      const workoutDays = weeks.workout_days
        .filter(d => !d.is_rest_day && d.workout_exercises.length > 0)
        .sort((a, b) => a.day_number - b.day_number)
      workoutDaysCount = workoutDays.length
      totalWorkoutsInWeek = workoutDays.length

      // Build programWorkoutDays for client to use for future/past weeks
      programWorkoutDays = workoutDays.map(d => ({
        id: d.id,
        name: d.name,
        subtitle: d.subtitle,
        exerciseCount: d.workout_exercises.length,
        estimatedDuration: Math.round(d.workout_exercises.length * 3.5),
        week: assignment.current_week,
        dayNumber: d.day_number,
      }))

      // Use scheduled_days from assignment if set, otherwise fall back to program day numbers
      if (assignment.scheduled_days && Array.isArray(assignment.scheduled_days)) {
        // User has set their schedule - use it
        assignment.scheduled_days.forEach((d: number) => scheduledDays.add(d))
        const sortedSchedule = [...assignment.scheduled_days].sort((a: number, b: number) => a - b)

        // Build weekWorkouts map for all scheduled days
        sortedSchedule.forEach((scheduleDay, scheduleIndex) => {
          const workoutDay = workoutDays[scheduleIndex % workoutDays.length]
          if (workoutDay) {
            // Find which week day index (0-6, Monday=0) this schedule day falls on
            // scheduleDay is JS day (0=Sun, 1=Mon, etc), convert to week index (0=Mon)
            const weekIndex = scheduleDay === 0 ? 6 : scheduleDay - 1
            const alreadyCompleted = (thisWeekLogs || []).some(
              log => log.workout_day_id === workoutDay.id && log.completed_at
            )
            weekWorkouts[weekIndex] = {
              id: workoutDay.id,
              name: workoutDay.name,
              subtitle: workoutDay.subtitle,
              exerciseCount: workoutDay.workout_exercises.length,
              estimatedDuration: Math.round(workoutDay.workout_exercises.length * 3.5),
              week: assignment.current_week,
              dayNumber: workoutDay.day_number,
              completed: alreadyCompleted,
            }
          }
        })

        // Set todayWorkout if today is a scheduled day
        if (scheduledDays.has(dayOfWeek)) {
          const todayIndex = sortedSchedule.indexOf(dayOfWeek)
          const todayWorkoutDay = workoutDays[todayIndex % workoutDays.length]

          if (todayWorkoutDay) {
            const alreadyCompleted = (thisWeekLogs || []).some(
              log => log.workout_day_id === todayWorkoutDay.id && log.completed_at
            )

            if (!alreadyCompleted) {
              todayWorkout = {
                id: todayWorkoutDay.id,
                name: todayWorkoutDay.name,
                subtitle: todayWorkoutDay.subtitle,
                exerciseCount: todayWorkoutDay.workout_exercises.length,
                estimatedDuration: Math.round(todayWorkoutDay.workout_exercises.length * 3.5),
                week: assignment.current_week,
                dayNumber: todayWorkoutDay.day_number,
              }
            }
          }
        }
      } else {
        // Flexible mode - no fixed schedule
        isFlexibleMode = true;

        // For flexible mode, build weekWorkouts based on ACTUAL completed workout logs
        // Map completed workouts to the days they were completed on
        (thisWeekLogs || []).forEach((log: { id: string; workout_day_id: string; started_at: string; completed_at: string | null }) => {
          if (!log.completed_at) return

          const logDate = new Date(log.started_at)
          const logJsDay = logDate.getDay()
          const weekIndex = logJsDay === 0 ? 6 : logJsDay - 1

          // Find which workout this is
          const workoutDay = workoutDays.find(d => d.id === log.workout_day_id)
          if (workoutDay) {
            weekWorkouts[weekIndex] = {
              id: workoutDay.id,
              name: workoutDay.name,
              subtitle: workoutDay.subtitle,
              exerciseCount: workoutDay.workout_exercises.length,
              estimatedDuration: Math.round(workoutDay.workout_exercises.length * 3.5),
              week: assignment.current_week,
              dayNumber: workoutDay.day_number,
              completed: true,
            }
          }
        })

        // For today in flexible mode, show the next workout they should do
        // Find how many workouts they've completed this week
        const completedWorkoutIds = new Set(
          (thisWeekLogs || [])
            .filter(log => log.completed_at)
            .map(log => log.workout_day_id)
        )

        // Find the next workout in sequence they haven't done yet
        const nextWorkoutDay = workoutDays.find(d => !completedWorkoutIds.has(d.id))

        if (nextWorkoutDay) {
          todayWorkout = {
            id: nextWorkoutDay.id,
            name: nextWorkoutDay.name,
            subtitle: nextWorkoutDay.subtitle,
            exerciseCount: nextWorkoutDay.workout_exercises.length,
            estimatedDuration: Math.round(nextWorkoutDay.workout_exercises.length * 3.5),
            week: assignment.current_week,
            dayNumber: nextWorkoutDay.day_number,
          }
        }
      }
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    const jsDay = date.getDay()
    const weekIndex = jsDay === 0 ? 6 : jsDay - 1
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dayNum: date.getDate(),
      isToday: date.toDateString() === today.toDateString(),
      isPast: date < today && date.toDateString() !== today.toDateString(),
      completed: completedDates.has(date.toDateString()),
      // For flexible mode, hasWorkout is true if there's a completed workout on that day
      // For scheduled mode, hasWorkout is true if that day is in the schedule
      hasWorkout: isFlexibleMode ? !!weekWorkouts[weekIndex] : scheduledDays.has(jsDay),
    }
  })

  const workoutsThisWeek = completedDates.size

  // Get client's assigned habits
  const { data: clientHabits } = await supabase
    .from('client_habits')
    .select(`
      id,
      custom_target_value,
      custom_target_unit,
      habit_templates(
        name,
        description,
        target_value,
        target_unit,
        category
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .order('created_at')
    .limit(4) // Show top 4 on dashboard

  // Get today's habit completions (use local date)
  const todayStr = today.toLocaleDateString('en-CA') // YYYY-MM-DD in local timezone
  const { data: todayCompletions } = await supabase
    .from('habit_completions')
    .select('id, client_habit_id, value')
    .eq('client_id', user.id)
    .eq('completed_date', todayStr)

  // Get this week's habit completions for the expandable week view
  const weekStartStr = startOfWeek.toLocaleDateString('en-CA')
  const weekEndStr = endOfWeek.toLocaleDateString('en-CA')
  const { data: weekHabitCompletions } = await supabase
    .from('habit_completions')
    .select('id, client_habit_id, completed_date, value')
    .eq('client_id', user.id)
    .gte('completed_date', weekStartStr)
    .lte('completed_date', weekEndStr)

  // Calculate streak (simplified)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { data: recentCompletions } = await supabase
    .from('habit_completions')
    .select('completed_date, client_habit_id')
    .eq('client_id', user.id)
    .gte('completed_date', sevenDaysAgo.toLocaleDateString('en-CA'))

  // Simple streak calculation
  let overallStreak = 0
  if (recentCompletions && clientHabits && clientHabits.length > 0) {
    const completionsByDate = recentCompletions.reduce((acc, c) => {
      if (!acc[c.completed_date]) acc[c.completed_date] = new Set()
      acc[c.completed_date].add(c.client_habit_id)
      return acc
    }, {} as Record<string, Set<string>>)

    const checkDate = new Date(today)
    // Check if today has all habits complete
    const todayCompletionIds = completionsByDate[todayStr] || new Set()
    const allTodayComplete = clientHabits.every(h => todayCompletionIds.has(h.id))

    if (allTodayComplete) {
      overallStreak = 1
      // Check previous days
      for (let i = 1; i <= 7; i++) {
        checkDate.setDate(checkDate.getDate() - 1)
        const dateStr = checkDate.toLocaleDateString('en-CA')
        const dayCompletions = completionsByDate[dateStr] || new Set()
        if (clientHabits.every(h => dayCompletions.has(h.id))) {
          overallStreak++
        } else {
          break
        }
      }
    }
  }

  // Get active rivalry for the client
  const { data: rivalryData } = await supabase
    .from('habit_rivalries')
    .select(`
      id,
      name,
      start_date,
      end_date,
      challenger_id,
      opponent_id
    `)
    .eq('status', 'active')
    .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle()

  // Transform rivalry data if exists
  let rivalry = null
  if (rivalryData) {
    const isChallenger = rivalryData.challenger_id === user.id
    const opponentId = isChallenger ? rivalryData.opponent_id : rivalryData.challenger_id

    // Get opponent profile
    const { data: opponentProfile } = await supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', opponentId)
      .single()

    const opponentName = opponentProfile?.name || 'Opponent'

    // Get initials for rivalry card
    const getInitial = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 1)
    const userInitial = getInitial(profile.name)
    const opponentInitial = getInitial(opponentName)

    // Get linked habits for this rivalry
    const { data: rivalryHabits } = await supabase
      .from('client_habits')
      .select('id, client_id, habit_templates(name, category)')
      .eq('rivalry_id', rivalryData.id)

    // Get habit template info from the linked habits
    const myRivalryHabit = rivalryHabits?.find(h => h.client_id === user.id)
    const habitTemplate = myRivalryHabit?.habit_templates as { name?: string; category?: string } | { name?: string; category?: string }[] | null
    let habitName = rivalryData.name
    if (habitTemplate) {
      if (Array.isArray(habitTemplate)) {
        habitName = habitTemplate[0]?.name || rivalryData.name
      } else {
        habitName = habitTemplate.name || rivalryData.name
      }
    }

    // Calculate days left
    const endDate = new Date(rivalryData.end_date)
    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

    // Get habit IDs for this rivalry
    const rivalryHabitIds = rivalryHabits?.map(h => h.id) || []

    // Get completions for rivalry period to calculate scores
    const { data: rivalryCompletions } = await supabase
      .from('habit_completions')
      .select('client_id, completed_date, client_habit_id')
      .in('client_habit_id', rivalryHabitIds)
      .gte('completed_date', rivalryData.start_date)
      .lte('completed_date', rivalryData.end_date)

    // Calculate scores based on days in rivalry
    const rivalryStart = new Date(rivalryData.start_date)
    const totalDays = Math.ceil((endDate.getTime() - rivalryStart.getTime()) / (1000 * 60 * 60 * 24))
    const daysPassed = Math.max(1, Math.min(totalDays, Math.ceil((today.getTime() - rivalryStart.getTime()) / (1000 * 60 * 60 * 24))))

    const myCompletions = (rivalryCompletions || []).filter(c => c.client_id === user.id).length
    const opponentCompletionCount = (rivalryCompletions || []).filter(c => c.client_id === opponentId).length

    const myScore = Math.round((myCompletions / daysPassed) * 100)
    const opponentScore = Math.round((opponentCompletionCount / daysPassed) * 100)

    rivalry = {
      id: rivalryData.id,
      habit_name: habitName || rivalryData.name,
      opponent_name: opponentName,
      my_score: myScore,
      opponent_score: opponentScore,
      days_left: daysLeft,
      user_initial: userInitial,
      opponent_initial: opponentInitial,
      user_avatar_url: profile.avatar_url || null,
      opponent_avatar_url: opponentProfile?.avatar_url || null,
    }
  }

  // Generate habit week days for the expandable week view
  const habitWeekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    return {
      dayName: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dateStr: date.toLocaleDateString('en-CA'), // YYYY-MM-DD
      isToday: date.toDateString() === today.toDateString(),
      isPast: date < today && date.toDateString() !== today.toDateString(),
      isFuture: date > today,
    }
  })

  // Build schedule info for the client
  const scheduleInfo = assignment ? {
    assignmentId: assignment.id,
    programName: assignment.programs?.name || 'Your Program',
    workoutDaysPerWeek: workoutDaysCount,
    scheduledDays: assignment.scheduled_days as number[] | null,
    needsSchedule,
    isFlexibleMode,
  } : null

  return (
    <DashboardClient
      userName={profile.name}
      initials={initials}
      userId={user.id}
      greeting={greeting}
      todayWorkout={todayWorkout}
      weekDays={weekDays}
      weekWorkouts={weekWorkouts}
      workoutsThisWeek={workoutsThisWeek}
      totalWorkoutsInWeek={totalWorkoutsInWeek}
      habits={clientHabits || []}
      todayCompletions={todayCompletions || []}
      weekHabitCompletions={weekHabitCompletions || []}
      habitWeekDays={habitWeekDays}
      overallStreak={overallStreak}
      rivalry={rivalry}
      scheduleInfo={scheduleInfo}
      programWorkoutDays={programWorkoutDays}
    />
  )
}
