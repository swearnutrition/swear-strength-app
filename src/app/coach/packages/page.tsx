import { createClient } from '@/lib/supabase/server'
import { PackagesClient } from './PackagesClient'
import type { ClientSubscription } from '@/types/booking'

export default async function PackagesPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get all confirmed clients for the dropdown
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

  // Get subscriptions for this coach
  const { data: subscriptionsData } = await supabase
    .from('client_subscriptions')
    .select(`
      *,
      client:profiles!client_id(id, name, email, avatar_url)
    `)
    .eq('coach_id', user?.id)
    .order('created_at', { ascending: false })

  // Transform subscriptions to camelCase
  const subscriptions: ClientSubscription[] = (subscriptionsData || []).map((sub) => ({
    id: sub.id,
    clientId: sub.client_id,
    coachId: sub.coach_id,
    subscriptionType: sub.subscription_type,
    monthlySessions: sub.monthly_sessions,
    availableSessions: sub.available_sessions,
    sessionDurationMinutes: sub.session_duration_minutes,
    isActive: sub.is_active,
    notes: sub.notes,
    createdAt: sub.created_at,
    updatedAt: sub.updated_at,
    client: sub.client ? {
      id: sub.client.id,
      name: sub.client.name,
      email: sub.client.email,
      avatarUrl: sub.client.avatar_url,
    } : null,
  }))

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PackagesClient
        clients={clients || []}
        completedSessionsByClient={completedSessionsByClient}
        initialSubscriptions={subscriptions}
      />
    </main>
  )
}
