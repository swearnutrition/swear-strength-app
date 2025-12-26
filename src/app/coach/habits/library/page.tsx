import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HabitsClient } from '../HabitsClient'

export default async function HabitsLibraryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: habits, error } = await supabase
    .from('habit_templates')
    .select('*')
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching habits:', error)
  }

  // Fetch client_habits to count assignments per habit template
  const { data: clientHabits } = await supabase
    .from('client_habits')
    .select('id, habit_template_id, is_active')

  // Fetch completions for the last 30 days to calculate completion rates
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  const { data: completions } = await supabase
    .from('habit_completions')
    .select('id, client_habit_id, completed_date')
    .gte('completed_date', thirtyDaysAgo.toISOString().split('T')[0])

  // Calculate stats for each habit
  const habitStats: Record<string, { assignments: number; activeAssignments: number; completions: number; completionRate: number }> = {}

  for (const habit of habits || []) {
    const habitAssignments = clientHabits?.filter(ch => ch.habit_template_id === habit.id) || []
    const activeAssignments = habitAssignments.filter(ch => ch.is_active)
    const assignmentIds = habitAssignments.map(ch => ch.id)
    const habitCompletions = completions?.filter(c => assignmentIds.includes(c.client_habit_id)) || []

    // Calculate expected completions (30 days * active assignments for daily habits)
    // This is a simplified calculation - could be more complex based on frequency
    const expectedCompletions = activeAssignments.length * 30
    const completionRate = expectedCompletions > 0
      ? Math.round((habitCompletions.length / expectedCompletions) * 100)
      : 0

    habitStats[habit.id] = {
      assignments: habitAssignments.length,
      activeAssignments: activeAssignments.length,
      completions: habitCompletions.length,
      completionRate,
    }
  }

  return <HabitsClient habits={habits || []} habitStats={habitStats} />
}
