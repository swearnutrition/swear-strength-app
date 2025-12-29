import { createClient, createAdminClient } from '@/lib/supabase/server'
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

  // First get user's active assignment to verify access
  const { data: assignment, error: assignmentError } = await supabase
    .from('user_program_assignments')
    .select('id, program_id, current_week')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (assignmentError || !assignment) {
    console.error('No active assignment found:', assignmentError)
    redirect('/workouts')
  }

  // Use admin client to bypass RLS for reading workout data
  // We've already verified the user has access via their assignment
  let adminClient
  try {
    adminClient = createAdminClient()
  } catch (e) {
    console.error('Failed to create admin client:', e)
    // Fall back to regular client
    adminClient = supabase
  }

  // First, check if the workout day exists at all
  const { data: workoutDayCheck } = await adminClient
    .from('workout_days')
    .select('id, name, week_id')
    .eq('id', dayId)
    .single()

  if (!workoutDayCheck) {
    redirect('/workouts')
  }

  // Check if this workout belongs to a week in the user's program
  const { data: weekCheck } = await adminClient
    .from('program_weeks')
    .select('id, program_id, week_number')
    .eq('id', workoutDayCheck.week_id)
    .single()

  if (!weekCheck || weekCheck.program_id !== assignment.program_id) {
    redirect('/workouts')
  }

  // Get full workout day data - first get workout_day without nested exercises
  const { data: workoutDayBase, error: workoutError } = await adminClient
    .from('workout_days')
    .select(`
      id,
      day_number,
      name,
      subtitle,
      is_rest_day,
      rest_day_notes,
      week_id,
      cardio_notes,
      created_at,
      updated_at
    `)
    .eq('id', dayId)
    .single()

  if (workoutError || !workoutDayBase) {
    redirect('/workouts')
  }

  // Get workout exercises separately - without the nested exercises join first
  const { data: workoutExercisesRaw, error: exercisesError } = await adminClient
    .from('workout_exercises')
    .select(`
      id,
      exercise_id,
      section,
      label,
      sets,
      reps,
      weight,
      rest_seconds,
      rpe,
      notes,
      sort_order
    `)
    .eq('day_id', dayId)
    .order('sort_order')

  if (exercisesError) {
    redirect('/workouts')
  }

  // Get exercise details separately to avoid foreign key ambiguity
  const exerciseIds = (workoutExercisesRaw || []).map(we => we.exercise_id).filter(Boolean)

  let exercisesMap: Record<string, { id: string; name: string; equipment: string | null; muscle_groups: string[]; video_url: string | null; cues: string | null; purpose: string | null; logging_type: string | null }> = {}

  if (exerciseIds.length > 0) {
    const { data: exercisesList, error: exercisesListError } = await adminClient
      .from('exercises')
      .select('id, name, equipment, muscle_groups, video_url, cues, purpose, logging_type')
      .in('id', exerciseIds)

    if (!exercisesListError && exercisesList) {
      exercisesMap = exercisesList.reduce((acc, ex) => {
        acc[ex.id] = ex
        return acc
      }, {} as typeof exercisesMap)
    }
  }

  // Combine workout_exercises with exercises data
  // Map video_url to demo_url for client component compatibility
  const workoutExercises = (workoutExercisesRaw || []).map(we => {
    const exercise = exercisesMap[we.exercise_id]
    return {
      ...we,
      exercises: exercise ? {
        ...exercise,
        demo_url: exercise.video_url, // Map video_url to demo_url for client component
      } : null
    }
  })

  // Combine the data
  const workoutDay = {
    ...workoutDayBase,
    workout_exercises: workoutExercises || []
  }

  // Get program name
  const { data: programData } = await adminClient
    .from('programs')
    .select('name')
    .eq('id', assignment.program_id)
    .single()

  // Add program_weeks info to workoutDay for compatibility with existing code
  const workoutDayWithWeek = {
    ...workoutDay,
    program_weeks: {
      program_id: weekCheck.program_id,
      week_number: weekCheck.week_number,
      programs: { name: programData?.name || 'Program' }
    }
  }

  // Check if there's a completed workout for this day (most recent)
  const { data: completedLog } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('workout_day_id', dayId)
    .eq('assignment_id', assignment.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single()

  // Track if we're viewing a completed workout vs active
  let isViewingCompleted = false
  let workoutLog = completedLog

  if (completedLog) {
    // There's a completed workout - show it in read-only mode
    isViewingCompleted = true
    workoutLog = completedLog
  } else {
    // No completed workout - get or create an active one
    const { data: activeLog } = await supabase
      .from('workout_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('workout_day_id', dayId)
      .eq('assignment_id', assignment.id)
      .is('completed_at', null)
      .single()

    if (!activeLog) {
      const { data: newLog, error: insertError } = await supabase
        .from('workout_logs')
        .insert({
          user_id: user.id,
          workout_day_id: dayId,
          assignment_id: assignment.id,
        })
        .select()
        .single()

      if (insertError) {
        console.error('Failed to create workout log:', insertError)
        redirect('/workouts')
      }

      workoutLog = newLog
    } else {
      // Reset started_at when resuming an incomplete workout so timer starts fresh
      const { data: updatedLog } = await supabase
        .from('workout_logs')
        .update({ started_at: new Date().toISOString() })
        .eq('id', activeLog.id)
        .select()
        .single()

      workoutLog = updatedLog || activeLog
    }
  }

  if (!workoutLog) {
    console.error('No workout log available')
    redirect('/workouts')
  }

  // Get existing set logs for this workout
  const { data: setLogs } = await supabase
    .from('set_logs')
    .select('*')
    .eq('workout_log_id', workoutLog?.id || '')
    .order('set_number')

  // Get exercise IDs for personal records query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prExerciseIds = (workoutDay.workout_exercises as any[]).map(
    (we) => we.exercises?.id
  ).filter(Boolean)

  // Fetch personal records for all exercises in this workout
  const { data: personalRecords } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', user.id)
    .in('exercise_id', prExerciseIds)

  // Fetch exercise history - past set_logs for each exercise
  // Get the exercise_ids from the current workout to find history across ALL workout days
  const currentExerciseIds = (workoutDay.workout_exercises as { id: string; exercises: { id: string } | null }[])
    .filter(we => we.exercises)
    .map(we => we.exercises!.id)

  // Get set logs from past workouts for these exercises
  let exerciseHistory: {
    exercise_id: string
    workout_exercise_id: string
    set_number: number
    weight: number | null
    reps_completed: number | null
    completed_at: string
    notes: string | null
  }[] = []

  if (currentExerciseIds.length > 0) {
    // First, find ALL workout_exercise records that use these exercises
    // (across all workout days in the user's program)
    const { data: allWorkoutExercises } = await adminClient
      .from('workout_exercises')
      .select('id, exercise_id')
      .in('exercise_id', currentExerciseIds)

    if (allWorkoutExercises && allWorkoutExercises.length > 0) {
      const allWorkoutExerciseIds = allWorkoutExercises.map(we => we.id)

      // Build a map from workout_exercise_id to exercise_id
      const workoutExerciseToExercise = new Map(
        allWorkoutExercises.map(we => [we.id, we.exercise_id])
      )

      // Get all past completed workout logs for this user's assignment
      const { data: pastWorkoutLogs } = await supabase
        .from('workout_logs')
        .select('id, completed_at, workout_day_id')
        .eq('user_id', user.id)
        .eq('assignment_id', assignment.id)
        .not('completed_at', 'is', null)
        .neq('id', workoutLog.id) // Exclude current workout
        .order('completed_at', { ascending: false })
        .limit(20)

      if (pastWorkoutLogs && pastWorkoutLogs.length > 0) {
        const pastLogIds = pastWorkoutLogs.map(log => log.id)
        const logDateMap = new Map(pastWorkoutLogs.map(log => [log.id, log.completed_at]))

        // Get set logs from past workouts for any workout_exercise that shares our exercise_ids
        const { data: pastSetLogs } = await supabase
          .from('set_logs')
          .select(`
            id,
            workout_log_id,
            workout_exercise_id,
            set_number,
            weight,
            reps_completed,
            notes,
            created_at
          `)
          .in('workout_log_id', pastLogIds)
          .in('workout_exercise_id', allWorkoutExerciseIds)
          .order('set_number')

        if (pastSetLogs) {
          exerciseHistory = pastSetLogs
            .filter(sl => workoutExerciseToExercise.has(sl.workout_exercise_id))
            .map(sl => ({
              exercise_id: workoutExerciseToExercise.get(sl.workout_exercise_id)!,
              workout_exercise_id: sl.workout_exercise_id,
              set_number: sl.set_number,
              weight: sl.weight,
              reps_completed: sl.reps_completed,
              completed_at: logDateMap.get(sl.workout_log_id) || sl.created_at,
              notes: sl.notes,
            }))
        }
      }
    }
  }

  // Fetch client exercise notes
  const { data: clientExerciseNotes } = await supabase
    .from('client_exercise_notes')
    .select('*')
    .eq('user_id', user.id)
    .in('exercise_id', prExerciseIds)

  // Sort exercises by sort_order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedExercises = (workoutDay.workout_exercises as any[]).sort(
    (a, b) => a.sort_order - b.sort_order
  )

  return (
    <WorkoutDayClient
      workoutDay={{
        ...workoutDayWithWeek,
        workout_exercises: sortedExercises,
      }}
      workoutLog={workoutLog}
      setLogs={setLogs || []}
      personalRecords={personalRecords || []}
      exerciseHistory={exerciseHistory}
      clientExerciseNotes={clientExerciseNotes || []}
      programName={workoutDayWithWeek.program_weeks.programs.name}
      weekNumber={workoutDayWithWeek.program_weeks.week_number}
      userId={user.id}
      isViewingCompleted={isViewingCompleted}
    />
  )
}
