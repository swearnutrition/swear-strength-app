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

  // Fetch pending invites for booking modal
  const { data: pendingInvites } = await supabase
    .from('invites')
    .select('id, email, name, client_type')
    .is('accepted_at', null)
    .not('name', 'is', null)

  const pendingClients = (pendingInvites || []).map(invite => ({
    id: invite.id,
    name: invite.name!,
    email: invite.email,
    clientType: (invite.client_type || 'online') as 'online' | 'training' | 'hybrid',
  }))

  return (
    <CoachBookingsClient
      userId={user.id}
      clients={clients || []}
      pendingClients={pendingClients}
    />
  )
}
