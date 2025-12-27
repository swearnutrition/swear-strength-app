import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_URL = Deno.env.get('APP_URL') || 'https://swearstrength.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map timezone offsets to approximate UTC hours for 7 AM local time
function getTimezoneHour(timezone: string | null): number {
  const tzOffsets: Record<string, number> = {
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'America/Phoenix': -7,
    'America/Anchorage': -9,
    'America/Honolulu': -10,
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Australia/Sydney': 11,
    'Australia/Melbourne': 11,
    'Australia/Perth': 8,
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'Asia/Dubai': 4,
  }
  return tzOffsets[timezone || 'America/New_York'] || -5
}

// Check if it's ~7 AM in the user's timezone
function isSevenAMInTimezone(timezone: string | null): boolean {
  const now = new Date()
  const utcHour = now.getUTCHours()
  const tzOffset = getTimezoneHour(timezone)

  let localHour = utcHour + tzOffset
  if (localHour < 0) localHour += 24
  if (localHour >= 24) localHour -= 24

  return localHour >= 6 && localHour <= 8
}

// Check if today is Saturday
function isSaturday(): boolean {
  const now = new Date()
  return now.getUTCDay() === 6
}

// Calculate hours until Sunday 9 PM in user's timezone
function getHoursUntilLockout(timezone: string | null): number {
  const now = new Date()
  const tzOffset = getTimezoneHour(timezone)

  // Get current time in user's timezone
  const localNow = new Date(now.getTime() + tzOffset * 60 * 60 * 1000)
  const localHour = localNow.getUTCHours()
  const localDay = localNow.getUTCDay()

  // If it's Sunday
  if (localDay === 0) {
    // Hours until 9 PM (21:00)
    if (localHour < 21) {
      return 21 - localHour
    }
    return 0 // Already locked
  }

  // Calculate hours until Sunday 9 PM
  const daysUntilSunday = 7 - localDay
  const hoursUntilSunday9PM = (daysUntilSunday * 24) + (21 - localHour)
  return Math.max(0, hoursUntilSunday9PM)
}

interface HabitTemplate {
  name: string
}

interface ClientHabit {
  id: string
  is_active: boolean
  habit_templates: HabitTemplate | HabitTemplate[] | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const forceRun = req.headers.get('x-force-run') === 'true'

  if (!isSaturday() && !forceRun) {
    return new Response(JSON.stringify({
      message: 'Not Saturday, skipping',
      day: new Date().getUTCDay()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get all clients with active habits including habit template names
    const { data: clients, error: clientsError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        email,
        timezone,
        client_habits!client_habits_client_id_fkey(
          id,
          is_active,
          habit_templates(name)
        )
      `)
      .eq('role', 'client')

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`)
    }

    console.log(`Found ${clients?.length || 0} clients to check`)

    // Get the current week's Monday (Mon-Sun week)
    const today = new Date()
    const dayOfWeek = today.getUTCDay()
    const monday = new Date(today)
    if (dayOfWeek === 0) {
      monday.setUTCDate(today.getUTCDate() - 6)
    } else {
      monday.setUTCDate(today.getUTCDate() - (dayOfWeek - 1))
    }
    const mondayStr = monday.toISOString().split('T')[0]

    // Days elapsed this week (Saturday = 6 days, Sunday = 7 days)
    const daysElapsed = dayOfWeek === 0 ? 7 : dayOfWeek

    const emailsSent: string[] = []
    const skipped: string[] = []

    for (const client of clients || []) {
      // Check timezone
      if (!forceRun && !isSevenAMInTimezone(client.timezone)) {
        skipped.push(`${client.email} (wrong timezone hour)`)
        continue
      }

      // Get active habits with names
      const activeHabits = (client.client_habits as ClientHabit[] || []).filter(h => h.is_active)
      if (activeHabits.length === 0) {
        skipped.push(`${client.email} (no active habits)`)
        continue
      }

      // Get habit names
      const getHabitName = (habit: ClientHabit): string => {
        if (!habit.habit_templates) return 'Habit'
        if (Array.isArray(habit.habit_templates)) return habit.habit_templates[0]?.name || 'Habit'
        return habit.habit_templates.name || 'Habit'
      }

      // Get completions for this week with habit IDs
      const { data: completions, error: completionsError } = await supabase
        .from('habit_completions')
        .select('id, client_habit_id, completed_date')
        .eq('client_id', client.id)
        .gte('completed_date', mondayStr)

      if (completionsError) {
        console.error(`Error checking completions for ${client.email}:`, completionsError)
        continue
      }

      // Calculate completion stats
      const completedHabitIds = new Set(completions?.map(c => c.client_habit_id) || [])
      const daysLogged = new Set(completions?.map(c => c.completed_date) || []).size

      // Expected = habits × days elapsed
      const expectedCompletions = activeHabits.length * daysElapsed
      const actualCompletions = completions?.length || 0
      const completionRate = expectedCompletions > 0 ? actualCompletions / expectedCompletions : 0

      // Skip if they've completed 50% or more
      if (completionRate >= 0.5) {
        skipped.push(`${client.email} (${Math.round(completionRate * 100)}% completion rate)`)
        continue
      }

      // Determine which template to use
      const hasZeroLogs = actualCompletions === 0
      const template = hasZeroLogs ? 'habit-zero-logs' : 'habit-halfway'

      // Get previous streak (simplified - just check if they had completions last week)
      const lastWeekMonday = new Date(monday)
      lastWeekMonday.setUTCDate(monday.getUTCDate() - 7)
      const lastWeekSunday = new Date(monday)
      lastWeekSunday.setUTCDate(monday.getUTCDate() - 1)

      const { data: lastWeekCompletions } = await supabase
        .from('habit_completions')
        .select('id')
        .eq('client_id', client.id)
        .gte('completed_date', lastWeekMonday.toISOString().split('T')[0])
        .lte('completed_date', lastWeekSunday.toISOString().split('T')[0])
        .limit(1)

      const hadStreakLastWeek = (lastWeekCompletions?.length || 0) > 0

      // Build habit lists for halfway email
      const habitsComplete: string[] = []
      const habitsIncomplete: string[] = []

      for (const habit of activeHabits) {
        const habitName = getHabitName(habit)
        if (completedHabitIds.has(habit.id)) {
          habitsComplete.push(habitName)
        } else {
          habitsIncomplete.push(habitName)
        }
      }

      // Calculate hours until lockout
      const hoursLeft = getHoursUntilLockout(client.timezone)

      console.log(`Sending ${template} to ${client.email} (${Math.round(completionRate * 100)}% completion)`)

      // Send the appropriate email
      const emailData = hasZeroLogs
        ? {
            name: client.name?.split(' ')[0] || 'there',
            previousStreak: hadStreakLastWeek ? 7 : 0, // Simplified streak calculation
            appUrl: APP_URL,
          }
        : {
            name: client.name?.split(' ')[0] || 'there',
            logged: daysLogged,
            goal: 7,
            habitsComplete,
            habitsIncomplete,
            streak: hadStreakLastWeek ? daysLogged : 0,
            hoursLeft,
            appUrl: APP_URL,
          }

      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: client.email,
          template,
          data: emailData,
        },
      })

      if (emailError) {
        console.error(`Failed to send email to ${client.email}:`, emailError)
      } else {
        emailsSent.push(client.email)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      emailsSent: emailsSent.length,
      skipped: skipped.length,
      details: {
        sent: emailsSent,
        skipped: skipped.slice(0, 10),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Weekly habit reminder error:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
