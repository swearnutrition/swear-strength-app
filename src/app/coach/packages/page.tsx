import { createClient } from '@/lib/supabase/server'
import { PackagesClient } from './PackagesClient'

export default async function PackagesPage() {
  const supabase = await createClient()

  // Get all clients for the dropdown
  const { data: clients } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url')
    .eq('role', 'client')
    .order('name')

  // Get completed sessions count per client
  const { data: completedBookings } = await supabase
    .from('bookings')
    .select('client_id')
    .eq('booking_type', 'session')
    .eq('status', 'completed')

  // Count completed sessions per client
  const completedSessionsByClient: Record<string, number> = {}
  completedBookings?.forEach((booking) => {
    if (booking.client_id) {
      completedSessionsByClient[booking.client_id] = (completedSessionsByClient[booking.client_id] || 0) + 1
    }
  })

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PackagesClient
        clients={clients || []}
        completedSessionsByClient={completedSessionsByClient}
      />
    </main>
  )
}
