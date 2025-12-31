import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachAnnouncementsClient } from './CoachAnnouncementsClient'

export const metadata = {
  title: 'Announcements | Swear Strength',
}

export default async function CoachAnnouncementsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    redirect('/dashboard')
  }

  return <CoachAnnouncementsClient />
}
