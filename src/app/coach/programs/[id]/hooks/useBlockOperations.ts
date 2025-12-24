'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExerciseBlock, Exercise, WorkoutExercise } from '../types'

interface UseBlockOperationsProps {
  supabase: SupabaseClient
}

export function useBlockOperations({ supabase }: UseBlockOperationsProps) {
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([])
  const [savingBlock, setSavingBlock] = useState(false)

  // Load blocks on mount
  useEffect(() => {
    const loadBlocks = async () => {
      const { data } = await supabase
        .from('exercise_blocks')
        .select(`*, exercise_block_items(*, exercise:exercises(*))`)
        .order('name')
      if (data) setBlocks(data)
    }
    loadBlocks()
  }, [supabase])

  const reloadBlocks = useCallback(async () => {
    const { data } = await supabase
      .from('exercise_blocks')
      .select(`*, exercise_block_items(*, exercise:exercises(*))`)
      .order('name')
    if (data) setBlocks(data)
  }, [supabase])

  const saveAsBlock = useCallback(async (
    name: string,
    exercisesToSave: WorkoutExercise[]
  ): Promise<boolean> => {
    if (!name.trim() || exercisesToSave.length === 0) return false
    setSavingBlock(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('You must be logged in to save blocks')
        return false
      }

      // Create the block
      const { data: block, error: blockError } = await supabase
        .from('exercise_blocks')
        .insert({ name: name.trim(), created_by: user.id })
        .select()
        .single()

      if (blockError) throw blockError

      // Create block items
      const items = exercisesToSave.map((ex, i) => ({
        block_id: block.id,
        exercise_id: ex.exercise_id,
        label: ex.label,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        weight_unit: ex.weight_unit,
        rest_seconds: ex.rest_seconds,
        rpe: ex.rpe,
        notes: ex.notes,
        sort_order: i,
      }))

      const { error: itemsError } = await supabase
        .from('exercise_block_items')
        .insert(items)

      if (itemsError) throw itemsError

      await reloadBlocks()
      return true
    } catch (err) {
      console.error('Error saving block:', err)
      alert('Error saving block')
      return false
    } finally {
      setSavingBlock(false)
    }
  }, [supabase, reloadBlocks])

  const deleteBlock = useCallback(async (blockId: string): Promise<boolean> => {
    if (!confirm('Delete this saved block?')) return false
    try {
      await supabase.from('exercise_blocks').delete().eq('id', blockId)
      setBlocks(prev => prev.filter(b => b.id !== blockId))
      return true
    } catch (err) {
      console.error('Error deleting block:', err)
      alert('Error deleting block')
      return false
    }
  }, [supabase])

  const updateBlockName = useCallback(async (blockId: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) return false
    try {
      await supabase.from('exercise_blocks').update({ name: newName.trim() }).eq('id', blockId)
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, name: newName.trim() } : b))
      return true
    } catch (err) {
      console.error('Error updating block:', err)
      alert('Error updating block name')
      return false
    }
  }, [supabase])

  const updateBlockItem = useCallback(async (
    blockId: string,
    itemId: string,
    field: string,
    value: string | number | null
  ): Promise<boolean> => {
    try {
      await supabase.from('exercise_block_items').update({ [field]: value }).eq('id', itemId)
      setBlocks(prev => prev.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: b.exercise_block_items?.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
          )
        }
      }))
      return true
    } catch (err) {
      console.error('Error updating block item:', err)
      return false
    }
  }, [supabase])

  const deleteBlockItem = useCallback(async (blockId: string, itemId: string): Promise<boolean> => {
    try {
      await supabase.from('exercise_block_items').delete().eq('id', itemId)
      setBlocks(prev => prev.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: b.exercise_block_items?.filter(item => item.id !== itemId)
        }
      }))
      return true
    } catch (err) {
      console.error('Error deleting block item:', err)
      alert('Error removing exercise from block')
      return false
    }
  }, [supabase])

  const addExerciseToBlock = useCallback(async (blockId: string, exercise: Exercise): Promise<boolean> => {
    try {
      const block = blocks.find(b => b.id === blockId)
      const sortOrder = (block?.exercise_block_items?.length || 0)

      const { data, error } = await supabase
        .from('exercise_block_items')
        .insert({
          block_id: blockId,
          exercise_id: exercise.id,
          sort_order: sortOrder,
          sets: '3',
          reps: '10',
        })
        .select(`*, exercise:exercises(*)`)
        .single()

      if (error) throw error

      setBlocks(prev => prev.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: [...(b.exercise_block_items || []), data]
        }
      }))
      return true
    } catch (err) {
      console.error('Error adding exercise to block:', err)
      alert('Error adding exercise to block')
      return false
    }
  }, [blocks, supabase])

  const replaceBlockItemExercise = useCallback(async (
    blockId: string,
    itemId: string,
    newExercise: Exercise
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('exercise_block_items')
        .update({ exercise_id: newExercise.id })
        .eq('id', itemId)

      if (error) throw error

      setBlocks(prev => prev.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: b.exercise_block_items?.map(item =>
            item.id === itemId ? { ...item, exercise_id: newExercise.id, exercise: newExercise } : item
          )
        }
      }))
      return true
    } catch (err) {
      console.error('Error replacing block item exercise:', err)
      return false
    }
  }, [supabase])

  const insertBlockToDay = useCallback(async (
    dayId: string,
    block: ExerciseBlock,
    currentExercises: WorkoutExercise[]
  ): Promise<WorkoutExercise[]> => {
    if (!block.exercise_block_items?.length) {
      console.log('No block items to insert')
      return []
    }

    // Use max sort_order + 1 to ensure correct ordering
    const maxSortOrder = currentExercises.reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)
    const startOrder = maxSortOrder + 1
    const newExercises: WorkoutExercise[] = []

    for (let i = 0; i < block.exercise_block_items.length; i++) {
      const item = block.exercise_block_items[i]
      const { data, error } = await supabase.from('workout_exercises').insert({
        day_id: dayId,
        exercise_id: item.exercise_id,
        section: 'strength',
        sort_order: startOrder + i,
        label: item.label,
        sets: item.sets || '3',
        reps: item.reps || '10',
        weight: item.weight,
        rest_seconds: item.rest_seconds,
        rpe: item.rpe,
        notes: item.notes,
      }).select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`).single()

      if (error) {
        console.error('Error inserting block item:', error)
        alert('Error inserting block: ' + error.message)
        return newExercises
      }
      if (data) newExercises.push(data)
    }

    return newExercises
  }, [supabase])

  return {
    blocks,
    savingBlock,
    saveAsBlock,
    deleteBlock,
    updateBlockName,
    updateBlockItem,
    deleteBlockItem,
    addExerciseToBlock,
    replaceBlockItemExercise,
    insertBlockToDay,
    reloadBlocks,
  }
}

export type BlockOperationsHook = ReturnType<typeof useBlockOperations>
