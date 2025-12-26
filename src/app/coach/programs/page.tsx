import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProgramsClient } from './ProgramsClient'

export default async function ProgramsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: programs, error } = await supabase
    .from('programs')
    .select(`
      *,
      program_weeks(
        workout_days(
          is_rest_day
        )
      )
    `)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching programs:', error)
  }

  const programsWithWeekCount = (programs || []).map((p) => {
    // Calculate days per week from the first week's workout days
    const firstWeek = p.program_weeks?.[0]
    const workoutDays = firstWeek?.workout_days || []
    const activeDays = workoutDays.filter((d: { is_rest_day: boolean }) => !d.is_rest_day).length

    return {
      ...p,
      week_count: p.program_weeks?.length || 0,
      days_per_week: activeDays,
      primary_muscles: p.primary_muscles || [],
      injury_friendly: p.injury_friendly || [],
    }
  })

  return <ProgramsClient programs={programsWithWeekCount} />
}
