import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CheckInClient } from './CheckInClient'

export default async function CheckInPage() {
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

  // Get initials for avatar
  const initials = (profile.name as string)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Get this week's date range
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  // Get this week's completed workouts with their completion feedback
  const { data: weekWorkouts } = await supabase
    .from('workout_logs')
    .select(`
      id,
      workout_day_id,
      started_at,
      completed_at,
      workout_days(name),
      workout_completions(
        id,
        difficulty_rating,
        energy_level,
        feeling,
        notes
      )
    `)
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .gte('started_at', startOfWeek.toISOString())
    .lte('started_at', endOfWeek.toISOString())
    .order('started_at', { ascending: false })

  return (
    <CheckInClient
      initials={initials}
      weekWorkouts={weekWorkouts || []}
    />
  )
}
