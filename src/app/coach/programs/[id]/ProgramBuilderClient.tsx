'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import type { Program, WorkoutDay, Exercise, ExerciseBlock, RoutineTemplate } from './types'
import { parseRestInput, formatRestTime } from './utils/parseRest'
import { WorkoutCard } from './components/WorkoutCard'

// Lazy load ProgramPDFExport since it uses html2pdf.js (6.9MB)
const ProgramPDFExport = dynamic(
  () => import('./components/ProgramPDFExport').then(mod => ({ default: mod.ProgramPDFExport })),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-slate-900 rounded-xl p-8 flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-slate-400">Loading PDF export...</span>
        </div>
      </div>
    ),
    ssr: false
  }
)

// Lazy load VolumeAnalysis since it includes recharts (7.7MB)
const VolumeAnalysis = dynamic(
  () => import('./components/VolumeAnalysis').then(mod => ({ default: mod.VolumeAnalysis })),
  {
    loading: () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-slate-900 rounded-xl p-8 flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-slate-400">Loading analysis...</span>
        </div>
      </div>
    ),
    ssr: false
  }
)

interface Props {
  program: Program
  exercises: Exercise[]
  templates: RoutineTemplate[]
}

interface ProgramSettings {
  weightUnit: 'lbs' | 'kg'
  effortUnit: 'rpe' | 'rir'
  showWeight: boolean
  showEffort: boolean
  showRest: boolean
  showNotes: boolean
}

// Modal state for saving blocks (lifted to parent to render outside scroll container)
interface SaveBlockModalState {
  show: boolean
  exerciseId: string | null
  exerciseName: string
  dayExercises: WorkoutDay['workout_exercises']
}

