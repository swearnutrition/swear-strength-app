export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'coach' | 'client'
export type ClientType = 'online' | 'training' | 'hybrid'
export type ProgramType = 'strength' | 'mobility' | 'cardio'
export type ExerciseType = 'strength' | 'mobility' | 'cardio'
export type WorkoutSection = 'warmup' | 'strength' | 'cooldown' | 'cardio'
export type WeightUnit = 'lbs' | 'kg'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active'
export type NutritionGoal = 'lose' | 'maintain' | 'gain'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          name: string
          email: string
          avatar_url: string | null
          last_login: string | null
          invited_by: string | null
          invite_accepted_at: string | null
          preferred_weight_unit: WeightUnit
          client_type: ClientType | null
          hybrid_sessions_per_month: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          name: string
          email: string
          avatar_url?: string | null
          last_login?: string | null
          invited_by?: string | null
          invite_accepted_at?: string | null
          preferred_weight_unit?: WeightUnit
          client_type?: ClientType | null
          hybrid_sessions_per_month?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          name?: string
          email?: string
          avatar_url?: string | null
          last_login?: string | null
          invited_by?: string | null
          invite_accepted_at?: string | null
          preferred_weight_unit?: WeightUnit
          client_type?: ClientType | null
          hybrid_sessions_per_month?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      invites: {
        Row: {
          id: string
          email: string
          token: string
          created_by: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          token: string
          created_by: string
          expires_at: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          token?: string
          created_by?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
      }
      exercises: {
        Row: {
          id: string
          name: string
          equipment: string | null
          muscle_groups: string[]
          type: ExerciseType
          demo_url: string | null
          cues: string | null
          instructions: string | null
          is_approved: boolean
          submitted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          equipment?: string | null
          muscle_groups?: string[]
          type?: ExerciseType
          demo_url?: string | null
          cues?: string | null
          instructions?: string | null
          is_approved?: boolean
          submitted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          equipment?: string | null
          muscle_groups?: string[]
          type?: ExerciseType
          demo_url?: string | null
          cues?: string | null
          instructions?: string | null
          is_approved?: boolean
          submitted_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      programs: {
        Row: {
          id: string
          name: string
          type: ProgramType
          description: string | null
          is_indefinite: boolean
          is_archived: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: ProgramType
          description?: string | null
          is_indefinite?: boolean
          is_archived?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: ProgramType
          description?: string | null
          is_indefinite?: boolean
          is_archived?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      program_weeks: {
        Row: {
          id: string
          program_id: string
          week_number: number
          name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          program_id: string
          week_number: number
          name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          program_id?: string
          week_number?: number
          name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workout_days: {
        Row: {
          id: string
          week_id: string
          day_number: number
          name: string
          subtitle: string | null
          is_rest_day: boolean
          rest_day_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          week_id: string
          day_number: number
          name: string
          subtitle?: string | null
          is_rest_day?: boolean
          rest_day_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          week_id?: string
          day_number?: number
          name?: string
          subtitle?: string | null
          is_rest_day?: boolean
          rest_day_notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workout_exercises: {
        Row: {
          id: string
          day_id: string
          exercise_id: string
          section: WorkoutSection
          label: string | null
          sets: string | null
          reps: string | null
          weight: string | null
          rest_seconds: number | null
          rpe: number | null
          notes: string | null
          sort_order: number
          alternative_exercise_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          day_id: string
          exercise_id: string
          section?: WorkoutSection
          label?: string | null
          sets?: string | null
          reps?: string | null
          weight?: string | null
          rest_seconds?: number | null
          rpe?: number | null
          notes?: string | null
          sort_order?: number
          alternative_exercise_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          day_id?: string
          exercise_id?: string
          section?: WorkoutSection
          label?: string | null
          sets?: string | null
          reps?: string | null
          weight?: string | null
          rest_seconds?: number | null
          rpe?: number | null
          notes?: string | null
          sort_order?: number
          alternative_exercise_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_program_assignments: {
        Row: {
          id: string
          user_id: string
          program_id: string
          start_date: string
          is_active: boolean
          current_week: number
          current_day: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          program_id: string
          start_date: string
          is_active?: boolean
          current_week?: number
          current_day?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          program_id?: string
          start_date?: string
          is_active?: boolean
          current_week?: number
          current_day?: number
          created_at?: string
          updated_at?: string
        }
      }
      workout_logs: {
        Row: {
          id: string
          user_id: string
          workout_day_id: string
          assignment_id: string | null
          started_at: string
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workout_day_id: string
          assignment_id?: string | null
          started_at?: string
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workout_day_id?: string
          assignment_id?: string | null
          started_at?: string
          completed_at?: string | null
          created_at?: string
        }
      }
      set_logs: {
        Row: {
          id: string
          workout_log_id: string
          workout_exercise_id: string
          set_number: number
          weight: number | null
          weight_unit: WeightUnit
          reps_completed: number | null
          duration_seconds: number | null
          is_bodyweight: boolean
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_log_id: string
          workout_exercise_id: string
          set_number: number
          weight?: number | null
          weight_unit?: WeightUnit
          reps_completed?: number | null
          duration_seconds?: number | null
          is_bodyweight?: boolean
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_log_id?: string
          workout_exercise_id?: string
          set_number?: number
          weight?: number | null
          weight_unit?: WeightUnit
          reps_completed?: number | null
          duration_seconds?: number | null
          is_bodyweight?: boolean
          notes?: string | null
          created_at?: string
        }
      }
      workout_completions: {
        Row: {
          id: string
          workout_log_id: string
          difficulty_rating: number | null
          energy_level: string | null
          feeling: number | null
          notes: string | null
          media_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workout_log_id: string
          difficulty_rating?: number | null
          energy_level?: string | null
          feeling?: number | null
          notes?: string | null
          media_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workout_log_id?: string
          difficulty_rating?: number | null
          energy_level?: string | null
          feeling?: number | null
          notes?: string | null
          media_url?: string | null
          created_at?: string
        }
      }
      personal_records: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          record_type: string
          value: number
          weight_unit: WeightUnit
          achieved_at: string
          set_log_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          record_type: string
          value: number
          weight_unit?: WeightUnit
          achieved_at?: string
          set_log_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          record_type?: string
          value?: number
          weight_unit?: WeightUnit
          achieved_at?: string
          set_log_id?: string | null
          created_at?: string
        }
      }
      habits: {
        Row: {
          id: string
          user_id: string
          date: string
          water: boolean
          water_amount: number | null
          sleep: boolean
          sleep_hours: number | null
          protein: boolean
          protein_grams: number | null
          creatine: boolean
          custom_habits: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          water?: boolean
          water_amount?: number | null
          sleep?: boolean
          sleep_hours?: number | null
          protein?: boolean
          protein_grams?: number | null
          creatine?: boolean
          custom_habits?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          water?: boolean
          water_amount?: number | null
          sleep?: boolean
          sleep_hours?: number | null
          protein?: boolean
          protein_grams?: number | null
          creatine?: boolean
          custom_habits?: Json
          created_at?: string
          updated_at?: string
        }
      }
      nutrition_profiles: {
        Row: {
          id: string
          user_id: string
          weight: number | null
          weight_unit: WeightUnit
          height_cm: number | null
          age: number | null
          sex: string | null
          activity_level: ActivityLevel
          goal: NutritionGoal
          bmr: number | null
          tdee: number | null
          calories: number | null
          protein: number | null
          carbs: number | null
          fat: number | null
          meals_per_day: number
          calculated_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          weight?: number | null
          weight_unit?: WeightUnit
          height_cm?: number | null
          age?: number | null
          sex?: string | null
          activity_level?: ActivityLevel
          goal?: NutritionGoal
          bmr?: number | null
          tdee?: number | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          meals_per_day?: number
          calculated_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          weight?: number | null
          weight_unit?: WeightUnit
          height_cm?: number | null
          age?: number | null
          sex?: string | null
          activity_level?: ActivityLevel
          goal?: NutritionGoal
          bmr?: number | null
          tdee?: number | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          meals_per_day?: number
          calculated_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      nutrition_logs: {
        Row: {
          id: string
          user_id: string
          date: string
          meal_number: number | null
          meal_name: string | null
          calories: number | null
          protein: number | null
          carbs: number | null
          fat: number | null
          portions_protein: number | null
          portions_carbs: number | null
          portions_fat: number | null
          photo_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          meal_number?: number | null
          meal_name?: string | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          portions_protein?: number | null
          portions_carbs?: number | null
          portions_fat?: number | null
          photo_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          meal_number?: number | null
          meal_name?: string | null
          calories?: number | null
          protein?: number | null
          carbs?: number | null
          fat?: number | null
          portions_protein?: number | null
          portions_carbs?: number | null
          portions_fat?: number | null
          photo_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          created_by: string
          expires_at: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          created_by: string
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          created_by?: string
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_coach: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      user_role: UserRole
      client_type: ClientType
      program_type: ProgramType
      exercise_type: ExerciseType
      workout_section: WorkoutSection
      weight_unit: WeightUnit
      activity_level: ActivityLevel
      nutrition_goal: NutritionGoal
    }
  }
}

// Helper types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Exercise = Database['public']['Tables']['exercises']['Row']
export type Program = Database['public']['Tables']['programs']['Row']
export type ProgramWeek = Database['public']['Tables']['program_weeks']['Row']
export type WorkoutDay = Database['public']['Tables']['workout_days']['Row']
export type WorkoutExercise = Database['public']['Tables']['workout_exercises']['Row']
export type UserProgramAssignment = Database['public']['Tables']['user_program_assignments']['Row']
export type WorkoutLog = Database['public']['Tables']['workout_logs']['Row']
export type SetLog = Database['public']['Tables']['set_logs']['Row']
export type WorkoutCompletion = Database['public']['Tables']['workout_completions']['Row']
export type PersonalRecord = Database['public']['Tables']['personal_records']['Row']
export type Habit = Database['public']['Tables']['habits']['Row']
export type NutritionProfile = Database['public']['Tables']['nutrition_profiles']['Row']
export type NutritionLog = Database['public']['Tables']['nutrition_logs']['Row']
export type Announcement = Database['public']['Tables']['announcements']['Row']
export type Invite = Database['public']['Tables']['invites']['Row']
