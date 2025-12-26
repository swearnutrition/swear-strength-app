import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RivalriesClient } from './RivalriesClient'

export default async function RivalriesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all rivalries with participants and habits
  const { data: rivalries } = await supabase
    .from('habit_rivalries')
    .select(`
      *,
      challenger:profiles!habit_rivalries_challenger_id_fkey(id, name, email, avatar_url),
      opponent:profiles!habit_rivalries_opponent_id_fkey(id, name, email, avatar_url)
    `)
    .order('created_at', { ascending: false })

  // Get client habits that are part of rivalries
  const { data: rivalryHabits } = await supabase
    .from('client_habits')
    .select(`
      *,
      habit:habit_templates(*)
    `)
    .not('rivalry_id', 'is', null)

  // Get completions for rivalry habits
  const rivalryHabitIds = rivalryHabits?.map((h) => h.id) || []
  const { data: completions } = await supabase
    .from('habit_completions')
    .select('*')
    .in('client_habit_id', rivalryHabitIds.length > 0 ? rivalryHabitIds : ['none'])

  // Get all clients for creating new rivalries
  const { data: clients } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .order('name')

  return (
    <RivalriesClient
      rivalries={rivalries || []}
      rivalryHabits={rivalryHabits || []}
      completions={completions || []}
      clients={clients || []}
    />
  )
}
