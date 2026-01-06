import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientBookingsClient } from './ClientBookingsClient'

export const metadata = {
  title: 'Book Sessions | Swear Strength',
}

export default async function ClientBookingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'client') {
    redirect('/dashboard')
  }

  // Fetch the client's active session package to get coach ID
  const { data: sessionPackage } = await supabase
    .from('session_packages')
    .select('id, coach_id, total_sessions, remaining_sessions, session_duration_minutes, expires_at')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const coachId = sessionPackage?.coach_id || null

  // Fetch booking stats for the client
  const { data: bookingStats } = await supabase
    .from('client_booking_stats')
    .select('current_streak_weeks, longest_streak_weeks, favorite_times')
    .eq('client_id', user.id)
    .single()

  // Fetch current month's check-in usage
  const currentMonthStart = new Date()
  currentMonthStart.setDate(1)
  currentMonthStart.setHours(0, 0, 0, 0)

  const { data: checkinUsage } = await supabase
    .from('client_checkin_usage')
    .select('used, booking_id')
    .eq('client_id', user.id)
    .gte('month', currentMonthStart.toISOString().split('T')[0])
    .limit(1)
    .single()

  // Calculate next month's first day for check-in reset date
  const nextMonth = new Date(currentMonthStart)
  nextMonth.setMonth(nextMonth.getMonth() + 1)

  return (
    <ClientBookingsClient
      userId={user.id}
      userName={profile.name}
      coachId={coachId}
      sessionPackage={sessionPackage ? {
        id: sessionPackage.id,
        totalSessions: sessionPackage.total_sessions,
        remainingSessions: sessionPackage.remaining_sessions,
        sessionDurationMinutes: sessionPackage.session_duration_minutes,
        expiresAt: sessionPackage.expires_at,
      } : null}
      bookingStats={bookingStats ? {
        currentStreakWeeks: bookingStats.current_streak_weeks,
        longestStreakWeeks: bookingStats.longest_streak_weeks,
        favoriteTimes: bookingStats.favorite_times,
      } : null}
      checkinUsage={checkinUsage ? {
        used: checkinUsage.used,
        resetDate: nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      } : null}
    />
  )
}
