'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutDay, Exercise, ExerciseBlock, RoutineTemplate } from '../types'
import { parseRestInput, formatRestTime } from '../utils/parseRest'
import { WorkoutSection } from './WorkoutSection'

interface ProgramSettings {
  weightUnit: 'lbs' | 'kg'
  effortUnit: 'rpe' | 'rir'
  showWeight: boolean
  showEffort: boolean
  showRest: boolean
  showNotes: boolean
}

interface WorkoutCardProps {
  day: WorkoutDay
  exercises: Exercise[]
  blocks: ExerciseBlock[]
  templates: RoutineTemplate[]
  onUpdate: (d: WorkoutDay) => void
  onDelete: () => void
  onCopy: () => void
  isCopied: boolean
  onSaveAsBlock: (exerciseId: string, exerciseName: string, dayExercises: WorkoutDay['workout_exercises']) => void
  supabase: ReturnType<typeof createClient>
  settings: ProgramSettings
  globalDragExercise: { exerciseId: string; fromDayId: string } | null
  onGlobalDragStart: (exerciseId: string, fromDayId: string) => void
  onGlobalDragEnd: () => void
  onDropFromOtherDay: (exerciseId: string, fromDayId: string, toDayId: string) => void
}

export function WorkoutCard({
  day,
  exercises,
  blocks,
  templates,
  onUpdate,
  onDelete,
  onCopy,
  isCopied,
  onSaveAsBlock,
  supabase,
  settings,
  globalDragExercise,
  onGlobalDragStart,
  onGlobalDragEnd,
  onDropFromOtherDay,
}: WorkoutCardProps) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [menuRowId, setMenuRowId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
  const [showAddRow, setShowAddRow] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [editingRestId, setEditingRestId] = useState<string | null>(null)
  const [restInputValue, setRestInputValue] = useState('')

  const insertBlock = async (block: ExerciseBlock) => {
    if (!block.exercise_block_items?.length) {
      console.log('No block items to insert')
      return
    }

    // Use max sort_order + 1 to ensure correct ordering even if exercises were deleted
    const maxSortOrder = day.workout_exercises.reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)
    const startOrder = maxSortOrder + 1
    const newExercises = []

    for (let i = 0; i < block.exercise_block_items.length; i++) {
      const item = block.exercise_block_items[i]
      const { data, error } = await supabase.from('workout_exercises').insert({
        day_id: day.id,
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
        return
      }
      if (data) newExercises.push(data)
    }

    if (newExercises.length > 0) {
      onUpdate({ ...day, workout_exercises: [...day.workout_exercises, ...newExercises] })
    }
    setSearch('')
    setFocused(false)
  }

  const addExercise = async (ex: Exercise) => {
    // Get values from the last exercise to auto-fill
    const lastExercise = day.workout_exercises[day.workout_exercises.length - 1]
    const defaultSets = lastExercise?.sets ?? '3'
    const defaultReps = lastExercise?.reps ?? '10'
    const defaultRpe = lastExercise?.rpe ?? null
    const defaultRest = lastExercise?.rest_seconds ?? null
    const defaultWeight = lastExercise?.weight ?? null

    // Use max sort_order + 1 to ensure correct ordering even if exercises were deleted
    const maxSortOrder = day.workout_exercises.reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)
    const newSortOrder = maxSortOrder + 1

    const { data, error } = await supabase.from('workout_exercises')
      .insert({
        day_id: day.id,
        exercise_id: ex.id,
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
      return
    }
    if (data) onUpdate({ ...day, workout_exercises: [...day.workout_exercises, data] })
    setSearch('')
    setFocused(false)
  }

  // Debounce timers for auto-save
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const saveEx = useCallback(async (id: string, field: string, value: unknown) => {
    console.log('Saving to DB:', { id, field, value })
    const { error } = await supabase.from('workout_exercises').update({ [field]: value }).eq('id', id)
    if (error) {
      console.error('Error saving exercise field:', field, error)
    } else {
      console.log('Saved successfully:', field, value)
    }
  }, [supabase])

  const updateEx = useCallback((id: string, field: string, value: unknown) => {
    // Update local state immediately
    onUpdate({ ...day, workout_exercises: day.workout_exercises.map(e => e.id === id ? { ...e, [field]: value } : e) })

    // Debounced save to database (500ms delay)
    const timerKey = `${id}-${field}`
    if (saveTimers.current[timerKey]) {
      clearTimeout(saveTimers.current[timerKey])
    }
    saveTimers.current[timerKey] = setTimeout(() => {
      saveEx(id, field, value)
      delete saveTimers.current[timerKey]
    }, 500)
  }, [day, onUpdate, saveEx])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout)
    }
  }, [])

  const deleteEx = async (id: string) => {
    if (!confirm('Delete this exercise?')) return
    await supabase.from('workout_exercises').delete().eq('id', id)
    onUpdate({ ...day, workout_exercises: day.workout_exercises.filter(e => e.id !== id) })
    setMenuRowId(null)
  }

  const moveEx = async (id: string, direction: 'up' | 'down') => {
    const idx = day.workout_exercises.findIndex(e => e.id === id)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === day.workout_exercises.length - 1) return

    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    const newExercises = [...day.workout_exercises]
    const [moved] = newExercises.splice(idx, 1)
    newExercises.splice(newIdx, 0, moved)

    // Update sort_order in DB
    const updates = newExercises.map((e, i) =>
      supabase.from('workout_exercises').update({ sort_order: i }).eq('id', e.id)
    )
    await Promise.all(updates)

    onUpdate({ ...day, workout_exercises: newExercises })
  }

  const addEmptyRow = () => {
    setShowAddRow(true)
  }

  const handleDragStart = (id: string) => {
    setDraggedId(id)
    onGlobalDragStart(id, day.id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) {
      setDragOverId(id)
    }
  }

  const handleDragEnd = async () => {
    // Handle within-day reordering
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      const fromIdx = day.workout_exercises.findIndex(e => e.id === draggedId)
      const toIdx = day.workout_exercises.findIndex(e => e.id === dragOverId)

      if (fromIdx !== -1 && toIdx !== -1) {
        const newExercises = [...day.workout_exercises]
        const [moved] = newExercises.splice(fromIdx, 1)
        newExercises.splice(toIdx, 0, moved)

        // Update sort_order in DB
        const updates = newExercises.map((e, i) =>
          supabase.from('workout_exercises').update({ sort_order: i }).eq('id', e.id)
        )
        await Promise.all(updates)
        onUpdate({ ...day, workout_exercises: newExercises })
      }
    }
    setDraggedId(null)
    setDragOverId(null)
    onGlobalDragEnd()
  }

  // Handle drops from other days
  const handleCardDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Only accept if dragging from a different day
    if (globalDragExercise && globalDragExercise.fromDayId !== day.id) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleCardDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (globalDragExercise && globalDragExercise.fromDayId !== day.id) {
      onDropFromOtherDay(globalDragExercise.exerciseId, globalDragExercise.fromDayId, day.id)
    }
  }

  // Group exercises by label prefix (A, B, C, etc.)
  const getGroupLetter = (label: string | null) => {
    if (!label) return null
    const match = label.match(/^([A-Z])\d*$/i)
    return match ? match[1].toUpperCase() : null
  }

  const groupExercise = async (id: string) => {
    const exercise = day.workout_exercises.find(e => e.id === id)
    if (!exercise) return

    // Find the next available group letter
    const usedLetters = new Set(
      day.workout_exercises
        .map(e => getGroupLetter(e.label))
        .filter(Boolean)
    )

    let newLetter = 'A'
    if (exercise.label) {
      // Already grouped, increment the number in group
      const currentLetter = getGroupLetter(exercise.label)
      if (currentLetter) {
        // Just update to next number in same group
        return
      }
    }

    // Find next available letter
    while (usedLetters.has(newLetter) && newLetter <= 'Z') {
      newLetter = String.fromCharCode(newLetter.charCodeAt(0) + 1)
    }

    const newLabel = `${newLetter}1`
    await supabase.from('workout_exercises').update({ label: newLabel }).eq('id', id)
    onUpdate({ ...day, workout_exercises: day.workout_exercises.map(e => e.id === id ? { ...e, label: newLabel } : e) })
    setMenuRowId(null)
    setMenuPosition(null)
  }

  const addToGroup = async (id: string, groupLetter: string) => {
    const groupExercises = day.workout_exercises.filter(
      e => getGroupLetter(e.label) === groupLetter
    )
    const nextNum = groupExercises.length + 1
    const newLabel = `${groupLetter}${nextNum}`

    await supabase.from('workout_exercises').update({ label: newLabel }).eq('id', id)
    onUpdate({ ...day, workout_exercises: day.workout_exercises.map(e => e.id === id ? { ...e, label: newLabel } : e) })
    setMenuRowId(null)
    setMenuPosition(null)
  }

  const ungroupExercise = async (id: string) => {
    await supabase.from('workout_exercises').update({ label: null }).eq('id', id)
    onUpdate({ ...day, workout_exercises: day.workout_exercises.map(e => e.id === id ? { ...e, label: null } : e) })
    setMenuRowId(null)
    setMenuPosition(null)
  }

  // Get unique group letters for the "Add to group" submenu
  const existingGroups = [...new Set(
    day.workout_exercises
      .map(e => getGroupLetter(e.label))
      .filter(Boolean)
  )] as string[]

  const filtered = search ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : []
  const filteredBlocks = search ? blocks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).slice(0, 4) : []

  // Check if exercise is first or last in its group for border styling
  const isLastInGroup = (exercise: typeof day.workout_exercises[0], index: number) => {
    const currentGroup = getGroupLetter(exercise.label)
    if (!currentGroup) return true
    const nextExercise = day.workout_exercises[index + 1]
    if (!nextExercise) return true
    return getGroupLetter(nextExercise.label) !== currentGroup
  }

  const toggleRestDay = async () => {
    const newValue = !day.is_rest_day
    onUpdate({ ...day, is_rest_day: newValue })
    await supabase.from('workout_days').update({ is_rest_day: newValue }).eq('id', day.id)
  }

  // Check if this card should show drop indicator
  const isDropTarget = globalDragExercise && globalDragExercise.fromDayId !== day.id

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-lg border shadow-sm overflow-hidden transition-all ${day.is_rest_day ? 'border-emerald-200 dark:border-emerald-800' : isDropTarget ? 'border-purple-400 border-2 ring-2 ring-purple-200 dark:ring-purple-800' : 'border-slate-200 dark:border-slate-800'}`}
      style={{ width: '100%' }}
      onDragOver={handleCardDragOver}
      onDrop={handleCardDrop}
    >
      {/* Card Header */}
      <div className={`px-3 py-2 border-b flex items-center justify-between ${day.is_rest_day ? 'border-emerald-100 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-slate-100 dark:border-slate-800'}`}>
        <div>
          <input
            value={day.name}
            onChange={e => onUpdate({ ...day, name: e.target.value })}
            onBlur={e => supabase.from('workout_days').update({ name: e.target.value }).eq('id', day.id)}
            className="text-sm font-semibold bg-transparent border-b border-dashed border-transparent hover:border-slate-300 focus:border-purple-400 focus:outline-none text-slate-900 dark:text-white"
          />
          <div className="text-xs text-slate-400">Day {day.day_number}</div>
        </div>
        <div className="flex items-center gap-1">
          {/* Rest Day Toggle */}
          <button
            onClick={toggleRestDay}
            className={`px-2 py-1 text-xs rounded-full transition-colors ${day.is_rest_day ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
            title={day.is_rest_day ? 'Click to make workout day' : 'Click to make rest day'}
          >
            {day.is_rest_day ? 'Rest Day' : 'Rest'}
          </button>
          <button onClick={onCopy} className={`p-1.5 rounded transition-colors ${isCopied ? 'text-purple-600 bg-purple-100 dark:bg-purple-500/20' : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10'}`} title={isCopied ? 'Copied!' : 'Copy Day'}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
          <button onClick={onDelete} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Delete Day">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* Rest Day View */}
      {day.is_rest_day ? (
        <div className="px-4 py-8 text-center">
          <div className="text-3xl mb-2">😴</div>
          <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Rest Day</div>
          <input
            value={day.rest_day_notes || ''}
            onChange={e => onUpdate({ ...day, rest_day_notes: e.target.value })}
            onBlur={e => supabase.from('workout_days').update({ rest_day_notes: e.target.value }).eq('id', day.id)}
            placeholder="Add rest day notes (recovery tips, stretching, etc.)"
            className="mt-3 w-full text-center text-xs bg-transparent focus:outline-none text-slate-400 placeholder-slate-300"
          />
        </div>
      ) : (
      <>
      {/* Workout Sections */}
      <WorkoutSection
        section="warmup"
        day={day}
        exercises={exercises}
        blocks={blocks}
        templates={templates}
        settings={settings}
        onUpdate={onUpdate}
        supabase={supabase}
        onSaveAsBlock={onSaveAsBlock}
      />
      <WorkoutSection
        section="strength"
        day={day}
        exercises={exercises}
        blocks={blocks}
        templates={templates}
        settings={settings}
        onUpdate={onUpdate}
        supabase={supabase}
        onSaveAsBlock={onSaveAsBlock}
      />
      <WorkoutSection
        section="cooldown"
        day={day}
        exercises={exercises}
        blocks={blocks}
        templates={templates}
        settings={settings}
        onUpdate={onUpdate}
        supabase={supabase}
        onSaveAsBlock={onSaveAsBlock}
      />

      {/* Cardio Notes Section */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">Cardio</span>
        </div>
        <textarea
          value={day.cardio_notes || ''}
          onChange={e => onUpdate({ ...day, cardio_notes: e.target.value })}
          onBlur={e => supabase.from('workout_days').update({ cardio_notes: e.target.value }).eq('id', day.id)}
          placeholder="e.g., 30 min Zone 2 run, 20 min HIIT (30s on/30s off), 15 min incline walk..."
          className="w-full text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 focus:outline-none focus:border-orange-400 text-slate-600 dark:text-slate-300 placeholder-slate-400 resize-none"
          rows={2}
        />
      </div>
      </>
      )}

      {/* Card Footer - Notes */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
        <input
          placeholder="Type to add workout notes..."
          className="w-full text-xs bg-transparent focus:outline-none text-slate-400 placeholder-slate-300"
        />
      </div>
    </div>
  )
}
