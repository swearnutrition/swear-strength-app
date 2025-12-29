import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkoutHistoryClient } from './WorkoutHistoryClient'

export default async function WorkoutHistoryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get completed workout logs with workout day info
  const { data: workoutLogsRaw } = await supabase
    .from('workout_logs')
    .select(`
      id,
      started_at,
      completed_at,
      workout_day_id,
      assignment_id,
      workout_days (
        id,
        name,
        day_number,
        week_id,
        program_weeks (
          week_number,
          program_id,
          programs (
            name
          )
        )
      )
    `)
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  // Transform the nested data to match expected types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workoutLogs = (workoutLogsRaw || []).map((log: any) => ({
    ...log,
    workout_days: Array.isArray(log.workout_days) ? log.workout_days[0] : log.workout_days
  }))

  // Get set logs for volume calculation
  const workoutLogIds = (workoutLogs || []).map(log => log.id)

  let setLogs: { workout_log_id: string; weight: number | null; reps_completed: number | null; workout_exercise_id: string }[] = []

  if (workoutLogIds.length > 0) {
    const { data: setLogsData } = await supabase
      .from('set_logs')
      .select('workout_log_id, weight, reps_completed, workout_exercise_id')
      .in('workout_log_id', workoutLogIds)

    setLogs = setLogsData || []
  }

  // Get personal records
  const { data: personalRecordsRaw } = await supabase
    .from('personal_records')
    .select(`
      id,
      exercise_id,
      record_type,
      value,
      achieved_at,
      set_log_id,
      exercises (
        id,
        name
      )
    `)
    .eq('user_id', user.id)
    .order('achieved_at', { ascending: false })

  // Transform the nested data to match expected types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const personalRecords = (personalRecordsRaw || []).map((pr: any) => ({
    ...pr,
    exercises: Array.isArray(pr.exercises) ? pr.exercises[0] : pr.exercises
  }))

  // Get workout exercises for muscle group data
  // Use admin client to bypass RLS for reading exercise data
  let adminClient
  try {
    adminClient = createAdminClient()
  } catch {
    adminClient = supabase
  }

  const workoutDayIds = [...new Set((workoutLogs || []).map(log => log.workout_day_id))]

  let workoutExercises: { id: string; day_id: string; section: string; sets: string | null; exercise_id: string | null; exercises: { id: string; muscle_groups: string[] | null; primary_muscle: string | null; focus_area: string | null } | null }[] = []

  if (workoutDayIds.length > 0) {
    // First get workout_exercises with exercise_id
    const { data: workoutExercisesRaw } = await adminClient
      .from('workout_exercises')
      .select('id, day_id, section, sets, exercise_id')
      .in('day_id', workoutDayIds)

    // Then get exercise details separately
    const exerciseIds = [...new Set((workoutExercisesRaw || []).map(we => we.exercise_id).filter(Boolean))]

    let exerciseMap: Record<string, { id: string; muscle_groups: string[] | null; primary_muscle: string | null; focus_area: string | null }> = {}

    if (exerciseIds.length > 0) {
      const { data: exerciseList } = await adminClient
        .from('exercises')
        .select('id, muscle_groups, primary_muscle, focus_area')
        .in('id', exerciseIds)

      if (exerciseList) {
        exerciseMap = exerciseList.reduce((acc, ex) => {
          acc[ex.id] = ex
          return acc
        }, {} as typeof exerciseMap)
      }
    }

    // Combine workout_exercises with exercises data
    workoutExercises = (workoutExercisesRaw || []).map(we => ({
      ...we,
      exercises: we.exercise_id ? exerciseMap[we.exercise_id] || null : null
    }))
  }

  // Get user's first workout date for "member since"
  const { data: firstWorkout } = await supabase
    .from('workout_logs')
    .select('completed_at')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })
    .limit(1)
    .single()

  return (
    <WorkoutHistoryClient
      workoutLogs={workoutLogs || []}
      setLogs={setLogs}
      personalRecords={personalRecords || []}
      workoutExercises={workoutExercises}
      firstWorkoutDate={firstWorkout?.completed_at || null}
    />
  )
}
