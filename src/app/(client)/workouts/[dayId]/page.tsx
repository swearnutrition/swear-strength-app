import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkoutDayClient } from './WorkoutDayClient'

interface PageProps {
  params: Promise<{ dayId: string }>
}

export default async function WorkoutDayPage({ params }: PageProps) {
  const { dayId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get workout day with exercises
  const { data: workoutDay } = await supabase
    .from('workout_days')
    .select(`
      *,
      program_weeks(
        program_id,
        week_number,
        programs(name)
      ),
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
          muscle_groups,
          demo_url,
          cues,
          instructions
        )
      )
    `)
    .eq('id', dayId)
    .single()

  if (!workoutDay) {
    redirect('/workouts')
  }

  // Verify user has access to this workout (has active assignment for this program)
  const { data: assignment } = await supabase
    .from('user_program_assignments')
    .select('id')
    .eq('user_id', user.id)
    .eq('program_id', workoutDay.program_weeks.program_id)
    .eq('is_active', true)
    .single()

  if (!assignment) {
    redirect('/workouts')
  }

  // Get or create workout log
  let { data: workoutLog } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('workout_day_id', dayId)
    .eq('assignment_id', assignment.id)
    .is('completed_at', null)
    .single()

  if (!workoutLog) {
    const { data: newLog } = await supabase
      .from('workout_logs')
      .insert({
        user_id: user.id,
        workout_day_id: dayId,
        assignment_id: assignment.id,
      })
      .select()
      .single()

    workoutLog = newLog
  }

  // Get existing set logs for this workout
  const { data: setLogs } = await supabase
    .from('set_logs')
    .select('*')
    .eq('workout_log_id', workoutLog?.id || '')
    .order('set_number')

  // Get exercise IDs from workout
  const exerciseIds = workoutDay.workout_exercises.map(
    (we: { exercises: { id: string } }) => we.exercises.id
  )

  // Fetch personal records for all exercises in this workout
  const { data: personalRecords } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', user.id)
    .in('exercise_id', exerciseIds)

  // Sort exercises by sort_order
  const sortedExercises = workoutDay.workout_exercises.sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  return (
    <WorkoutDayClient
      workoutDay={{
        ...workoutDay,
        workout_exercises: sortedExercises,
      }}
      workoutLog={workoutLog}
      setLogs={setLogs || []}
      personalRecords={personalRecords || []}
      programName={workoutDay.program_weeks.programs.name}
      weekNumber={workoutDay.program_weeks.week_number}
      userId={user.id}
    />
  )
}
