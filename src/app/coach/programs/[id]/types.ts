export interface Exercise {
  id: string
  name: string
  equipment: string | null
  muscle_groups: string[]
  type: 'strength' | 'mobility' | 'cardio'
  primary_muscle: string | null
  focus_area: string | null
}

export interface WorkoutExercise {
  id: string
  day_id: string
  exercise_id: string
  exercise?: Exercise
  section: 'warmup' | 'strength' | 'cooldown' | 'cardio'
  label: string | null
  sets: string | null
  reps: string | null
  weight: string | null
  rest_seconds: number | null
  rpe: number | null
  notes: string | null
  sort_order: number
}

export interface WorkoutDay {
  id: string
  week_id: string
  day_number: number
  name: string
  subtitle: string | null
  is_rest_day: boolean
  rest_day_notes: string | null
  warmup_template_id: string | null
  cooldown_template_id: string | null
  workout_exercises: WorkoutExercise[]
}

export interface ProgramWeek {
  id: string
  program_id: string
  week_number: number
  name: string | null
  workout_days: WorkoutDay[]
}

export interface Program {
  id: string
  name: string
  type: 'strength' | 'mobility' | 'cardio'
  description: string | null
  is_indefinite: boolean
  is_archived: boolean
  created_by: string
  program_weeks: ProgramWeek[]
}

export interface Template {
  id: string
  name: string
  type: 'warmup' | 'cooldown'
  description: string | null
  duration_minutes: number | null
}
