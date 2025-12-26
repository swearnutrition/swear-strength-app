import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkoutsClient } from './WorkoutsClient'

interface ProgramWeek {
  id: string
  week_number: number
  name: string | null
  workout_days: WorkoutDay[]
}

interface WorkoutDay {
  id: string
  day_number: number
  name: string
  subtitle: string | null
  is_rest_day: boolean
  rest_day_notes: string | null
  workout_exercises: WorkoutExercise[]
}

interface WorkoutExercise {
  id: string
  section: string
  label: string | null
  sets: string | null
  reps: string | null
  weight: string | null
  rest_seconds: number | null
  rpe: number | null
  notes: string | null
  sort_order: number
  exercises: {
    id: string
    name: string
    equipment: string | null
    demo_url: string | null
    cues: string | null
  }
}

export default async function WorkoutsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's active program assignment
  const { data: assignment } = await supabase
    .from('user_program_assignments')
    .select(`
      *,
      programs(
        id,
        name,
        description,
        type
      )
    `)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!assignment) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Active Program</h2>
          <p className="text-slate-500 dark:text-slate-400">Your coach hasn't assigned you a program yet.</p>
        </div>
      </div>
    )
  }

  // Get program weeks with workout days and exercises
  const { data: weeks } = await supabase
    .from('program_weeks')
    .select(`
      id,
      week_number,
      name,
      workout_days(
        id,
        day_number,
        name,
        subtitle,
        is_rest_day,
        rest_day_notes,
        workout_exercises(
          id,
          section,
          label,
          sets,
          reps,
          weight,
          rest_seconds,
          rpe,
          notes,
          sort_order,
          exercises(
            id,
            name,
            equipment,
            demo_url,
            cues
          )
        )
      )
    `)
    .eq('program_id', assignment.program_id)
    .order('week_number')

  // Get workout logs for this user and program
  const { data: workoutLogs } = await supabase
    .from('workout_logs')
    .select('id, workout_day_id, started_at, completed_at')
    .eq('user_id', user.id)
    .eq('assignment_id', assignment.id)

  // Sort workout days and exercises
  const sortedWeeks = ((weeks || []) as unknown as ProgramWeek[]).map(week => ({
    ...week,
    workout_days: week.workout_days
      .sort((a, b) => a.day_number - b.day_number)
      .map(day => ({
        ...day,
        workout_exercises: day.workout_exercises.sort((a, b) => a.sort_order - b.sort_order)
      }))
  }))

  return (
    <WorkoutsClient
      program={assignment.programs}
      assignment={assignment}
      weeks={sortedWeeks}
      workoutLogs={workoutLogs || []}
    />
  )
}
