import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HabitsDashboardClient } from './HabitsDashboardClient'

export default async function HabitsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all clients
  const { data: clients } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .order('name')

  // Get all client habits with their templates
  const { data: clientHabits } = await supabase
    .from('client_habits')
    .select(`
      *,
      habit:habit_templates(*),
      client:profiles!client_habits_client_id_fkey(id, name, email, avatar_url)
    `)
    .eq('is_active', true)

  // Get habit completions for the last 7 days
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data: completions } = await supabase
    .from('habit_completions')
    .select('*')
    .gte('completed_date', sevenDaysAgo.toISOString().split('T')[0])

  // Get active rivalries
  const { data: rivalries } = await supabase
    .from('habit_rivalries')
    .select(`
      *,
      challenger:profiles!habit_rivalries_challenger_id_fkey(id, name, avatar_url),
      opponent:profiles!habit_rivalries_opponent_id_fkey(id, name, avatar_url)
    `)
    .eq('status', 'active')

  return (
    <HabitsDashboardClient
      clients={clients || []}
      clientHabits={clientHabits || []}
      completions={completions || []}
      rivalries={rivalries || []}
    />
  )
}
