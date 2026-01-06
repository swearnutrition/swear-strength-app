import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachBookingsClient } from './CoachBookingsClient'

export const metadata = {
  title: 'Bookings | Swear Strength',
}

export default async function CoachBookingsPage() {
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

  if (profile?.role !== 'coach') {
    redirect('/dashboard')
  }

  // Fetch clients for booking modal
  const { data: clients } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .order('name')

  return (
    <CoachBookingsClient
      userId={user.id}
      clients={clients || []}
    />
  )
}
