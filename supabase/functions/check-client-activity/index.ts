import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const COACH_NOTIFICATION_EMAIL = 'notifications@swearnutrition.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============================================
// TYPES
// ============================================

interface Assignment {
  id: string
  user_id: string
  program_id: string
  schedule_mode: 'scheduled' | 'flexible'
  scheduled_days: number[] | null
  reminder_threshold: number | null
  last_reminder_sent_at: string | null
  last_workout_at: string | null
  assigned_at: string | null
  programs: { name: string; created_by: string } | null
  profiles: { name: string; email: string } | null
}

interface ClientHabit {
  id: string
  client_id: string
  coach_id: string
  is_active: boolean
  habit_templates: { name: string } | null
  profiles: { name: string; email: string } | null
}

interface InactiveWorkoutClient {
  clientId: string
  clientName: string
  clientEmail: string
  daysInactive: number
  programName: string
  coachId: string
  type: 'workout'
}

interface InactiveHabitClient {
  clientId: string
  clientName: string
  clientEmail: string
  daysInactive: number
  habitName: string
  coachId: string
  type: 'habit'
}

type InactiveClient = InactiveWorkoutClient | InactiveHabitClient

// Day letters for calendar
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Helper to get week start (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Helper to format date as "Dec 23"
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Helper to get day of month
function getDayOfMonth(date: Date): string {
  return date.getDate().toString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check for force flags in request body
    let forceHabits = false
    try {
      const body = await req.json()
      forceHabits = body?.forceHabits === true
    } catch {
      // No body or invalid JSON, that's fine
    }

    const now = new Date()
    const today = now.toLocaleDateString('en-CA') // YYYY-MM-DD
    const todayDayOfWeek = now.getDay() // 0 = Sunday, 6 = Saturday

    // Check if today is Saturday (habit check day) or force flag is set
    const isSaturday = todayDayOfWeek === 6 || forceHabits

    // Get week boundaries (Monday to Sunday)
    const weekStart = getWeekStart(now)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    console.log(`Checking client activity for ${today} (Saturday: ${isSaturday})`)
    console.log(`Week: ${formatShortDate(weekStart)} - ${formatShortDate(weekEnd)}`)

    const clientNotifications: string[] = []
    const coachNotifications: string[] = []
    const inactiveClients: Map<string, InactiveClient[]> = new Map() // coachId -> clients

    // Track clients who need the new accountability email
    const clientsNeedingEmail: Map<string, {
      clientId: string
      clientName: string
      clientEmail: string
      assignmentId: string
      programName: string
      workoutDaysInactive: number
      habitDaysInactive: number
      habits: { id: string; name: string }[]
    }> = new Map()

    // ============================================
    // WORKOUT ACTIVITY CHECK (DAILY)
    // ============================================

    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_program_assignments')
      .select(`
        id,
        user_id,
        program_id,
        schedule_mode,
        scheduled_days,
        reminder_threshold,
        last_reminder_sent_at,
        last_workout_at,
        assigned_at,
        programs(name, created_by),
        profiles:user_id(name, email)
      `)
      .eq('is_active', true)

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`)
    }

    console.log(`Found ${assignments?.length || 0} active workout assignments`)

    for (const assignment of (assignments || []) as Assignment[]) {
      const clientName = assignment.profiles?.name || 'Client'
      const clientEmail = assignment.profiles?.email
      const program = assignment.programs
      const coachId = program?.created_by
      const programName = program?.name || 'Program'

      if (!coachId || !clientEmail) continue

      // Skip clients who haven't set up their schedule yet
      // They need to configure their workout days before we track activity
      if (!assignment.scheduled_days || assignment.scheduled_days.length === 0) {
        console.log(`Skipping ${clientName} - no schedule configured yet`)
        continue
      }

      // Calculate days since last workout OR since assignment (whichever is more recent)
      let daysInactive = 0
      if (assignment.last_workout_at) {
        const lastWorkout = new Date(assignment.last_workout_at)
        daysInactive = Math.floor((now.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24))
      } else if (assignment.assigned_at) {
        // If no workout logged, count from when they were assigned
        const assignedDate = new Date(assignment.assigned_at)
        daysInactive = Math.floor((now.getTime() - assignedDate.getTime()) / (1000 * 60 * 60 * 24))
      } else {
        // Fallback: treat as new assignment, don't flag as inactive
        daysInactive = 0
      }

      // Check if we already sent a reminder recently (within 7 days for client nudges)
      const recentlySentReminder = assignment.last_reminder_sent_at &&
        (now.getTime() - new Date(assignment.last_reminder_sent_at).getTime()) < 7 * 24 * 60 * 60 * 1000

      // Track for combined email if 7+ days inactive
      if (daysInactive >= 7 && !recentlySentReminder) {
        if (!clientsNeedingEmail.has(assignment.user_id)) {
          clientsNeedingEmail.set(assignment.user_id, {
            clientId: assignment.user_id,
            clientName,
            clientEmail,
            assignmentId: assignment.id,
            programName,
            workoutDaysInactive: daysInactive,
            habitDaysInactive: 0,
            habits: [],
          })
        } else {
          clientsNeedingEmail.get(assignment.user_id)!.workoutDaysInactive = daysInactive
          clientsNeedingEmail.get(assignment.user_id)!.programName = programName
          clientsNeedingEmail.get(assignment.user_id)!.assignmentId = assignment.id
        }
      }

      // ============================================
      // COACH WORKOUT NOTIFICATIONS (4+ days)
      // ============================================

      if (daysInactive >= 4) {
        if (!inactiveClients.has(coachId)) {
          inactiveClients.set(coachId, [])
        }
        inactiveClients.get(coachId)!.push({
          clientId: assignment.user_id,
          clientName,
          clientEmail: clientEmail!,
          daysInactive,
          programName,
          coachId,
          type: 'workout',
        })

        const { data: existingNotif } = await supabase
          .from('coach_notifications')
          .select('id')
          .eq('coach_id', coachId)
          .eq('client_id', assignment.user_id)
          .eq('type', 'workout_inactive')
          .eq('read', false)
          .limit(1)

        if (!existingNotif || existingNotif.length === 0) {
          await supabase.from('coach_notifications').insert({
            coach_id: coachId,
            client_id: assignment.user_id,
            type: 'workout_inactive',
            title: 'Workout Inactive',
            message: `${clientName} hasn't logged a workout in ${daysInactive} days`,
            assignment_id: assignment.id,
            data: { days_inactive: daysInactive, program_name: programName, activity_type: 'workout' },
          })
          coachNotifications.push(`${clientName} - workout (${daysInactive} days)`)
        }
      }
    }

    // ============================================
    // HABIT ACTIVITY CHECK (SATURDAYS ONLY)
    // ============================================

    if (isSaturday) {
      const { data: clientHabits, error: habitsError } = await supabase
        .from('client_habits')
        .select(`
          id,
          client_id,
          coach_id,
          is_active,
          habit_templates(name),
          profiles:client_id(name, email)
        `)
        .eq('is_active', true)

      if (habitsError) {
        throw new Error(`Failed to fetch habits: ${habitsError.message}`)
      }

      console.log(`Found ${clientHabits?.length || 0} active client habits`)

      // Group habits by client
      const clientHabitMap: Map<string, {
        clientId: string
        clientName: string
        clientEmail: string
        coachId: string
        habits: { id: string; name: string }[]
      }> = new Map()

      for (const habit of (clientHabits || []) as ClientHabit[]) {
        const clientId = habit.client_id
        const clientName = habit.profiles?.name || 'Client'
        const clientEmail = habit.profiles?.email
        const habitName = habit.habit_templates?.name || 'Habit'

        if (!clientEmail) continue

        if (!clientHabitMap.has(clientId)) {
          clientHabitMap.set(clientId, {
            clientId,
            clientName,
            clientEmail,
            coachId: habit.coach_id,
            habits: [],
          })
        }
        clientHabitMap.get(clientId)!.habits.push({ id: habit.id, name: habitName })
      }

      // Check each client's habit activity
      for (const [clientId, clientData] of clientHabitMap) {
        // Get the most recent habit completion for this client
        const { data: recentCompletion } = await supabase
          .from('habit_completions')
          .select('completed_date')
          .eq('client_id', clientId)
          .order('completed_date', { ascending: false })
          .limit(1)

        let daysInactive = 7 // Default if no completions
        if (recentCompletion && recentCompletion.length > 0) {
          const lastCompletion = new Date(recentCompletion[0].completed_date)
          daysInactive = Math.floor((now.getTime() - lastCompletion.getTime()) / (1000 * 60 * 60 * 24))
        }

        // Check if we recently sent a habit reminder to this client (within 7 days)
        const { data: recentHabitNotif } = await supabase
          .from('client_notifications')
          .select('created_at')
          .eq('user_id', clientId)
          .eq('type', 'habit_nudge')
          .order('created_at', { ascending: false })
          .limit(1)

        const recentlySentHabitReminder = recentHabitNotif && recentHabitNotif.length > 0 &&
          (now.getTime() - new Date(recentHabitNotif[0].created_at).getTime()) < 7 * 24 * 60 * 60 * 1000

        // Track for combined email if 7+ days inactive
        if (daysInactive >= 7 && !recentlySentHabitReminder) {
          if (!clientsNeedingEmail.has(clientId)) {
            clientsNeedingEmail.set(clientId, {
              clientId,
              clientName: clientData.clientName,
              clientEmail: clientData.clientEmail,
              assignmentId: '',
              programName: '',
              workoutDaysInactive: 0,
              habitDaysInactive: daysInactive,
              habits: clientData.habits,
            })
          } else {
            clientsNeedingEmail.get(clientId)!.habitDaysInactive = daysInactive
            clientsNeedingEmail.get(clientId)!.habits = clientData.habits
          }
        }

        // ============================================
        // COACH HABIT NOTIFICATIONS (4+ days)
        // ============================================

        if (daysInactive >= 4) {
          const coachId = clientData.coachId

          if (!inactiveClients.has(coachId)) {
            inactiveClients.set(coachId, [])
          }

          const existingEntry = inactiveClients.get(coachId)!.find(
            c => c.clientId === clientId && c.type === 'habit'
          )

          if (!existingEntry) {
            inactiveClients.get(coachId)!.push({
              clientId,
              clientName: clientData.clientName,
              clientEmail: clientData.clientEmail,
              daysInactive,
              habitName: clientData.habits.map(h => h.name).join(', '),
              coachId,
              type: 'habit',
            })
          }

          const { data: existingNotif } = await supabase
            .from('coach_notifications')
            .select('id')
            .eq('coach_id', coachId)
            .eq('client_id', clientId)
            .eq('type', 'habit_inactive')
            .eq('read', false)
            .limit(1)

          if (!existingNotif || existingNotif.length === 0) {
            await supabase.from('coach_notifications').insert({
              coach_id: coachId,
              client_id: clientId,
              type: 'habit_inactive',
              title: 'Habits Inactive',
              message: `${clientData.clientName} hasn't logged habits in ${daysInactive} days`,
              data: { days_inactive: daysInactive, habit_count: clientData.habits.length, activity_type: 'habit' },
            })
            coachNotifications.push(`${clientData.clientName} - habits (${daysInactive} days)`)
          }
        }
      }
    } else {
      console.log('Skipping habit check (not Saturday)')
    }

    // ============================================
    // SEND CLIENT ACCOUNTABILITY EMAILS
    // ============================================

    for (const [clientId, clientData] of clientsNeedingEmail) {
      // Only send if they have workout OR habit issues
      if (clientData.workoutDaysInactive < 7 && clientData.habitDaysInactive < 7) continue

      // If client was added via habit check only, look up their workout assignment
      if (!clientData.assignmentId) {
        const { data: assignment } = await supabase
          .from('user_program_assignments')
          .select('id, programs(name)')
          .eq('user_id', clientId)
          .eq('is_active', true)
          .limit(1)
          .single()

        if (assignment) {
          clientData.assignmentId = assignment.id
          clientData.programName = (assignment.programs as { name: string } | null)?.name || 'Program'
        }
      }

      // If client was added via workout check only, look up their habits
      if (clientData.habits.length === 0) {
        const { data: clientHabits } = await supabase
          .from('client_habits')
          .select('id, habit_templates(name)')
          .eq('client_id', clientId)
          .eq('is_active', true)

        if (clientHabits && clientHabits.length > 0) {
          clientData.habits = clientHabits.map(h => ({
            id: h.id,
            name: (h.habit_templates as { name: string } | null)?.name || 'Habit',
          }))
        }
      }

      // Build habit week data if they have habits (show regardless of which triggered the email)
      let habitWeekData = null
      if (clientData.habits.length > 0) {
        // Get habit completions for this week
        const { data: weekCompletions } = await supabase
          .from('habit_completions')
          .select('completed_date, client_habit_id')
          .eq('client_id', clientId)
          .gte('completed_date', weekStart.toLocaleDateString('en-CA'))
          .lte('completed_date', weekEnd.toLocaleDateString('en-CA'))

        const completionsByDate = new Map<string, Set<string>>()
        for (const c of weekCompletions || []) {
          if (!completionsByDate.has(c.completed_date)) {
            completionsByDate.set(c.completed_date, new Set())
          }
          completionsByDate.get(c.completed_date)!.add(c.client_habit_id)
        }

        const totalHabits = clientData.habits.length
        const days: Array<{ dayLetter: string; date: string; status: string; isToday: boolean }> = []
        let totalComplete = 0
        let totalExpected = 0

        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(weekStart)
          dayDate.setDate(dayDate.getDate() + i)
          const dateStr = dayDate.toLocaleDateString('en-CA')
          const dayOfWeek = dayDate.getDay()
          const isToday = dateStr === today
          const isFuture = dayDate > now

          const completedHabits = completionsByDate.get(dateStr)?.size || 0

          let status: string
          if (isFuture) {
            status = 'upcoming'
          } else if (isToday) {
            status = completedHabits >= totalHabits ? 'complete' : (completedHabits > 0 ? 'partial' : 'upcoming')
          } else if (completedHabits >= totalHabits) {
            status = 'complete'
            totalComplete += totalHabits
          } else if (completedHabits > 0) {
            status = 'partial'
            totalComplete += completedHabits
          } else {
            status = 'missed'
          }

          if (!isFuture && !isToday) {
            totalExpected += totalHabits
          }

          days.push({
            dayLetter: DAY_LETTERS[dayOfWeek],
            date: getDayOfMonth(dayDate),
            status,
            isToday,
          })
        }

        const completionRate = totalExpected > 0 ? Math.round((totalComplete / totalExpected) * 100) : 0

        habitWeekData = {
          startDate: formatShortDate(weekStart),
          endDate: formatShortDate(weekEnd),
          completionRate,
          days,
        }
      }

      // Build workout week data if they have a program assignment (show regardless of which triggered the email)
      let workoutWeekData = null
      if (clientData.assignmentId) {
        // Get workout logs for this week
        const { data: weekWorkouts } = await supabase
          .from('workout_logs')
          .select('completed_at, workout_id')
          .eq('user_id', clientId)
          .gte('completed_at', weekStart.toISOString())
          .lte('completed_at', weekEnd.toISOString())

        const completedDates = new Set(
          (weekWorkouts || []).map(w => new Date(w.completed_at).toLocaleDateString('en-CA'))
        )

        // Get scheduled days from assignment and program workout count
        const { data: assignmentData } = await supabase
          .from('user_program_assignments')
          .select('scheduled_days, program_id')
          .eq('id', clientData.assignmentId)
          .single()

        let scheduledDays = assignmentData?.scheduled_days || []
        let programWorkoutCount = 3 // Default

        // If no scheduled days set, calculate default based on program workout count
        if (assignmentData?.program_id) {
          const { data: workouts } = await supabase
            .from('workouts')
            .select('id')
            .eq('program_id', assignmentData.program_id)

          programWorkoutCount = workouts?.length || 3

          if (scheduledDays.length === 0) {
            // Default schedules based on workout count
            if (programWorkoutCount >= 5) {
              scheduledDays = [1, 2, 3, 4, 5] // Mon-Fri
            } else if (programWorkoutCount === 4) {
              scheduledDays = [1, 2, 4, 5] // Mon, Tue, Thu, Fri
            } else if (programWorkoutCount === 3) {
              scheduledDays = [1, 3, 5] // Mon, Wed, Fri
            } else if (programWorkoutCount === 2) {
              scheduledDays = [1, 4] // Mon, Thu
            } else {
              scheduledDays = [1] // Mon
            }
          }
        }

        const days: Array<{ dayLetter: string; date: string; status: string; workoutName: string; isToday: boolean }> = []
        let completed = 0
        let total = 0
        let missedWorkout: { name: string; dayOfWeek: string } | null = null

        for (let i = 0; i < 7; i++) {
          const dayDate = new Date(weekStart)
          dayDate.setDate(dayDate.getDate() + i)
          const dateStr = dayDate.toLocaleDateString('en-CA')
          const dayOfWeek = dayDate.getDay()
          const isToday = dateStr === today
          const isFuture = dayDate > now
          const isScheduled = scheduledDays.includes(dayOfWeek)
          const didWorkout = completedDates.has(dateStr)

          let status: string
          let workoutName = ''

          if (isScheduled) {
            total++
            workoutName = 'Workout'
            if (didWorkout) {
              status = 'complete'
              completed++
            } else if (isFuture) {
              status = 'scheduled'
            } else if (isToday) {
              status = 'scheduled'
            } else {
              status = 'missed'
              if (!missedWorkout) {
                missedWorkout = {
                  name: 'Workout',
                  dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
                }
              }
            }
          } else {
            status = 'rest'
            workoutName = 'Rest'
          }

          days.push({
            dayLetter: DAY_LETTERS[dayOfWeek],
            date: getDayOfMonth(dayDate),
            status,
            workoutName,
            isToday,
          })
        }

        workoutWeekData = {
          programName: clientData.programName,
          weekNumber: 1, // Could calculate from assignment start date
          completed,
          total: total || programWorkoutCount,
          days,
          missedWorkout,
        }
      }

      // Only send email if we have data to show
      if (!habitWeekData && !workoutWeekData) continue

      // Create in-app notification
      await supabase.from('client_notifications').insert({
        user_id: clientId,
        type: 'accountability_checkin',
        title: 'Your coach has been notified',
        message: `Time to check in! Log your ${habitWeekData ? 'habits' : ''}${habitWeekData && workoutWeekData ? ' and ' : ''}${workoutWeekData ? 'workouts' : ''}.`,
        data: {
          workout_days_inactive: clientData.workoutDaysInactive,
          habit_days_inactive: clientData.habitDaysInactive,
        },
      })

      // Send the accountability email
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: clientData.clientEmail,
          template: 'coach-accountability-checkin',
          userId: clientId, // For email preference check
          data: {
            userName: clientData.clientName.split(' ')[0],
            habitWeek: habitWeekData,
            workoutWeek: workoutWeekData,
            appUrl: 'https://app.swearstrength.com',
          },
        },
      })

      if (emailError) {
        console.error(`Failed to send accountability email to ${clientData.clientEmail}:`, emailError.message)
      } else {
        console.log(`Sent accountability email to ${clientData.clientEmail}`)
        clientNotifications.push(`${clientData.clientName} - accountability checkin`)
      }

      // Update last_reminder_sent_at if they have an assignment
      if (clientData.assignmentId) {
        await supabase
          .from('user_program_assignments')
          .update({ last_reminder_sent_at: now.toISOString() })
          .eq('id', clientData.assignmentId)
      }
    }

    // ============================================
    // SEND COACH DIGEST EMAILS
    // ============================================

    for (const [coachId, clients] of inactiveClients) {
      if (clients.length === 0) continue

      const workoutInactive = clients.filter(c => c.type === 'workout') as InactiveWorkoutClient[]
      const habitInactive = clients.filter(c => c.type === 'habit') as InactiveHabitClient[]

      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: COACH_NOTIFICATION_EMAIL,
          template: 'coach-inactive-digest',
          data: {
            clientCount: clients.length,
            workoutClients: workoutInactive.map(c => ({
              name: c.clientName,
              daysInactive: c.daysInactive,
              programName: c.programName,
            })),
            habitClients: habitInactive.map(c => ({
              name: c.clientName,
              daysInactive: c.daysInactive,
              habitName: c.habitName,
            })),
            hasWorkouts: workoutInactive.length > 0,
            hasHabits: habitInactive.length > 0,
            appUrl: 'https://app.swearstrength.com',
          },
        },
      })

      if (emailError) {
        console.error(`Failed to send coach digest email: ${emailError.message}`)
      } else {
        console.log(`Sent digest to coach: ${workoutInactive.length} workout + ${habitInactive.length} habit inactive clients`, emailResult)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      date: today,
      isSaturday,
      clientNotifications: clientNotifications.length,
      coachNotifications: coachNotifications.length,
      details: {
        clientNotifications,
        coachNotifications,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Check client activity error:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
