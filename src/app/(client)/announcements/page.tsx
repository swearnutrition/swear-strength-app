import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientAnnouncementsClient } from './ClientAnnouncementsClient'

export const metadata = {
  title: 'Announcements | Swear Strength',
}

export default async function ClientAnnouncementsPage() {
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

  if (profile?.role !== 'client') {
    redirect('/coach')
  }

  return <ClientAnnouncementsClient />
}
