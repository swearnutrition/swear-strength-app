import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HabitsTracker } from './HabitsTracker'

export default async function ClientHabitsPage() {
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

  // Get client's assigned habits with template info
  const { data: clientHabits } = await supabase
    .from('client_habits')
    .select(`
      *,
      habit_templates(
        name,
        description,
        frequency,
        times_per_week,
        specific_days,
        target_value,
        target_unit,
        category
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .order('created_at')

  // Get today's completions
  const today = new Date().toISOString().split('T')[0]
  const { data: todayCompletions } = await supabase
    .from('habit_completions')
    .select('*')
    .eq('client_id', user.id)
    .eq('completed_date', today)

  // Get completions for the last 7 days (for streak calculation)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { data: recentCompletions } = await supabase
    .from('habit_completions')
    .select('*')
    .eq('client_id', user.id)
    .gte('completed_date', sevenDaysAgo.toISOString().split('T')[0])

  // Get initials for avatar
  const initials = (profile.name as string)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <HabitsTracker
      habits={clientHabits || []}
      todayCompletions={todayCompletions || []}
      recentCompletions={recentCompletions || []}
      initials={initials}
      userId={user.id}
    />
  )
}
