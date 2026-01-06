import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClientBookingStats {
  id: string
  client_id: string
  coach_id: string
  current_streak_weeks: number
  longest_streak_weeks: number
  favorite_times: Array<{ day: number; time: string }>
  last_streak_update: string | null
}

interface BookingTimeSlot {
  day: number // 0-6 (Sunday-Saturday)
  time: string // HH:MM format
  count: number
}

// Calculate favorite times based on booking patterns
// A time slot becomes a "favorite" if the client has booked it 2+ times
function calculateFavoriteTimes(
  bookings: Array<{ starts_at: string }>
): Array<{ day: number; time: string }> {
  const timeSlotCounts = new Map<string, BookingTimeSlot>()

  for (const booking of bookings) {
    const date = new Date(booking.starts_at)
    const day = date.getDay()
    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })

    const key = `${day}-${time}`
    const existing = timeSlotCounts.get(key)

    if (existing) {
      existing.count++
    } else {
      timeSlotCounts.set(key, { day, time, count: 1 })
    }
  }

  // Filter to time slots with 2+ bookings, sort by count descending
  const favorites = Array.from(timeSlotCounts.values())
    .filter((slot) => slot.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5) // Keep top 5 favorite times
    .map(({ day, time }) => ({ day, time }))

  return favorites
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const now = new Date()

    console.log(`Processing booking streaks at ${now.toISOString()}`)

    // Calculate the date range for "past 7 days"
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Fetch all client booking stats
    const { data: allStats, error: statsError } = await supabase
      .from('client_booking_stats')
      .select('id, client_id, coach_id, current_streak_weeks, longest_streak_weeks, favorite_times, last_streak_update')

    if (statsError) {
      throw new Error(`Failed to fetch booking stats: ${statsError.message}`)
    }

    console.log(`Found ${allStats?.length || 0} client stats records to process`)

    const results: {
      clientId: string
      coachId: string
      previousStreak: number
      newStreak: number
      longestStreak: number
      hadCompletedSession: boolean
      favoriteTimes: Array<{ day: number; time: string }>
    }[] = []

    for (const stats of allStats || []) {
      const typedStats = stats as ClientBookingStats

      // Check if client had a completed session in the past 7 days
      const { data: recentBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, starts_at')
        .eq('client_id', typedStats.client_id)
        .eq('coach_id', typedStats.coach_id)
        .eq('status', 'completed')
        .eq('booking_type', 'session')
        .gte('starts_at', sevenDaysAgo.toISOString())
        .lte('starts_at', now.toISOString())

      if (bookingsError) {
        console.error(`Failed to fetch bookings for client ${typedStats.client_id}:`, bookingsError.message)
        continue
      }

      const hadCompletedSession = (recentBookings?.length || 0) > 0
      let newStreak: number
      let newLongestStreak: number

      if (hadCompletedSession) {
        // Increment streak
        newStreak = typedStats.current_streak_weeks + 1
        newLongestStreak = Math.max(typedStats.longest_streak_weeks, newStreak)
      } else {
        // Reset streak
        newStreak = 0
        newLongestStreak = typedStats.longest_streak_weeks
      }

      // Calculate favorite times based on all completed sessions (last 90 days for relevance)
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const { data: allRecentBookings } = await supabase
        .from('bookings')
        .select('starts_at')
        .eq('client_id', typedStats.client_id)
        .eq('coach_id', typedStats.coach_id)
        .eq('status', 'completed')
        .eq('booking_type', 'session')
        .gte('starts_at', ninetyDaysAgo.toISOString())

      const favoriteTimes = calculateFavoriteTimes(allRecentBookings || [])

      // Update the stats record
      const { error: updateError } = await supabase
        .from('client_booking_stats')
        .update({
          current_streak_weeks: newStreak,
          longest_streak_weeks: newLongestStreak,
          favorite_times: favoriteTimes,
          last_streak_update: now.toISOString(),
        })
        .eq('id', typedStats.id)

      if (updateError) {
        console.error(`Failed to update stats for client ${typedStats.client_id}:`, updateError.message)
        continue
      }

      results.push({
        clientId: typedStats.client_id,
        coachId: typedStats.coach_id,
        previousStreak: typedStats.current_streak_weeks,
        newStreak,
        longestStreak: newLongestStreak,
        hadCompletedSession,
        favoriteTimes,
      })

      console.log(
        `Updated client ${typedStats.client_id}: streak ${typedStats.current_streak_weeks} -> ${newStreak}` +
          (hadCompletedSession ? ' (completed session this week)' : ' (no session this week)')
      )
    }

    const streaksIncremented = results.filter((r) => r.newStreak > r.previousStreak).length
    const streaksReset = results.filter((r) => r.newStreak === 0 && r.previousStreak > 0).length

    return new Response(
      JSON.stringify({
        success: true,
        processedAt: now.toISOString(),
        totalProcessed: results.length,
        streaksIncremented,
        streaksReset,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error calculating booking streaks:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
