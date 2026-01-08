import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from './ClientsTable'

export default async function ClientsPage() {
  const supabase = await createClient()

  // Get all clients with their program assignments
  const { data: clients } = await supabase
    .from('profiles')
    .select(`
      *,
      user_program_assignments(
        *,
        programs(name, id)
      )
    `)
    .eq('role', 'client')
    .order('name')

  // Get workout logs for the last 7 days for all clients
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data: workoutLogs } = await supabase
    .from('workout_logs')
    .select('user_id, completed_at')
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgo.toISOString())

  // Create a map of user_id to completed dates
  const workoutsByUser: Record<string, string[]> = {}
  workoutLogs?.forEach((log) => {
    if (!workoutsByUser[log.user_id]) {
      workoutsByUser[log.user_id] = []
    }
    if (log.completed_at) {
      const dateStr = new Date(log.completed_at).toISOString().split('T')[0]
      if (!workoutsByUser[log.user_id].includes(dateStr)) {
        workoutsByUser[log.user_id].push(dateStr)
      }
    }
  })

  // Get pending invites with new fields
  const { data: pendingInvites } = await supabase
    .from('invites')
    .select('id, email, name, client_type, expires_at, created_at, invite_sent_at')
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ClientsTable
        clients={clients || []}
        workoutsByUser={workoutsByUser}
        pendingInvites={pendingInvites || []}
      />
    </main>
  )
}
