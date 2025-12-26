export interface Exercise {
  id: string
  name: string
  equipment: string | null
  muscle_groups: string[]
  type: 'strength' | 'mobility' | 'cardio'
  primary_muscle: string | null
  focus_area: string | null
  video_url: string | null
}

export interface WorkoutExercise {
  id: string
  day_id: string
  exercise_id: string
  exercise?: Exercise
  section: 'warmup' | 'strength' | 'cooldown' | 'cardio'
  label: string | null
  // Strength fields
  sets: string | null
  reps: string | null
  weight: string | null
  weight_unit: 'lbs' | 'kg' | null
  rest_seconds: number | null
  rpe: number | null
  // Cardio fields
  duration_seconds: number | null
  distance: number | null
  distance_unit: 'miles' | 'km' | 'meters' | 'yards' | null
  target_pace: string | null
  hr_zone: number | null
  intervals: number | null
  interval_rest_seconds: number | null
  // Common
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
  cardio_notes: string | null
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

export type ProgramDifficulty = 'beginner' | 'intermediate' | 'advanced'
export type ProgramStyle = 'powerlifting' | 'bodybuilding' | 'general_fitness' | 'athletic' | 'rehab_prehab' | 'crossfit' | 'olympic_weightlifting' | 'strongman' | 'calisthenics' | 'hybrid' | 'sport_specific'
export type ProgramDelivery = 'pdf' | 'app' | 'in_person' | 'hybrid'

export interface Program {
  id: string
  name: string
  type: 'strength' | 'mobility' | 'cardio'
  description: string | null
  is_indefinite: boolean
  is_archived: boolean
  created_by: string
  program_weeks: ProgramWeek[]
  pdf_schedule: string[] | null
  pdf_tips: string[] | null
  difficulty: ProgramDifficulty | null
  style: ProgramStyle | null
  primary_muscles: string[]
  delivery_method: ProgramDelivery | null
  injury_friendly: string[]
}

export interface Template {
  id: string
  name: string
  type: 'warmup' | 'cooldown'
  description: string | null
  duration_minutes: number | null
}

export interface RoutineTemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  exercise?: Exercise
  sets: string | null
  reps: string | null
  notes: string | null
  sort_order: number
}

export interface RoutineTemplate {
  id: string
  name: string
  type: 'warmup' | 'cooldown'
  description: string | null
  duration_minutes: number | null
  is_archived: boolean
  routine_template_exercises?: RoutineTemplateExercise[]
}

export interface ExerciseBlockItem {
  id: string
  block_id: string
  exercise_id: string
  exercise?: Exercise
  label: string | null
  sets: string | null
  reps: string | null
  weight: string | null
  weight_unit: 'lbs' | 'kg' | null
  rest_seconds: number | null
  rpe: number | null
  notes: string | null
  sort_order: number
}

export interface ExerciseBlock {
  id: string
  name: string
  description: string | null
  created_by: string
  is_shared: boolean
  exercise_block_items?: ExerciseBlockItem[]
}
