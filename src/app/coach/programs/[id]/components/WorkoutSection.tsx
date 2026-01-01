'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutDay, WorkoutExercise, Exercise, ExerciseBlock, RoutineTemplate } from '../types'
import { parseRestInput, formatRestTime } from '../utils/parseRest'

type SectionType = 'warmup' | 'strength' | 'cooldown'

interface ProgramSettings {
  weightUnit: 'lbs' | 'kg'
  effortUnit: 'rpe' | 'rir'
  showWeight: boolean
  showEffort: boolean
  showRest: boolean
  showNotes: boolean
}

interface WorkoutSectionProps {
  section: SectionType
  day: WorkoutDay
  exercises: Exercise[]
  blocks: ExerciseBlock[]
  templates: RoutineTemplate[]
  settings: ProgramSettings
  onUpdate: (day: WorkoutDay) => void
  supabase: ReturnType<typeof createClient>
  onSaveAsBlock?: (exerciseId: string, exerciseName: string, dayExercises: WorkoutExercise[]) => void
}

const sectionConfig = {
  warmup: { label: 'Warmup' },
  strength: { label: 'Strength' },
  cooldown: { label: 'Cooldown' },
}

export function WorkoutSection({
  section,
  day,
  exercises,
  blocks,
  templates,
  settings,
  onUpdate,
  supabase,
  onSaveAsBlock,
}: WorkoutSectionProps) {
  const config = sectionConfig[section]
  const sectionExercises = day.workout_exercises.filter(e => e.section === section)

  const [collapsed, setCollapsed] = useState(sectionExercises.length === 0 && section !== 'strength')
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)
  const [menuRowId, setMenuRowId] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Filter templates by section type (warmup templates for warmup section, etc.)
  const sectionTemplates = templates.filter(t =>
    (section === 'warmup' && t.type === 'warmup') ||
    (section === 'cooldown' && t.type === 'cooldown')
  )

  const filteredTemplates = search
    ? sectionTemplates.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).slice(0, 4)
    : []

  const filteredBlocks = search && section === 'strength'
    ? blocks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).slice(0, 4)
    : []

  const filteredExercises = search
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : []

  // Debounce timers for auto-save
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const saveEx = useCallback(async (id: string, field: string, value: unknown) => {
    await supabase.from('workout_exercises').update({ [field]: value }).eq('id', id)
  }, [supabase])

  const updateEx = useCallback((id: string, field: string, value: unknown) => {
    onUpdate({
      ...day,
      workout_exercises: day.workout_exercises.map(e => e.id === id ? { ...e, [field]: value } : e)
    })

    const timerKey = `${id}-${field}`
    if (saveTimers.current[timerKey]) {
      clearTimeout(saveTimers.current[timerKey])
    }
    saveTimers.current[timerKey] = setTimeout(() => {
      saveEx(id, field, value)
      delete saveTimers.current[timerKey]
    }, 500)
  }, [day, onUpdate, saveEx])

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout)
    }
  }, [])

  const addExercise = async (ex: Exercise) => {
    const maxSortOrder = day.workout_exercises
      .filter(e => e.section === section)
      .reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)

    const { data, error } = await supabase.from('workout_exercises')
      .insert({
        day_id: day.id,
        exercise_id: ex.id,
        section: section,
        sort_order: maxSortOrder + 1,
        sets: section === 'strength' ? '3' : '1',
        reps: section === 'strength' ? '10' : '30s',
      })
      .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
      .single()

    if (error) {
      console.error('Add exercise error:', error)
      alert('Error: ' + error.message)
      return
    }
    if (data) {
      onUpdate({ ...day, workout_exercises: [...day.workout_exercises, data] })
    }
    setSearch('')
    setFocused(false)
    setShowAddRow(false)
  }

  const importTemplate = async (template: RoutineTemplate) => {
    // Fetch template exercises
    const { data: templateExercises, error } = await supabase
      .from('routine_template_exercises')
      .select(`*, exercise:exercises(*)`)
      .eq('template_id', template.id)
      .order('sort_order')

    if (error) {
      console.error('Error fetching template:', error)
      alert('Error importing template')
      return
    }

    if (!templateExercises || templateExercises.length === 0) {
      alert('This template has no exercises')
      return
    }

    const maxSortOrder = day.workout_exercises
      .filter(e => e.section === section)
      .reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)

    const newExercises: WorkoutExercise[] = []

    for (let i = 0; i < templateExercises.length; i++) {
      const te = templateExercises[i]
      const { data, error: insertError } = await supabase.from('workout_exercises')
        .insert({
          day_id: day.id,
          exercise_id: te.exercise_id,
          section: section,
          sort_order: maxSortOrder + 1 + i,
          sets: te.sets || '1',
          reps: te.reps || '30s',
          notes: te.notes,
        })
        .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
        .single()

      if (insertError) {
        console.error('Error inserting exercise:', insertError)
        continue
      }
      if (data) newExercises.push(data)
    }

    if (newExercises.length > 0) {
      onUpdate({ ...day, workout_exercises: [...day.workout_exercises, ...newExercises] })
    }
    setSearch('')
    setFocused(false)
    setShowAddRow(false)
    setCollapsed(false)
  }

  const insertBlock = async (block: ExerciseBlock) => {
    if (!block.exercise_block_items?.length) return

    const maxSortOrder = day.workout_exercises
      .filter(e => e.section === section)
      .reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)

    const newExercises: WorkoutExercise[] = []

    for (let i = 0; i < block.exercise_block_items.length; i++) {
      const item = block.exercise_block_items[i]
      const { data, error } = await supabase.from('workout_exercises')
        .insert({
          day_id: day.id,
          exercise_id: item.exercise_id,
          section: section,
          sort_order: maxSortOrder + 1 + i,
          label: item.label,
          sets: item.sets || '3',
          reps: item.reps || '10',
          weight: item.weight,
          rest_seconds: item.rest_seconds,
          rpe: item.rpe,
          notes: item.notes,
        })
        .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
        .single()

      if (error) continue
      if (data) newExercises.push(data)
    }

    if (newExercises.length > 0) {
      onUpdate({ ...day, workout_exercises: [...day.workout_exercises, ...newExercises] })
    }
    setSearch('')
    setFocused(false)
    setShowAddRow(false)
  }

  const deleteEx = async (id: string) => {
    if (!confirm('Delete this exercise?')) return
    await supabase.from('workout_exercises').delete().eq('id', id)
    onUpdate({ ...day, workout_exercises: day.workout_exercises.filter(e => e.id !== id) })
    setMenuRowId(null)
    setMenuPosition(null)
  }

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    setDraggedId(id)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    if (draggedId && draggedId !== id) {
      setDragOverId(id)
    }
  }

  const handleDragEnd = async () => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      const fromIdx = sectionExercises.findIndex(e => e.id === draggedId)
      const toIdx = sectionExercises.findIndex(e => e.id === dragOverId)

      if (fromIdx !== -1 && toIdx !== -1) {
        // Reorder within section
        const newSectionExercises = [...sectionExercises]
        const [moved] = newSectionExercises.splice(fromIdx, 1)
        newSectionExercises.splice(toIdx, 0, moved)

        // Update sort_order in DB
        const updates = newSectionExercises.map((e, i) =>
          supabase.from('workout_exercises').update({ sort_order: i }).eq('id', e.id)
        )
        await Promise.all(updates)

        // Update local state - replace section exercises with new order
        const otherExercises = day.workout_exercises.filter(e => e.section !== section)
        onUpdate({ ...day, workout_exercises: [...otherExercises, ...newSectionExercises] })
      }
    }
    setDraggedId(null)
    setDragOverId(null)
  }

  // Context menu handlers
  const openMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPosition({ top: rect.bottom + 4, left: rect.left })
    setMenuRowId(id)
  }

  const closeMenu = () => {
    setMenuRowId(null)
    setMenuPosition(null)
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => closeMenu()
    if (menuRowId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [menuRowId])

  const isStrength = section === 'strength'

  return (
    <div className="border-t border-slate-100 dark:border-slate-800">
      {/* Section Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {config.label}
          </span>
          <span className="text-xs text-slate-400">
            ({sectionExercises.length})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Section Content */}
      {!collapsed && (
        <div className="px-3 py-2">
          {sectionExercises.length > 0 ? (
            <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '20px' }} />
                <col style={{ width: '24px' }} />
                <col />
                <col style={{ width: '40px' }} />
                <col style={{ width: '48px' }} />
                {isStrength && settings.showWeight && <col style={{ width: '48px' }} />}
                {isStrength && settings.showEffort && <col style={{ width: '44px' }} />}
                {isStrength && settings.showRest && <col style={{ width: '48px' }} />}
                {settings.showNotes && <col style={{ width: '100px' }} />}
              </colgroup>
              <thead>
                <tr className="text-slate-500">
                  <th></th>
                  <th className="py-1 text-left">#</th>
                  <th className="py-1 text-left">Exercise</th>
                  <th className="py-1 text-center">Sets</th>
                  <th className="py-1 text-center">{isStrength ? 'Reps' : 'Time'}</th>
                  {isStrength && settings.showWeight && <th className="py-1 text-center">Wt</th>}
                  {isStrength && settings.showEffort && <th className="py-1 text-center">{settings.effortUnit.toUpperCase()}</th>}
                  {isStrength && settings.showRest && <th className="py-1 text-center">Rest</th>}
                  {settings.showNotes && <th className="py-1 text-left">Notes</th>}
                </tr>
              </thead>
              <tbody>
                {sectionExercises.map((e, i) => (
                  <tr
                    key={e.id}
                    className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 ${draggedId === e.id ? 'opacity-50' : ''} ${dragOverId === e.id ? 'border-t-2 border-purple-500' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(e.id)}
                    onDragOver={(ev) => handleDragOver(ev, e.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <td className="py-1">
                      <button
                        onClick={(ev) => openMenu(ev, e.id)}
                        className="p-0.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing"
                        title="Drag to reorder, click for options"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </button>
                    </td>
                    <td className="py-1 text-slate-400">{e.label || i + 1}</td>
                    <td className="py-1 text-slate-800 dark:text-slate-200 truncate">
                      {e.exercise?.name}
                    </td>
                    <td className="py-1">
                      <input
                        value={e.sets || ''}
                        onChange={ev => updateEx(e.id, 'sets', ev.target.value)}
                        className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={e.reps || ''}
                        onChange={ev => updateEx(e.id, 'reps', ev.target.value)}
                        className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                      />
                    </td>
                    {isStrength && settings.showWeight && (
                      <td className="py-1">
                        <input
                          value={e.weight || ''}
                          onChange={ev => updateEx(e.id, 'weight', ev.target.value)}
                          className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                        />
                      </td>
                    )}
                    {isStrength && settings.showEffort && (
                      <td className="py-1">
                        <input
                          value={e.rpe || ''}
                          onChange={ev => updateEx(e.id, 'rpe', ev.target.value ? Number(ev.target.value) : null)}
                          className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                        />
                      </td>
                    )}
                    {isStrength && settings.showRest && (
                      <td className="py-1">
                        <input
                          value={formatRestTime(e.rest_seconds)}
                          onChange={ev => {
                            const seconds = parseRestInput(ev.target.value)
                            updateEx(e.id, 'rest_seconds', seconds)
                          }}
                          className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                        />
                      </td>
                    )}
                    {settings.showNotes && (
                      <td className="py-1">
                        <input
                          value={e.notes || ''}
                          onChange={ev => updateEx(e.id, 'notes', ev.target.value || null)}
                          placeholder="Notes..."
                          className="w-full bg-transparent focus:outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400 text-xs"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {/* Context Menu */}
          {menuRowId && menuPosition && (
            <div
              className="fixed bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[160px]"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {isStrength && onSaveAsBlock && (
                <button
                  onClick={() => {
                    const exercise = sectionExercises.find(ex => ex.id === menuRowId)
                    if (exercise) {
                      onSaveAsBlock(menuRowId, exercise.exercise?.name || '', day.workout_exercises)
                    }
                    closeMenu()
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save as Block
                </button>
              )}
              <button
                onClick={() => deleteEx(menuRowId)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          )}

          {/* Add row / search */}
          {(showAddRow || search || sectionExercises.length === 0) && (
            <div className="relative mt-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={(ev) => {
                  setFocused(true)
                  const rect = ev.currentTarget.getBoundingClientRect()
                  setDropdownPosition({ top: rect.bottom + 4, left: rect.left })
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setFocused(false)
                    setDropdownPosition(null)
                    if (!search) setShowAddRow(false)
                  }, 200)
                }}
                placeholder={
                  isStrength
                    ? "Search blocks or exercises..."
                    : `Search ${section} templates or exercises...`
                }
                className="w-full text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-purple-400 placeholder-slate-400"
                autoFocus={showAddRow}
              />
              {focused && search && dropdownPosition && (
                <div
                  className="fixed w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50"
                  style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                >
                  {/* Templates (warmup/cooldown only) */}
                  {filteredTemplates.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 sticky top-0">
                        Templates
                      </div>
                      {filteredTemplates.map(template => (
                        <button
                          key={template.id}
                          onMouseDown={ev => {
                            ev.preventDefault()
                            importTemplate(template)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/20 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-purple-500">⊞</span>
                            <span className="text-slate-800 dark:text-slate-200 truncate">{template.name}</span>
                          </div>
                          <span className="text-slate-400 text-xs ml-1 flex-shrink-0">
                            {template.duration_minutes ? `~${template.duration_minutes}m` : ''}
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Blocks (strength only) */}
                  {filteredBlocks.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 sticky top-0">
                        Saved Blocks
                      </div>
                      {filteredBlocks.map(block => (
                        <button
                          key={block.id}
                          onMouseDown={ev => {
                            ev.preventDefault()
                            insertBlock(block)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/20 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-purple-500 text-xs">⊞</span>
                            <span className="text-slate-800 dark:text-slate-200 truncate">{block.name}</span>
                          </div>
                          <span className="text-slate-400 text-xs ml-1 flex-shrink-0">
                            {block.exercise_block_items?.length || 0} ex
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Exercises */}
                  {filteredExercises.length > 0 && (
                    <>
                      {(filteredTemplates.length > 0 || filteredBlocks.length > 0) && (
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 sticky top-0">
                          Exercises
                        </div>
                      )}
                      {filteredExercises.map(ex => (
                        <button
                          key={ex.id}
                          onMouseDown={ev => {
                            ev.preventDefault()
                            addExercise(ex)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/20 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 last:border-0 text-sm"
                        >
                          <span className="text-slate-800 dark:text-slate-200 truncate">{ex.name}</span>
                          <span className="text-slate-400 text-xs ml-1">{ex.equipment || 'BW'}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* No results */}
                  {filteredTemplates.length === 0 && filteredBlocks.length === 0 && filteredExercises.length === 0 && (
                    <div className="px-3 py-2 text-slate-400 text-sm">
                      No results found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add button when section has exercises */}
          {sectionExercises.length > 0 && !showAddRow && !search && (
            <button
              onClick={() => setShowAddRow(true)}
              className="mt-2 w-full py-1 text-xs text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add {isStrength ? 'Exercise' : section === 'warmup' ? 'Warmup' : 'Cooldown'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