export function ProgramBuilderClient({ program: initialProgram, exercises, templates }: Props) {
  const [program, setProgram] = useState(initialProgram)
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<ProgramSettings>({
    weightUnit: 'lbs',
    effortUnit: 'rpe',
    showWeight: true,
    showEffort: true,
    showRest: true,
    showNotes: true,
  })
  const [saveBlockModal, setSaveBlockModal] = useState<SaveBlockModalState>({
    show: false,
    exerciseId: null,
    exerciseName: '',
    dayExercises: [],
  })
  const [blockName, setBlockName] = useState('')
  const [savingBlock, setSavingBlock] = useState(false)
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([])
  const [copiedDay, setCopiedDay] = useState<WorkoutDay | null>(null)
  const [showBlocks, setShowBlocks] = useState(false)
  const [showPDFExport, setShowPDFExport] = useState(false)
  const [showVolumeAnalysis, setShowVolumeAnalysis] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingBlockName, setEditingBlockName] = useState('')
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null)
  const [blockExerciseSearch, setBlockExerciseSearch] = useState('')
  const [addingToBlockId, setAddingToBlockId] = useState<string | null>(null)
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null)
  // Global drag state for cross-day exercise dragging
  const [globalDragExercise, setGlobalDragExercise] = useState<{ exerciseId: string; fromDayId: string } | null>(null)
  const supabase = createClient()

  // Load blocks on mount
  React.useEffect(() => {
    const loadBlocks = async () => {
      const { data } = await supabase
        .from('exercise_blocks')
        .select(`*, exercise_block_items(*, exercise:exercises(*))`)
        .order('name')
      if (data) setBlocks(data)
    }
    loadBlocks()
  }, [supabase])

  const openSaveBlockModal = (exerciseId: string, exerciseName: string, dayExercises: WorkoutDay['workout_exercises']) => {
    setSaveBlockModal({ show: true, exerciseId, exerciseName, dayExercises })
    setBlockName(exerciseName)
  }

  const closeSaveBlockModal = () => {
    setSaveBlockModal({ show: false, exerciseId: null, exerciseName: '', dayExercises: [] })
    setBlockName('')
  }

  const saveAsBlock = async () => {
    if (!blockName.trim() || !saveBlockModal.exerciseId) return
    setSavingBlock(true)

    const exercise = saveBlockModal.dayExercises.find(e => e.id === saveBlockModal.exerciseId)
    if (!exercise) {
      setSavingBlock(false)
      return
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('You must be logged in to save blocks')
      setSavingBlock(false)
      return
    }

    // Get all exercises in the same group (if grouped)
    const groupLetter = exercise.label ? exercise.label.match(/^([A-Z])/i)?.[1] : null
    const exercisesToSave = groupLetter
      ? saveBlockModal.dayExercises.filter(e => e.label?.startsWith(groupLetter))
      : [exercise]

    try {
      // Create the block
      const { data: block, error: blockError } = await supabase
        .from('exercise_blocks')
        .insert({ name: blockName.trim(), created_by: user.id })
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

      // Reload blocks
      const { data: updatedBlocks } = await supabase
        .from('exercise_blocks')
        .select(`*, exercise_block_items(*, exercise:exercises(*))`)
        .order('name')
      if (updatedBlocks) setBlocks(updatedBlocks)

      closeSaveBlockModal()
    } catch (err) {
      console.error('Error saving block:', err)
      alert('Error saving block')
    } finally {
      setSavingBlock(false)
    }
  }

  const deleteBlock = async (blockId: string) => {
    if (!confirm('Delete this saved block?')) return
    try {
      await supabase.from('exercise_blocks').delete().eq('id', blockId)
      setBlocks(blocks.filter(b => b.id !== blockId))
    } catch (err) {
      console.error('Error deleting block:', err)
      alert('Error deleting block')
    }
  }

  const updateBlockName = async (blockId: string, newName: string) => {
    if (!newName.trim()) return
    try {
      await supabase.from('exercise_blocks').update({ name: newName.trim() }).eq('id', blockId)
      setBlocks(blocks.map(b => b.id === blockId ? { ...b, name: newName.trim() } : b))
      setEditingBlockId(null)
      setEditingBlockName('')
    } catch (err) {
      console.error('Error updating block:', err)
      alert('Error updating block name')
    }
  }

  const updateBlockItem = async (blockId: string, itemId: string, field: string, value: string | number | null) => {
    try {
      await supabase.from('exercise_block_items').update({ [field]: value }).eq('id', itemId)
      setBlocks(blocks.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: b.exercise_block_items?.map(item =>
            item.id === itemId ? { ...item, [field]: value } : item
          )
        }
      }))
    } catch (err) {
      console.error('Error updating block item:', err)
    }
  }

  const deleteBlockItem = async (blockId: string, itemId: string) => {
    try {
      await supabase.from('exercise_block_items').delete().eq('id', itemId)
      setBlocks(blocks.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: b.exercise_block_items?.filter(item => item.id !== itemId)
        }
      }))
    } catch (err) {
      console.error('Error deleting block item:', err)
      alert('Error removing exercise from block')
    }
  }

  const addExerciseToBlock = async (blockId: string, exercise: Exercise) => {
    try {
      const block = blocks.find(b => b.id === blockId)
      const sortOrder = (block?.exercise_block_items?.length || 0)

      const { data, error } = await supabase
        .from('exercise_block_items')
        .insert({
          block_id: blockId,
          exercise_id: exercise.id,
          sets: '3',
          reps: '10',
          sort_order: sortOrder,
        })
        .select(`*, exercise:exercises(*)`)
        .single()

      if (error) throw error

      setBlocks(blocks.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: [...(b.exercise_block_items || []), data]
        }
      }))
      setBlockExerciseSearch('')
      setAddingToBlockId(null)
    } catch (err) {
      console.error('Error adding exercise to block:', err)
      alert('Error adding exercise to block')
    }
  }

  const replaceBlockExercise = async (blockId: string, itemId: string, newExercise: Exercise) => {
    try {
      await supabase
        .from('exercise_block_items')
        .update({ exercise_id: newExercise.id })
        .eq('id', itemId)

      setBlocks(blocks.map(b => {
        if (b.id !== blockId) return b
        return {
          ...b,
          exercise_block_items: b.exercise_block_items?.map(item =>
            item.id === itemId ? { ...item, exercise_id: newExercise.id, exercise: newExercise } : item
          )
        }
      }))
      setBlockExerciseSearch('')
      setReplacingItemId(null)
    } catch (err) {
      console.error('Error replacing exercise:', err)
      alert('Error replacing exercise')
    }
  }

  const save = async (table: string, id: string, data: Record<string, unknown>) => {
    setSaving(true)
    await supabase.from(table).update(data).eq('id', id)
    setSaving(false)
  }

  const addWeek = async () => {
    const num = program.program_weeks.length + 1
    const { data } = await supabase.from('program_weeks').insert({ program_id: program.id, week_number: num }).select().single()
    if (data) {
      setProgram(p => ({ ...p, program_weeks: [...p.program_weeks, { ...data, workout_days: [] }] }))
    }
  }

  // Renumber days in a week to be sequential (1, 2, 3...)
  const renumberDays = async (weekId: string, weekIndex: number) => {
    const week = program.program_weeks[weekIndex]
    if (!week) return

    const sortedDays = [...week.workout_days].sort((a, b) => a.day_number - b.day_number)

    // Update each day's number in DB and local state
    const updates = sortedDays.map((day, index) => {
      const newNum = index + 1
      if (day.day_number !== newNum) {
        return supabase.from('workout_days').update({ day_number: newNum }).eq('id', day.id)
      }
      return null
    }).filter(Boolean)

    if (updates.length > 0) {
      await Promise.all(updates)

      // Update local state with new numbers
      setProgram(p => ({
        ...p,
        program_weeks: p.program_weeks.map((w, i) => {
          if (i !== weekIndex) return w
          const sorted = [...w.workout_days].sort((a, b) => a.day_number - b.day_number)
          return {
            ...w,
            workout_days: sorted.map((day, idx) => ({ ...day, day_number: idx + 1 }))
          }
        })
      }))
    }
  }

  // Move exercise from one day to another
  const moveExerciseToDifferentDay = async (exerciseId: string, fromDayId: string, toDayId: string) => {
    if (fromDayId === toDayId) return
    setSaving(true)

    // Find the exercise data
    let exerciseData: WorkoutDay['workout_exercises'][0] | null = null
    let fromWeekIndex = -1
    let fromDayIndex = -1

    for (let wi = 0; wi < program.program_weeks.length; wi++) {
      for (let di = 0; di < program.program_weeks[wi].workout_days.length; di++) {
        const day = program.program_weeks[wi].workout_days[di]
        if (day.id === fromDayId) {
          fromWeekIndex = wi
          fromDayIndex = di
          exerciseData = day.workout_exercises.find(e => e.id === exerciseId) || null
          break
        }
      }
      if (exerciseData) break
    }

    if (!exerciseData) {
      setSaving(false)
      return
    }

    // Find target day info
    let toWeekIndex = -1
    let toDayIndex = -1
    let targetDayExerciseCount = 0

    for (let wi = 0; wi < program.program_weeks.length; wi++) {
      for (let di = 0; di < program.program_weeks[wi].workout_days.length; di++) {
        const day = program.program_weeks[wi].workout_days[di]
        if (day.id === toDayId) {
          toWeekIndex = wi
          toDayIndex = di
          targetDayExerciseCount = day.workout_exercises.length
          break
        }
      }
      if (toWeekIndex !== -1) break
    }

    if (toWeekIndex === -1) {
      setSaving(false)
      return
    }

    // Update database: change day_id and sort_order
    console.log('Moving exercise:', { exerciseId, fromDayId, toDayId, targetDayExerciseCount })

    const result = await supabase
      .from('workout_exercises')
      .update({ day_id: toDayId, sort_order: targetDayExerciseCount })
      .eq('id', exerciseId)
      .select()

    console.log('Move result full:', result)
    console.log('Move data:', result.data)
    console.log('Move error:', result.error)
    console.log('Move status:', result.status)
    console.log('Move statusText:', result.statusText)

    if (result.error) {
      console.error('Error moving exercise - full error object:', result.error)
      console.error('Error code:', result.error.code)
      console.error('Error message:', result.error.message)
      console.error('Error details:', result.error.details)
      console.error('Error hint:', result.error.hint)
      alert('Error moving exercise: ' + (result.error.message || result.error.code || 'Unknown error'))
      setSaving(false)
      return
    }

    // Also check for RLS issues - no rows returned might mean RLS blocked the update
    if (result.data && result.data.length === 0 && result.status === 200) {
      console.log('Update returned no rows - possible RLS issue or exercise not found')
    }

    if (!result.data || result.data.length === 0) {
      console.log('Update succeeded but no rows returned - this is fine')
    }

    // Update local state
    setProgram(p => ({
      ...p,
      program_weeks: p.program_weeks.map((week, wi) => ({
        ...week,
        workout_days: week.workout_days.map((day, di) => {
          // Remove from source day
          if (day.id === fromDayId) {
            return {
              ...day,
              workout_exercises: day.workout_exercises.filter(e => e.id !== exerciseId)
            }
          }
          // Add to target day
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
  }

  const addDay = async (weekId: string, weekIndex: number) => {
    const week = program.program_weeks[weekIndex]
    // Find the max day_number to avoid unique constraint violation
    const maxDayNum = week?.workout_days.reduce((max, d) => Math.max(max, d.day_number), 0) || 0
    const num = maxDayNum + 1
    const { data, error } = await supabase.from('workout_days').insert({ week_id: weekId, day_number: num, name: `Workout ${num}` }).select().single()
    if (error) { alert(error.message); return }
    if (data) {
      setProgram(p => ({
        ...p,
        program_weeks: p.program_weeks.map((w, i) => i === weekIndex ? { ...w, workout_days: [...w.workout_days, { ...data, workout_exercises: [] }] } : w)
      }))
    }
  }

  const deleteDay = async (dayId: string) => {
    if (!confirm('Delete this workout?')) return

    // Find which week this day belongs to
    let weekId: string | null = null
    let weekIndex = -1
    for (let i = 0; i < program.program_weeks.length; i++) {
      const day = program.program_weeks[i].workout_days.find(d => d.id === dayId)
      if (day) {
        weekId = program.program_weeks[i].id
        weekIndex = i
        break
      }
    }

    await supabase.from('workout_days').delete().eq('id', dayId)
    setProgram(p => ({
      ...p,
      program_weeks: p.program_weeks.map(w => ({ ...w, workout_days: w.workout_days.filter(d => d.id !== dayId) }))
    }))

    // Renumber remaining days in that week
    if (weekId && weekIndex >= 0) {
      // Small delay to ensure state is updated
      setTimeout(() => renumberDays(weekId!, weekIndex), 100)
    }
  }

  const copyDayToClipboard = (day: WorkoutDay) => {
    setCopiedDay(day)
  }

  const pasteDay = async (targetWeekId: string, targetWeekIndex: number) => {
    if (!copiedDay) return

    setSaving(true)
    try {
      // Get the max day_number from the database to avoid unique constraint violation
      const { data: maxDayData } = await supabase
        .from('workout_days')
        .select('day_number')
        .eq('week_id', targetWeekId)
        .order('day_number', { ascending: false })
        .limit(1)
        .single()

      const nextDayNum = (maxDayData?.day_number || 0) + 1

      // Create new day
      const { data: newDay, error: dayError } = await supabase
        .from('workout_days')
        .insert({
          week_id: targetWeekId,
          day_number: nextDayNum,
          name: copiedDay.name,
          subtitle: copiedDay.subtitle,
          is_rest_day: copiedDay.is_rest_day,
          rest_day_notes: copiedDay.rest_day_notes,
        })
        .select()
        .single()

      if (dayError) throw dayError

      // Copy all exercises
      const newExercises: Array<typeof copiedDay.workout_exercises[0]> = []
      for (const exercise of copiedDay.workout_exercises) {
        const { data: newExercise, error: exError } = await supabase
          .from('workout_exercises')
          .insert({
            day_id: newDay.id,
            exercise_id: exercise.exercise_id,
            section: exercise.section,
            label: exercise.label,
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            rest_seconds: exercise.rest_seconds,
            rpe: exercise.rpe,
            notes: exercise.notes,
            sort_order: exercise.sort_order,
          })
          .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
          .single()

        if (exError) throw exError
        if (newExercise) newExercises.push(newExercise)
      }

      // Update local state
      setProgram(p => ({
        ...p,
        program_weeks: p.program_weeks.map((w, i) =>
          i === targetWeekIndex
            ? { ...w, workout_days: [...w.workout_days, { ...newDay, workout_exercises: newExercises }] }
            : w
        ),
      }))

      // Renumber days to be sequential
      setTimeout(() => renumberDays(targetWeekId, targetWeekIndex), 100)
    } catch (err) {
      console.error('Error pasting day:', err)
      alert('Error pasting workout day')
    } finally {
      setSaving(false)
    }
  }

  const deleteWeek = async (weekId: string) => {
    if (!confirm('Delete this entire week and all its workouts?')) return
    setSaving(true)
    try {
      await supabase.from('program_weeks').delete().eq('id', weekId)
      setProgram(p => ({
        ...p,
        program_weeks: p.program_weeks.filter(w => w.id !== weekId),
      }))
    } catch (err) {
      console.error('Error deleting week:', err)
      alert('Error deleting week')
    } finally {
      setSaving(false)
    }
  }

  const copyWeek = async (weekIndex: number) => {
    setSaving(true)
    try {
      const weekToCopy = program.program_weeks[weekIndex]
      const newWeekNum = program.program_weeks.length + 1

      // Create new week
      const { data: newWeek, error: weekError } = await supabase
        .from('program_weeks')
        .insert({
          program_id: program.id,
          week_number: newWeekNum,
          name: weekToCopy.name,
        })
        .select()
        .single()

      if (weekError) throw weekError

      const newDays: WorkoutDay[] = []

      // Copy each day
      for (const day of weekToCopy.workout_days) {
        const { data: newDay, error: dayError } = await supabase
          .from('workout_days')
          .insert({
            week_id: newWeek.id,
            day_number: day.day_number,
            name: day.name,
            subtitle: day.subtitle,
            is_rest_day: day.is_rest_day,
            rest_day_notes: day.rest_day_notes,
          })
          .select()
          .single()

        if (dayError) throw dayError

        // Copy all exercises for this day
        const newExercises = []
        for (const exercise of day.workout_exercises) {
          const { data: newExercise, error: exError } = await supabase
            .from('workout_exercises')
            .insert({
              day_id: newDay.id,
              exercise_id: exercise.exercise_id,
              section: exercise.section,
              label: exercise.label,
              sets: exercise.sets,
              reps: exercise.reps,
              weight: exercise.weight,
              rest_seconds: exercise.rest_seconds,
              rpe: exercise.rpe,
              notes: exercise.notes,
              sort_order: exercise.sort_order,
            })
            .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
            .single()

          if (exError) throw exError
          if (newExercise) newExercises.push(newExercise)
        }

        newDays.push({ ...newDay, workout_exercises: newExercises })
      }

      // Update local state
      setProgram(p => ({
        ...p,
        program_weeks: [...p.program_weeks, { ...newWeek, workout_days: newDays }],
      }))
    } catch (err) {
      console.error('Error copying week:', err)
      alert('Error copying week')
    } finally {
      setSaving(false)
    }
  }

  const updateDay = useCallback((day: WorkoutDay) => {
    setProgram(p => ({
      ...p,
      program_weeks: p.program_weeks.map(w => ({ ...w, workout_days: w.workout_days.map(d => d.id === day.id ? day : d) }))
    }))
  }, [])

  return (
    <>
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 bg-white dark:bg-slate-900 px-4 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/coach/programs" className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <input
            value={program.name}
            onChange={e => setProgram(p => ({ ...p, name: e.target.value }))}
            onBlur={e => save('programs', program.id, { name: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none focus:outline-none text-slate-900 dark:text-white"
          />
          <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
            {program.type}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {saving ? (
            <span className="text-purple-500 text-xs flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            <span className="text-emerald-500 text-xs flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={() => setShowVolumeAnalysis(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
            title="Volume Analysis"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button
            onClick={() => setShowPDFExport(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
            title="Export PDF"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button
            onClick={() => setShowBlocks(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
            title="Saved Blocks"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
            title="Program Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Settings Slide-out Panel */}
      {showSettings && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setShowSettings(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-80 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-y-auto">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Difficulty */}
              <div>
                <label className="font-medium text-slate-900 dark:text-white mb-2 block">Difficulty</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={async () => {
                        const newValue = program.difficulty === level ? null : level
                        setProgram(p => ({ ...p, difficulty: newValue }))
                        const { error } = await supabase.from('programs').update({ difficulty: newValue }).eq('id', program.id)
                        if (error) console.error('Error saving difficulty:', error)
                      }}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        program.difficulty === level
                          ? level === 'beginner'
                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-500/30'
                            : level === 'intermediate'
                            ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-500/30'
                            : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-300 dark:border-red-500/30'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <label className="font-medium text-slate-900 dark:text-white mb-2 block">Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'general_fitness', label: 'General Fitness' },
                    { value: 'bodybuilding', label: 'Bodybuilding' },
                    { value: 'powerlifting', label: 'Powerlifting' },
                    { value: 'athletic', label: 'Athletic' },
                    { value: 'strongman', label: 'Strongman' },
                    { value: 'calisthenics', label: 'Calisthenics' },
                    { value: 'sport_specific', label: 'Sport Specific' },
                    { value: 'rehab_prehab', label: 'Rehab/Prehab' },
                    { value: 'hybrid', label: 'Hybrid' },
                  ] as const).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={async () => {
                        const newValue = program.style === value ? null : value
                        setProgram(p => ({ ...p, style: newValue }))
                        const { error } = await supabase.from('programs').update({ style: newValue }).eq('id', program.id)
                        if (error) console.error('Error saving style:', error)
                      }}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                        program.style === value
                          ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/30'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Injury-Friendly */}
              <div>
                <label className="font-medium text-slate-900 dark:text-white mb-2 block">Injury-Friendly</label>
                <p className="text-xs text-slate-500 mb-2">Safe for clients with these limitations</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'knees', label: 'Knees' },
                    { value: 'shoulders', label: 'Shoulders' },
                    { value: 'lower_back', label: 'Lower Back' },
                    { value: 'hips', label: 'Hips' },
                    { value: 'wrists', label: 'Wrists' },
                    { value: 'ankles', label: 'Ankles' },
                    { value: 'neck', label: 'Neck' },
                  ]).map(({ value, label }) => {
                    const isSelected = program.injury_friendly?.includes(value)
                    return (
                      <button
                        key={value}
                        onClick={async () => {
                          const current = program.injury_friendly || []
                          const newValue = isSelected
                            ? current.filter(v => v !== value)
                            : [...current, value]
                          setProgram(p => ({ ...p, injury_friendly: newValue }))
                          const { error } = await supabase.from('programs').update({ injury_friendly: newValue }).eq('id', program.id)
                          if (error) console.error('Error saving injury_friendly:', error)
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-all ${
                          isSelected
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <label className="font-medium text-slate-900 dark:text-white mb-3 block">Display Settings</label>
              </div>

              {/* Weight Unit */}
              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300">Weight unit</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="weightUnit"
                      checked={settings.weightUnit === 'lbs'}
                      onChange={() => setSettings(s => ({ ...s, weightUnit: 'lbs' }))}
                      className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Pounds (lbs)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="weightUnit"
                      checked={settings.weightUnit === 'kg'}
                      onChange={() => setSettings(s => ({ ...s, weightUnit: 'kg' }))}
                      className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Kilograms (kg)</span>
                  </label>
                </div>
              </div>

              {/* Effort Unit */}
              <div>
                <label className="font-medium text-slate-900 dark:text-white">Effort unit</label>
                <div className="space-y-2 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="effortUnit"
                      checked={settings.effortUnit === 'rpe'}
                      onChange={() => setSettings(s => ({ ...s, effortUnit: 'rpe' }))}
                      className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">RPE (Rate of perceived exertion)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="effortUnit"
                      checked={settings.effortUnit === 'rir'}
                      onChange={() => setSettings(s => ({ ...s, effortUnit: 'rir' }))}
                      className="w-4 h-4 text-purple-600 border-slate-300 focus:ring-purple-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">RIR (Reps in reserve)</span>
                  </label>
                </div>
              </div>

              {/* Show/Hide Columns */}
              <div>
                <label className="font-medium text-slate-900 dark:text-white mb-3 block">Columns</label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 dark:text-slate-300">Weight</span>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showWeight: !s.showWeight }))}
                      className={`w-10 h-6 rounded-full transition-colors ${settings.showWeight ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform mx-1 ${settings.showWeight ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 dark:text-slate-300">Effort ({settings.effortUnit.toUpperCase()})</span>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showEffort: !s.showEffort }))}
                      className={`w-10 h-6 rounded-full transition-colors ${settings.showEffort ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform mx-1 ${settings.showEffort ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700 dark:text-slate-300">Rest</span>
                    <button
                      onClick={() => setSettings(s => ({ ...s, showRest: !s.showRest }))}
                      className={`w-10 h-6 rounded-full transition-colors ${settings.showRest ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform mx-1 ${settings.showRest ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* PDF Export Settings */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <label className="font-medium text-slate-900 dark:text-white mb-3 block">PDF Export Settings</label>

                {/* Weekly Schedule */}
                <div className="mb-4">
                  <label className="text-sm text-slate-600 dark:text-slate-400 mb-2 block">Weekly Schedule</label>
                  <div className="grid grid-cols-7 gap-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => {
                      const schedule = program.pdf_schedule || []
                      const value = schedule[idx] || ''
                      return (
                        <div key={dayName} className="text-center">
                          <div className="text-xs text-slate-500 mb-1">{dayName}</div>
                          <select
                            value={value}
                            onChange={async (e) => {
                              const newSchedule = [...(program.pdf_schedule || Array(7).fill(''))]
                              newSchedule[idx] = e.target.value
                              setProgram(p => ({ ...p, pdf_schedule: newSchedule }))
                              // Auto-save
                              const { error } = await supabase.from('programs').update({ pdf_schedule: newSchedule }).eq('id', program.id)
                              if (error) console.error('Error saving pdf_schedule:', error)
                            }}
                            className="w-full text-xs p-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800"
                          >
                            <option value="">Rest</option>
                            {/* Get unique workout names */}
                            {Array.from(new Set(
                              program.program_weeks.flatMap(w =>
                                w.workout_days.filter(d => !d.is_rest_day).map(d => d.name)
                              )
                            )).map(name => (
                              <option key={name} value={name}>{name.length > 8 ? name.slice(0, 8) + '...' : name}</option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Custom Tips */}
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 mb-2 block">Custom Tips (one per line)</label>
                  <textarea
                    value={(program.pdf_tips || []).join('\n')}
                    onChange={(e) => {
                      // Keep empty lines to allow typing new lines
                      const tips = e.target.value.split('\n')
                      setProgram(p => ({ ...p, pdf_tips: tips }))
                    }}
                    onBlur={async (e) => {
                      // On blur, clean up empty lines and save
                      const tips = e.target.value.split('\n').filter(t => t.trim())
                      setProgram(p => ({ ...p, pdf_tips: tips.length > 0 ? tips : null }))
                      const { error } = await supabase.from('programs').update({ pdf_tips: tips.length > 0 ? tips : null }).eq('id', program.id)
                      if (error) console.error('Error saving pdf_tips:', error)
                    }}
                    placeholder={"Rest 60-90 seconds between sets\nFocus on controlled movements\nTrack your weights weekly"}
                    className="w-full text-sm p-2 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 h-24 resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Saved Blocks Slide-out Panel */}
      {showBlocks && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => { setShowBlocks(false); setEditingBlockId(null) }}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-y-auto overflow-x-visible">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Saved Blocks</h2>
              <button
                onClick={() => { setShowBlocks(false); setEditingBlockId(null) }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {blocks.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm">No saved blocks yet</p>
                  <p className="text-xs mt-1">Right-click on an exercise and select "Save as block"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {blocks.map(block => (
                    <div key={block.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      {/* Block Header */}
                      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                        {editingBlockId === block.id ? (
                          <input
                            value={editingBlockName}
                            onChange={e => setEditingBlockName(e.target.value)}
                            onBlur={() => updateBlockName(block.id, editingBlockName)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') updateBlockName(block.id, editingBlockName)
                              if (e.key === 'Escape') { setEditingBlockId(null); setEditingBlockName('') }
                            }}
                            className="flex-1 px-2 py-1 text-sm font-medium bg-white dark:bg-slate-800 border border-purple-400 rounded focus:outline-none text-slate-900 dark:text-white"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{block.name}</span>
                        )}
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => {
                              setEditingBlockId(block.id)
                              setEditingBlockName(block.name)
                            }}
                            className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded transition-colors"
                            title="Edit name"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteBlock(block.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                            title="Delete block"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setExpandedBlockId(expandedBlockId === block.id ? null : block.id)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title={expandedBlockId === block.id ? 'Collapse' : 'Edit exercises'}
                          >
                            <svg className={`w-4 h-4 transition-transform ${expandedBlockId === block.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Block Exercises - Collapsed View */}
                      {expandedBlockId !== block.id && (
                        <div className="px-3 py-2">
                          {block.exercise_block_items && block.exercise_block_items.length > 0 ? (
                            <div className="space-y-1">
                              {block.exercise_block_items.map((item, idx) => (
                                <div key={item.id} className="flex items-center gap-2 text-xs">
                                  <span className={`w-5 text-right ${item.label ? 'text-purple-600 font-medium' : 'text-slate-400'}`}>
                                    {item.label || (idx + 1)}
                                  </span>
                                  <span className="text-slate-700 dark:text-slate-300 truncate flex-1">
                                    {item.exercise?.name || 'Unknown exercise'}
                                  </span>
                                  <span className="text-slate-400">
                                    {item.sets && item.reps ? `${item.sets}×${item.reps}` : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400">No exercises in this block</p>
                          )}
                        </div>
                      )}
                      {/* Block Exercises - Expanded Edit View */}
                      {expandedBlockId === block.id && (
                        <div className="px-3 py-2 bg-slate-50/50 dark:bg-slate-800/30">
                          {/* Compact table-like header */}
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 uppercase tracking-wide mb-1 px-1">
                            <span className="w-6">#</span>
                            <span className="flex-1">Exercise</span>
                            <span className="w-10 text-center">Sets</span>
                            <span className="w-10 text-center">Reps</span>
                            <span className="w-14"></span>
                          </div>
                          {block.exercise_block_items && block.exercise_block_items.length > 0 ? (
                            <div className="space-y-1">
                              {block.exercise_block_items.map((item, idx) => (
                                <div key={item.id}>
                                  {replacingItemId === item.id ? (
                                    <div className="bg-white dark:bg-slate-800 rounded border border-purple-400 p-2">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-slate-500">Replace: {item.exercise?.name}</span>
                                        <button
                                          onClick={() => { setReplacingItemId(null); setBlockExerciseSearch('') }}
                                          className="text-xs text-slate-400 hover:text-slate-600"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                      <input
                                        value={blockExerciseSearch}
                                        onChange={e => setBlockExerciseSearch(e.target.value)}
                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-400"
                                        placeholder="Search exercise..."
                                        autoFocus
                                      />
                                      {blockExerciseSearch && exercises.filter(ex => ex.name.toLowerCase().includes(blockExerciseSearch.toLowerCase())).length > 0 && (
                                        <div className="mt-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 max-h-32 overflow-y-auto">
                                          {exercises.filter(ex => ex.name.toLowerCase().includes(blockExerciseSearch.toLowerCase())).slice(0, 5).map(ex => (
                                            <button
                                              key={ex.id}
                                              onClick={() => replaceBlockExercise(block.id, item.id, ex)}
                                              className="w-full text-left px-2 py-1.5 text-xs hover:bg-purple-50 dark:hover:bg-purple-500/20 text-slate-700 dark:text-slate-300"
                                            >
                                              {ex.name}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 py-1 px-1 rounded hover:bg-white dark:hover:bg-slate-800 group">
                                      <span className={`w-6 text-xs ${item.label ? 'text-purple-600 font-medium' : 'text-slate-400'}`}>
                                        {item.label || (idx + 1)}
                                      </span>
                                      <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 truncate">
                                        {item.exercise?.name || 'Unknown'}
                                      </span>
                                      <input
                                        value={item.sets || ''}
                                        onChange={e => updateBlockItem(block.id, item.id, 'sets', e.target.value)}
                                        className="w-10 text-center text-xs py-0.5 border border-transparent hover:border-slate-300 focus:border-purple-400 rounded bg-transparent focus:bg-white dark:focus:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                                        placeholder="-"
                                      />
                                      <input
                                        value={item.reps || ''}
                                        onChange={e => updateBlockItem(block.id, item.id, 'reps', e.target.value)}
                                        className="w-10 text-center text-xs py-0.5 border border-transparent hover:border-slate-300 focus:border-purple-400 rounded bg-transparent focus:bg-white dark:focus:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                                        placeholder="-"
                                      />
                                      <div className="w-14 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => { setReplacingItemId(item.id); setBlockExerciseSearch('') }}
                                          className="p-1 text-slate-400 hover:text-purple-500 rounded"
                                          title="Replace"
                                        >
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => deleteBlockItem(block.id, item.id)}
                                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                                          title="Remove"
                                        >
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {/* Add Exercise to Block */}
                          {addingToBlockId === block.id ? (
                            <div className="mt-2 bg-white dark:bg-slate-800 rounded border border-purple-400 p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-slate-500">Add exercise</span>
                                <button
                                  onClick={() => { setAddingToBlockId(null); setBlockExerciseSearch('') }}
                                  className="text-xs text-slate-400 hover:text-slate-600"
                                >
                                  Cancel
                                </button>
                              </div>
                              <input
                                value={blockExerciseSearch}
                                onChange={e => setBlockExerciseSearch(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-400"
                                placeholder="Search exercise..."
                                autoFocus
                              />
                              {blockExerciseSearch && exercises.filter(ex => ex.name.toLowerCase().includes(blockExerciseSearch.toLowerCase())).length > 0 && (
                                <div className="mt-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 max-h-32 overflow-y-auto">
                                  {exercises.filter(ex => ex.name.toLowerCase().includes(blockExerciseSearch.toLowerCase())).slice(0, 5).map(ex => (
                                    <button
                                      key={ex.id}
                                      onClick={() => addExerciseToBlock(block.id, ex)}
                                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-purple-50 dark:hover:bg-purple-500/20 text-slate-700 dark:text-slate-300"
                                    >
                                      {ex.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingToBlockId(block.id); setBlockExerciseSearch('') }}
                              className="mt-2 w-full py-2 text-xs text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 transition-colors flex items-center justify-center gap-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add Exercise
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Weeks - Horizontal scroll container */}
      <div className="p-6 flex gap-6 overflow-x-auto items-start min-h-[calc(100vh-48px)]">
        {program.program_weeks.map((week, weekIndex) => (
          <div key={week.id} style={{ width: '500px', minWidth: '500px', maxWidth: '500px' }}>
            {/* Week Header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Week {week.week_number}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => copyWeek(weekIndex)}
                  className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded transition-colors"
                  title="Duplicate Week"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => deleteWeek(week.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                  title="Delete Week"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Days stacked vertically */}
            <div className="space-y-4">
              {week.workout_days.map(day => (
                <WorkoutCard
                  key={day.id}
                  day={day}
                  exercises={exercises}
                  blocks={blocks}
                  templates={templates}
                  onUpdate={updateDay}
                  onDelete={() => deleteDay(day.id)}
                  onCopy={() => copyDayToClipboard(day)}
                  isCopied={copiedDay?.id === day.id}
                  onSaveAsBlock={openSaveBlockModal}
                  supabase={supabase}
                  settings={settings}
                  globalDragExercise={globalDragExercise}
                  onGlobalDragStart={(exId) => setGlobalDragExercise({ exerciseId: exId, fromDayId: day.id })}
                  onGlobalDragEnd={() => setGlobalDragExercise(null)}
                  onDropFromOtherDay={moveExerciseToDifferentDay}
                />
              ))}

              {/* Paste Day Button - only show when there's a copied day */}
              {copiedDay && (
                <button
                  onClick={() => pasteDay(week.id, weekIndex)}
                  className="w-full py-3 border-2 border-dashed border-purple-400 bg-purple-50 dark:bg-purple-500/10 rounded-lg text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-all text-sm font-medium flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Paste "{copiedDay.name}"
                </button>
              )}

              {/* Add Day Button */}
              <button
                onClick={() => addDay(week.id, weekIndex)}
                className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-slate-400 hover:text-purple-600 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all text-sm font-medium"
              >
                + Add Day
              </button>
            </div>
          </div>
        ))}

        {/* Add Week Button */}
        <button
          onClick={addWeek}
          className="w-12 h-12 flex-shrink-0 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 hover:text-purple-600 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 flex items-center justify-center transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
    </div>

    {/* Save Block Modal - rendered outside main container to avoid any overflow clipping */}
    {saveBlockModal.show && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={closeSaveBlockModal}
        />
        <div className="relative w-96 bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Save as Block</h3>
            <p className="text-sm text-slate-500 mt-1">
              {(() => {
                const ex = saveBlockModal.dayExercises.find(e => e.id === saveBlockModal.exerciseId)
                const groupLetter = ex?.label?.match(/^([A-Z])/i)?.[1]
                if (groupLetter) {
                  const count = saveBlockModal.dayExercises.filter(e => e.label?.startsWith(groupLetter)).length
                  return `Save ${count} exercises in group ${groupLetter} as a reusable block`
                }
                return 'Save this exercise as a reusable block'
              })()}
            </p>
          </div>
          <div className="p-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Block name
            </label>
            <input
              value={blockName}
              onChange={e => setBlockName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-slate-900 dark:text-white dark:bg-slate-800"
              placeholder="e.g., Leg Day Warmup, Push Circuit"
              autoFocus
            />
          </div>
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <button
              onClick={closeSaveBlockModal}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={saveAsBlock}
              disabled={!blockName.trim() || savingBlock}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingBlock ? 'Saving...' : 'Save Block'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* PDF Export Modal */}
    {showPDFExport && (
      <ProgramPDFExport
        program={program}
        onClose={() => setShowPDFExport(false)}
      />
    )}

    {/* Volume Analysis Modal */}
    {showVolumeAnalysis && (
      <VolumeAnalysis
        program={program}
        onClose={() => setShowVolumeAnalysis(false)}
      />
    )}
    </>
  )
}
