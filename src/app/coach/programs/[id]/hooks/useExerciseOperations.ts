'use client'

import { useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Program, WorkoutDay, Exercise, WorkoutExercise } from '../types'

interface UseExerciseOperationsProps {
  program: Program
  setProgram: React.Dispatch<React.SetStateAction<Program>>
  setSaving: React.Dispatch<React.SetStateAction<boolean>>
  supabase: SupabaseClient
}

export function useExerciseOperations({
  program,
  setProgram,
  setSaving,
  supabase,
}: UseExerciseOperationsProps) {
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({})

  // Add a new exercise to a day
  const addExercise = useCallback(async (
    dayId: string,
    exercise: Exercise,
    currentExercises: WorkoutExercise[]
  ): Promise<WorkoutExercise | null> => {
    // Get values from the last exercise to auto-fill
    const lastExercise = currentExercises[currentExercises.length - 1]
    const defaultSets = lastExercise?.sets ?? '3'
    const defaultReps = lastExercise?.reps ?? '10'
    const defaultRpe = lastExercise?.rpe ?? null
    const defaultRest = lastExercise?.rest_seconds ?? null
    const defaultWeight = lastExercise?.weight ?? null

    // Use max sort_order + 1 to ensure correct ordering even if exercises were deleted
    const maxSortOrder = currentExercises.reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)
    const newSortOrder = maxSortOrder + 1

    const { data, error } = await supabase.from('workout_exercises')
      .insert({
        day_id: dayId,
        exercise_id: exercise.id,
        section: 'strength',
        sort_order: newSortOrder,
        sets: defaultSets,
        reps: defaultReps,
        rpe: defaultRpe,
        rest_seconds: defaultRest,
        weight: defaultWeight,
      })
      .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
      .single()

    if (error) {
      console.error('Add exercise error:', error)
      alert('Error: ' + error.message)
      return null
    }

    return data
  }, [supabase])

  // Delete an exercise
  const deleteExercise = useCallback(async (exerciseId: string): Promise<boolean> => {
    const { error } = await supabase.from('workout_exercises').delete().eq('id', exerciseId)
    if (error) {
      console.error('Delete exercise error:', error)
      alert('Error: ' + error.message)
      return false
    }
    return true
  }, [supabase])

  // Update a single field on an exercise (debounced)
  const updateExercise = useCallback((
    exerciseId: string,
    dayId: string,
    field: string,
    value: unknown,
    updateLocalState: (dayId: string, updatedDay: WorkoutDay) => void
  ) => {
    // Find the day and update local state immediately
    for (const week of program.program_weeks) {
      const day = week.workout_days.find(d => d.id === dayId)
      if (day) {
        const updatedExercises = day.workout_exercises.map(e =>
          e.id === exerciseId ? { ...e, [field]: value } : e
        )
        updateLocalState(dayId, { ...day, workout_exercises: updatedExercises })
        break
      }
    }

    // Debounced save to database (500ms delay)
    const timerKey = `${exerciseId}-${field}`
    if (saveTimers.current[timerKey]) {
      clearTimeout(saveTimers.current[timerKey])
    }

    saveTimers.current[timerKey] = setTimeout(async () => {
      console.log('Saving to DB:', { exerciseId, field, value })
      const { error } = await supabase.from('workout_exercises').update({ [field]: value }).eq('id', exerciseId)
      if (error) {
        console.error('Error saving exercise field:', field, error)
      } else {
        console.log('Saved successfully:', field, value)
      }
    }, 500)
  }, [program, supabase])

  // Reorder exercises within a day
  const reorderExercises = useCallback(async (
    dayId: string,
    exercises: WorkoutExercise[],
    fromIndex: number,
    toIndex: number
  ): Promise<WorkoutExercise[]> => {
    const newExercises = [...exercises]
    const [moved] = newExercises.splice(fromIndex, 1)
    newExercises.splice(toIndex, 0, moved)

    // Update sort_order in DB
    const updates = newExercises.map((e, i) =>
      supabase.from('workout_exercises').update({ sort_order: i }).eq('id', e.id)
    )
    await Promise.all(updates)

    return newExercises
  }, [supabase])

  // Move exercise to a different day
  const moveExerciseToDifferentDay = useCallback(async (
    exerciseId: string,
    fromDayId: string,
    toDayId: string
  ): Promise<boolean> => {
    if (fromDayId === toDayId) return false
    setSaving(true)

    // Find the exercise data
    let exerciseData: WorkoutExercise | null = null

    for (const week of program.program_weeks) {
      for (const day of week.workout_days) {
        if (day.id === fromDayId) {
          exerciseData = day.workout_exercises.find(e => e.id === exerciseId) || null
          break
        }
      }
      if (exerciseData) break
    }

    if (!exerciseData) {
      setSaving(false)
      return false
    }

    // Find target day exercise count
    let targetDayExerciseCount = 0
    for (const week of program.program_weeks) {
      for (const day of week.workout_days) {
        if (day.id === toDayId) {
          targetDayExerciseCount = day.workout_exercises.length
          break
        }
      }
    }

    // Update database
    const result = await supabase
      .from('workout_exercises')
      .update({ day_id: toDayId, sort_order: targetDayExerciseCount })
      .eq('id', exerciseId)
      .select()

    if (result.error) {
      console.error('Error moving exercise:', result.error)
      alert('Error moving exercise: ' + (result.error.message || 'Unknown error'))
      setSaving(false)
      return false
    }

    // Update local state
    setProgram(p => ({
      ...p,
      program_weeks: p.program_weeks.map(week => ({
        ...week,
        workout_days: week.workout_days.map(day => {
          if (day.id === fromDayId) {
            return {
              ...day,
              workout_exercises: day.workout_exercises.filter(e => e.id !== exerciseId)
            }
          }
          if (day.id === toDayId) {
            return {
              ...day,
              workout_exercises: [...day.workout_exercises, { ...exerciseData!, sort_order: targetDayExerciseCount }]
            }
          }
          return day
        })
      }))
    }))

    setSaving(false)
    return true
  }, [program, setProgram, setSaving, supabase])

  return {
    addExercise,
    deleteExercise,
    updateExercise,
    reorderExercises,
    moveExerciseToDifferentDay,
  }
}

export type ExerciseOperationsHook = ReturnType<typeof useExerciseOperations>
