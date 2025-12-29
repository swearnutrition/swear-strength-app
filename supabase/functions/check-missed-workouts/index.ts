import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get yesterday's date
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toLocaleDateString('en-CA') // YYYY-MM-DD
    const yesterdayDayOfWeek = yesterday.getDay() // 0 = Sunday, 6 = Saturday

    console.log(`Checking for missed workouts on ${yesterdayStr} (day ${yesterdayDayOfWeek})`)

    // Get all active assignments with scheduled_days set
    const { data: assignments, error: assignmentsError } = await supabase
      .from('user_program_assignments')
      .select(`
        id,
        user_id,
        program_id,
        scheduled_days,
        current_week,
        programs(name, coach_id)
      `)
      .eq('is_active', true)
      .not('scheduled_days', 'is', null)

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`)
    }

    console.log(`Found ${assignments?.length || 0} assignments with schedules`)

    const notificationsCreated: string[] = []
    const skipped: string[] = []

    for (const assignment of assignments || []) {
      const scheduledDays = assignment.scheduled_days as number[]

      // Check if yesterday was a scheduled workout day
      if (!scheduledDays.includes(yesterdayDayOfWeek)) {
        skipped.push(`${assignment.user_id} (not scheduled for ${yesterdayDayOfWeek})`)
        continue
      }

      // Get client profile
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', assignment.user_id)
        .single()

      const clientName = clientProfile?.name || 'Client'

      // Check if they completed a workout yesterday
      const { data: workoutLogs, error: logsError } = await supabase
        .from('workout_logs')
        .select('id, completed_at')
        .eq('user_id', assignment.user_id)
        .gte('started_at', `${yesterdayStr}T00:00:00`)
        .lt('started_at', `${yesterdayStr}T23:59:59`)

      if (logsError) {
        console.error(`Error checking logs for ${assignment.user_id}:`, logsError)
        continue
      }

      // Check if any workout was completed
      const completedWorkout = workoutLogs?.some(log => log.completed_at)

      if (completedWorkout) {
        skipped.push(`${clientName} (completed workout)`)
        continue
      }

      // They missed a scheduled workout - notify coach
      const program = assignment.programs as { name: string; coach_id: string } | null
      if (!program?.coach_id) {
        skipped.push(`${clientName} (no coach found)`)
        continue
      }

      // Check if we already sent a notification for this missed workout
      const { data: existingNotification } = await supabase
        .from('coach_notifications')
        .select('id')
        .eq('coach_id', program.coach_id)
        .eq('client_id', assignment.user_id)
        .eq('type', 'missed_workout')
        .eq('assignment_id', assignment.id)
        .gte('created_at', `${yesterdayStr}T00:00:00`)
        .limit(1)

      if (existingNotification && existingNotification.length > 0) {
        skipped.push(`${clientName} (notification already sent)`)
        continue
      }

      // Get day name for message
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = dayNames[yesterdayDayOfWeek]

      // Create coach notification
      const { error: notifError } = await supabase
        .from('coach_notifications')
        .insert({
          coach_id: program.coach_id,
          client_id: assignment.user_id,
          type: 'missed_workout',
          title: 'Missed Workout',
          message: `${clientName} missed their scheduled ${dayName} workout.`,
          assignment_id: assignment.id,
          data: {
            program_name: program.name,
            missed_date: yesterdayStr,
            day_of_week: yesterdayDayOfWeek,
          },
        })

      if (notifError) {
        console.error(`Failed to create notification for ${clientName}:`, notifError)
      } else {
        notificationsCreated.push(`${clientName} -> coach`)
        console.log(`Notification created: ${clientName} missed ${dayName} workout`)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checkedDate: yesterdayStr,
      dayOfWeek: yesterdayDayOfWeek,
      notificationsCreated: notificationsCreated.length,
      skipped: skipped.length,
      details: {
        created: notificationsCreated,
        skipped: skipped.slice(0, 20),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Check missed workouts error:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
