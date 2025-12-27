import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HabitsHistory } from './HabitsHistory'

export default async function HabitsHistoryPage() {
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
      id,
      start_date,
      habit_templates(
        name,
        description,
        category
      )
    `)
    .eq('client_id', user.id)
    .eq('is_active', true)
    .order('created_at')

  // Get ALL completions for this user (for history)
  const { data: completions } = await supabase
    .from('habit_completions')
    .select('id, client_habit_id, completed_date, value')
    .eq('client_id', user.id)
    .order('completed_date', { ascending: false })

  // Get initials for avatar
  const initials = (profile.name as string)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <HabitsHistory
      habits={clientHabits || []}
      completions={completions || []}
      initials={initials}
    />
  )
}
