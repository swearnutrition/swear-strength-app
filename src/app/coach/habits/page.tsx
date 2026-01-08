import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HabitsDashboardClient } from './HabitsDashboardClient'

export default async function HabitsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get all clients with habits assigned by this coach
  const { data: clientHabits } = await supabase
    .from('client_habits')
    .select(`
      *,
      habit:habit_templates(id, name),
      client:profiles!client_habits_client_id_fkey(id, name, email, avatar_url)
    `)
    .eq('coach_id', user.id)
    .eq('is_active', true)

  // Get habit completions for the last 28 days (for month view)
  const twentyEightDaysAgo = new Date()
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 27)
  twentyEightDaysAgo.setHours(0, 0, 0, 0)

  const { data: completions } = await supabase
    .from('habit_completions')
    .select('*')
    .gte('completed_date', twentyEightDaysAgo.toISOString().split('T')[0])

  // Build client data with habits and completions
  const clientMap = new Map<string, {
    id: string
    name: string
    email: string | null
    avatar_url: string | null
    habits: {
      id: string
      name: string
      completions: Record<string, boolean>
    }[]
  }>()

  const today = new Date()
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  // Process client habits
  for (const ch of clientHabits || []) {
    if (!ch.client || !ch.habit) continue

    const clientId = ch.client_id
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        id: clientId,
        name: ch.client.name || 'Unknown',
        email: ch.client.email,
        avatar_url: ch.client.avatar_url,
        habits: [],
      })
    }

    // Get completions for this habit
    const habitCompletions: Record<string, boolean> = {}
    for (const comp of completions || []) {
      if (comp.client_habit_id === ch.id) {
        habitCompletions[comp.completed_date] = true
      }
    }

    const client = clientMap.get(clientId)!
    client.habits.push({
      id: ch.id,
      name: ch.habit.name,
      completions: habitCompletions,
    })
  }

  // Calculate streak and completion rate for each client
  const clients = Array.from(clientMap.values()).map(client => {
    // Calculate completion rate for the week
    let weekCompleted = 0
    let weekTotal = 0

    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateKey = d.toISOString().split('T')[0]

      for (const habit of client.habits) {
        if (d <= today) {
          weekTotal++
          if (habit.completions[dateKey]) {
            weekCompleted++
          }
        }
      }
    }

    const completionRate = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0

    // Calculate streak (consecutive days with all habits completed)
    let streak = 0
    const checkDate = new Date(today)

    for (let i = 0; i < 30; i++) {
      const dateKey = checkDate.toISOString().split('T')[0]
      const allCompleted = client.habits.every(h => h.completions[dateKey])

      if (i === 0 && !allCompleted) {
        // Today not complete, check from yesterday
        checkDate.setDate(checkDate.getDate() - 1)
        continue
      }

      if (allCompleted) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return {
      ...client,
      streak,
      completionRate,
    }
  })

  return (
    <HabitsDashboardClient
      clients={clients}
    />
  )
}
