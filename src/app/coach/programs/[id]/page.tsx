import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProgramBuilderClient } from './ProgramBuilderClient'
import type { Program, Exercise } from './types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProgramBuilderPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch program with all nested data
  const { data: program, error } = await supabase
    .from('programs')
    .select(`
      *,
      program_weeks (
        *,
        workout_days (
          *,
          workout_exercises (
            *,
            exercise:exercises (*)
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !program) {
    notFound()
  }

  // Sort weeks, days, and exercises
  const sortedProgram: Program = {
    ...program,
    program_weeks: (program.program_weeks || [])
      .sort((a: { week_number: number }, b: { week_number: number }) => a.week_number - b.week_number)
      .map((week: { workout_days?: Array<{ day_number: number; workout_exercises?: Array<{ sort_order: number }> }> }) => ({
        ...week,
        workout_days: (week.workout_days || [])
          .sort((a: { day_number: number }, b: { day_number: number }) => a.day_number - b.day_number)
          .map((day: { workout_exercises?: Array<{ sort_order: number }> }) => ({
            ...day,
            workout_exercises: (day.workout_exercises || [])
              .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order),
          })),
      })),
  }

  // Fetch all exercises for the exercise picker
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name, equipment, muscle_groups, type, primary_muscle, focus_area')
    .eq('is_approved', true)
    .order('name')

  // Fetch warmup/cooldown templates
  const { data: templates } = await supabase
    .from('routine_templates')
    .select('id, name, type, description, duration_minutes')
    .eq('is_archived', false)
    .order('name')

  return (
    <ProgramBuilderClient
      program={sortedProgram}
      exercises={(exercises || []) as Exercise[]}
      templates={templates || []}
    />
  )
}
