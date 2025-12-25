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
  warmup: {
    label: 'Warmup',
    color: 'orange',
    bgClass: 'bg-orange-50 dark:bg-orange-500/10',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-orange-200 dark:border-orange-800',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
    ),
  },
  strength: {
    label: 'Strength',
    color: 'purple',
    bgClass: 'bg-purple-50 dark:bg-purple-500/10',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  cooldown: {
    label: 'Cooldown',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-500/10',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
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
  }

  const isStrength = section === 'strength'

  return (
    <div className={`border-t ${config.borderClass}`}>
      {/* Section Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full px-3 py-2 flex items-center justify-between ${config.bgClass} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <span className={config.textClass}>{config.icon}</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${config.textClass}`}>
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
                <col style={{ width: '24px' }} />
                <col />
                <col style={{ width: '40px' }} />
                <col style={{ width: '48px' }} />
                {isStrength && settings.showWeight && <col style={{ width: '48px' }} />}
                {isStrength && settings.showEffort && <col style={{ width: '44px' }} />}
                {isStrength && settings.showRest && <col style={{ width: '48px' }} />}
                <col style={{ width: '24px' }} />
              </colgroup>
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 text-left">#</th>
                  <th className="py-1 text-left">Exercise</th>
                  <th className="py-1 text-center">Sets</th>
                  <th className="py-1 text-center">{isStrength ? 'Reps' : 'Time'}</th>
                  {isStrength && settings.showWeight && <th className="py-1 text-center">Wt</th>}
                  {isStrength && settings.showEffort && <th className="py-1 text-center">{settings.effortUnit.toUpperCase()}</th>}
                  {isStrength && settings.showRest && <th className="py-1 text-center">Rest</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sectionExercises.map((e, i) => (
                  <tr key={e.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
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
                    <td className="py-1">
                      <button
                        onClick={() => deleteEx(e.id)}
                        className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

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
                            <span className={config.textClass}>⊞</span>
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
