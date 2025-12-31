import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachMessagesClient } from './CoachMessagesClient'

export const metadata = {
  title: 'Messages | Swear Strength',
}

export default async function CoachMessagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name, avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    redirect('/dashboard')
  }

  return <CoachMessagesClient userId={user.id} userName={profile.name || 'Coach'} />
}
