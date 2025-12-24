'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ExerciseBrowserModal } from './ExerciseBrowserModal'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Program, ProgramWeek, WorkoutDay, Exercise, Template } from './types'

interface ProgramBuilderClientProps {
  program: Program
  exercises: Exercise[]
  templates: Template[]
}

export function ProgramBuilderClient({
  program: initialProgram,
  exercises,
  templates,
}: ProgramBuilderClientProps) {
  const [program, setProgram] = useState(initialProgram)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const supabase = createClient()

  const updateProgramField = useCallback(async (field: string, value: string | boolean) => {
    setSaving(true)
    setProgram((prev) => ({ ...prev, [field]: value }))

    await supabase
      .from('programs')
      .update({ [field]: value })
      .eq('id', program.id)

    setSaving(false)
    setLastSaved(new Date())
  }, [program.id, supabase])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/coach/programs" className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <input
                type="text"
                value={program.name}
                onChange={(e) => updateProgramField('name', e.target.value)}
                className="text-xl font-bold text-slate-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0"
                placeholder="Program Name"
              />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">
                {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'All changes saved'}
              </span>
              <select
                value={program.type}
                onChange={(e) => updateProgramField('type', e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="strength">Strength</option>
                <option value="mobility">Mobility</option>
                <option value="cardio">Cardio</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Week Columns Container */}
      <main className="overflow-x-auto">
        <div className="flex gap-4 p-6 min-w-max">
          {program.program_weeks.map((week) => (
            <WeekColumn
              key={week.id}
              week={week}
              exercises={exercises}
              templates={templates}
              onUpdate={(updatedWeek) => {
                setProgram((prev) => ({
                  ...prev,
                  program_weeks: prev.program_weeks.map((w) =>
                    w.id === updatedWeek.id ? updatedWeek : w
                  ),
                }))
              }}
              onDelete={() => {
                setProgram((prev) => ({
                  ...prev,
                  program_weeks: prev.program_weeks.filter((w) => w.id !== week.id),
                }))
              }}
            />
          ))}

          {/* Add Week Button */}
          <AddWeekButton
            programId={program.id}
            nextWeekNumber={program.program_weeks.length + 1}
            onAdd={(newWeek) => {
              setProgram((prev) => ({
                ...prev,
                program_weeks: [...prev.program_weeks, newWeek],
              }))
            }}
          />
        </div>
      </main>
    </div>
  )
}

function WeekColumn({
  week,
  exercises,
  templates,
  onUpdate,
  onDelete,
}: {
  week: ProgramWeek
  exercises: Exercise[]
  templates: Template[]
  onUpdate: (week: ProgramWeek) => void
  onDelete: () => void
}) {
  const supabase = createClient()

  const updateWeekName = async (name: string) => {
    await supabase
      .from('program_weeks')
      .update({ name })
      .eq('id', week.id)

    onUpdate({ ...week, name })
  }

  const deleteWeek = async () => {
    if (!confirm('Delete this week and all its workouts?')) return

    await supabase.from('program_weeks').delete().eq('id', week.id)
    onDelete()
  }

  return (
    <div className="w-80 flex-shrink-0">
      {/* Week Header */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-t-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Week {week.week_number}
            </span>
          </div>
          <button
            onClick={deleteWeek}
            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            title="Delete week"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
        <input
          type="text"
          value={week.name || ''}
          onChange={(e) => updateWeekName(e.target.value)}
          placeholder="Week name (optional)"
          className="w-full mt-2 text-sm text-slate-900 dark:text-white bg-transparent border-none focus:outline-none p-0 placeholder-slate-400"
        />
      </div>

      {/* Workout Days */}
      <div className="space-y-2 mt-2">
        {week.workout_days.map((day) => (
          <WorkoutDayCard
            key={day.id}
            day={day}
            exercises={exercises}
            templates={templates}
            onUpdate={(updatedDay) => {
              onUpdate({
                ...week,
                workout_days: week.workout_days.map((d) =>
                  d.id === updatedDay.id ? updatedDay : d
                ),
              })
            }}
            onDelete={() => {
              onUpdate({
                ...week,
                workout_days: week.workout_days.filter((d) => d.id !== day.id),
              })
            }}
          />
        ))}

        <AddDayButton
          weekId={week.id}
          nextDayNumber={week.workout_days.length + 1}
          onAdd={(newDay) => {
            onUpdate({
              ...week,
              workout_days: [...week.workout_days, newDay],
            })
          }}
        />
      </div>
    </div>
  )
}

function WorkoutDayCard({
  day,
  exercises,
  templates,
  onUpdate,
  onDelete,
}: {
  day: WorkoutDay
  exercises: Exercise[]
  templates: Template[]
  onUpdate: (day: WorkoutDay) => void
  onDelete: () => void
}) {
  const supabase = createClient()

  const updateDay = async (updates: Partial<WorkoutDay>) => {
    await supabase
      .from('workout_days')
      .update(updates)
      .eq('id', day.id)

    onUpdate({ ...day, ...updates })
  }

  const deleteDay = async () => {
    if (!confirm('Delete this workout?')) return

    await supabase.from('workout_days').delete().eq('id', day.id)
    onDelete()
  }

  if (day.is_rest_day) {
    return (
      <div className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Day {day.day_number} - Rest Day
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateDay({ is_rest_day: false })}
              className="text-xs text-purple-600 hover:text-purple-500"
            >
              Convert to workout
            </button>
            <button
              onClick={deleteDay}
              className="p-1 rounded text-slate-400 hover:text-red-500 transition-all"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <textarea
          value={day.rest_day_notes || ''}
          onChange={(e) => updateDay({ rest_day_notes: e.target.value })}
          placeholder="Rest day notes..."
          className="w-full text-sm text-slate-600 dark:text-slate-400 bg-transparent border-none focus:outline-none resize-none"
          rows={2}
        />
      </div>
    )
  }

  const warmupExercises = day.workout_exercises.filter((e) => e.section === 'warmup')
  const strengthExercises = day.workout_exercises.filter((e) => e.section === 'strength')
  const cooldownExercises = day.workout_exercises.filter((e) => e.section === 'cooldown')

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Day Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={day.name}
            onChange={(e) => updateDay({ name: e.target.value })}
            className="font-medium text-slate-900 dark:text-white bg-transparent border-none focus:outline-none p-0 flex-1"
            placeholder="Day name"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateDay({ is_rest_day: true })}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2"
              title="Mark as rest day"
            >
              Rest
            </button>
            <button
              onClick={deleteDay}
              className="p-1 rounded text-slate-400 hover:text-red-500 transition-all"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <input
          type="text"
          value={day.subtitle || ''}
          onChange={(e) => updateDay({ subtitle: e.target.value })}
          placeholder="Subtitle (e.g., Upper Body Focus)"
          className="w-full text-sm text-slate-500 dark:text-slate-400 bg-transparent border-none focus:outline-none p-0 mt-1"
        />
      </div>

      {/* Exercise Sections */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {/* Warmup Section */}
        <ExerciseSection
          title="Warmup"
          color="orange"
          exercises={warmupExercises}
          allExercises={exercises}
          section="warmup"
          dayId={day.id}
          onUpdate={(updated) => {
            const otherExercises = day.workout_exercises.filter((e) => e.section !== 'warmup')
            onUpdate({ ...day, workout_exercises: [...otherExercises, ...updated] })
          }}
        />

        {/* Strength Section */}
        <ExerciseSection
          title="Strength"
          color="purple"
          exercises={strengthExercises}
          allExercises={exercises}
          section="strength"
          dayId={day.id}
          onUpdate={(updated) => {
            const otherExercises = day.workout_exercises.filter((e) => e.section !== 'strength')
            onUpdate({ ...day, workout_exercises: [...otherExercises, ...updated] })
          }}
        />

        {/* Cooldown Section */}
        <ExerciseSection
          title="Cooldown"
          color="blue"
          exercises={cooldownExercises}
          allExercises={exercises}
          section="cooldown"
          dayId={day.id}
          onUpdate={(updated) => {
            const otherExercises = day.workout_exercises.filter((e) => e.section !== 'cooldown')
            onUpdate({ ...day, workout_exercises: [...otherExercises, ...updated] })
          }}
        />
      </div>
    </div>
  )
}

function ExerciseSection({
  title,
  color,
  exercises,
  allExercises,
  section,
  dayId,
  onUpdate,
}: {
  title: string
  color: 'orange' | 'purple' | 'blue'
  exercises: WorkoutDay['workout_exercises']
  allExercises: Exercise[]
  section: 'warmup' | 'strength' | 'cooldown'
  dayId: string
  onUpdate: (exercises: WorkoutDay['workout_exercises']) => void
}) {
  const [showBrowser, setShowBrowser] = useState(false)
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const colorClasses = {
    orange: 'text-orange-600 dark:text-orange-400',
    purple: 'text-purple-600 dark:text-purple-400',
    blue: 'text-blue-600 dark:text-blue-400',
  }

  const handleBrowseSelect = async (selectedExercises: Exercise[]) => {
    const newExercises: WorkoutDay['workout_exercises'] = []

    for (let i = 0; i < selectedExercises.length; i++) {
      const exercise = selectedExercises[i]
      const { data } = await supabase
        .from('workout_exercises')
        .insert({
          day_id: dayId,
          exercise_id: exercise.id,
          section,
          sort_order: exercises.length + i,
          sets: '3',
          reps: '10',
        })
        .select(`*, exercise:exercises (*)`)
        .single()

      if (data) {
        newExercises.push(data)
      }
    }

    onUpdate([...exercises, ...newExercises])
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = exercises.findIndex((e) => e.id === active.id)
      const newIndex = exercises.findIndex((e) => e.id === over.id)

      const reordered = arrayMove(exercises, oldIndex, newIndex)

      // Update sort_order for all reordered exercises
      const updates = reordered.map((ex, idx) => ({
        ...ex,
        sort_order: idx,
      }))

      // Update local state immediately
      onUpdate(updates)

      // Persist to database
      for (const ex of updates) {
        await supabase
          .from('workout_exercises')
          .update({ sort_order: ex.sort_order })
          .eq('id', ex.id)
      }
    }
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium uppercase tracking-wide ${colorClasses[color]}`}>
          {title}
        </span>
        <button
          onClick={() => setShowBrowser(true)}
          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-500"
        >
          Browse
        </button>
      </div>

      {exercises.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={exercises.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {exercises.map((exercise) => (
                <SortableExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  onUpdate={(updated) => {
                    onUpdate(exercises.map((e) => (e.id === updated.id ? updated : e)))
                  }}
                  onDelete={() => {
                    onUpdate(exercises.filter((e) => e.id !== exercise.id))
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}

      <AddExerciseInput
        allExercises={allExercises}
        section={section}
        dayId={dayId}
        nextSortOrder={exercises.length}
        onAdd={(newExercise) => onUpdate([...exercises, newExercise])}
      />

      <ExerciseBrowserModal
        isOpen={showBrowser}
        onClose={() => setShowBrowser(false)}
        exercises={allExercises}
        onSelect={handleBrowseSelect}
      />
    </div>
  )
}

function SortableExerciseRow({
  exercise,
  onUpdate,
  onDelete,
}: {
  exercise: WorkoutDay['workout_exercises'][0]
  onUpdate: (exercise: WorkoutDay['workout_exercises'][0]) => void
  onDelete: () => void
}) {
  const supabase = createClient()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const updateField = async (field: string, value: string | number | null) => {
    await supabase
      .from('workout_exercises')
      .update({ [field]: value })
      .eq('id', exercise.id)

    onUpdate({ ...exercise, [field]: value })
  }

  const handleDelete = async () => {
    await supabase.from('workout_exercises').delete().eq('id', exercise.id)
    onDelete()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 py-1 group text-sm"
    >
      {/* Drag Handle */}
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-300 dark:text-slate-600 hover:text-slate-500 touch-none"
      >
        ⋮⋮
      </span>
      {exercise.label && (
        <span className="text-xs font-medium text-purple-600 dark:text-purple-400 w-6">
          {exercise.label}
        </span>
      )}
      <span className="flex-1 text-slate-900 dark:text-white truncate">
        {exercise.exercise?.name || 'Unknown'}
      </span>
      <input
        type="text"
        value={exercise.sets || ''}
        onChange={(e) => updateField('sets', e.target.value)}
        placeholder="3"
        className="w-8 text-center text-slate-700 dark:text-slate-300 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-purple-500 rounded"
      />
      <span className="text-slate-400">×</span>
      <input
        type="text"
        value={exercise.reps || ''}
        onChange={(e) => updateField('reps', e.target.value)}
        placeholder="10"
        className="w-10 text-center text-slate-700 dark:text-slate-300 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-purple-500 rounded"
      />
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function AddExerciseInput({
  allExercises,
  section,
  dayId,
  nextSortOrder,
  onAdd,
}: {
  allExercises: Exercise[]
  section: 'warmup' | 'strength' | 'cooldown'
  dayId: string
  nextSortOrder: number
  onAdd: (exercise: WorkoutDay['workout_exercises'][0]) => void
}) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  const filteredExercises = query
    ? allExercises.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  const addExercise = async (exercise: Exercise) => {
    setAdding(true)

    const { data, error } = await supabase
      .from('workout_exercises')
      .insert({
        day_id: dayId,
        exercise_id: exercise.id,
        section,
        sort_order: nextSortOrder,
        sets: '3',
        reps: '10',
      })
      .select(`
        *,
        exercise:exercises (*)
      `)
      .single()

    if (data && !error) {
      onAdd(data)
    }

    setQuery('')
    setShowDropdown(false)
    setAdding(false)
  }

  return (
    <div className="relative mt-2">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowDropdown(e.target.value.length > 0)
        }}
        onFocus={() => setShowDropdown(query.length > 0)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        disabled={adding}
        placeholder="+ Add exercise..."
        className="w-full bg-transparent border-none text-sm text-slate-500 dark:text-slate-400 focus:outline-none placeholder-slate-400 py-1"
      />

      {showDropdown && filteredExercises.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
          {filteredExercises.map((exercise) => (
            <button
              key={exercise.id}
              onMouseDown={() => addExercise(exercise)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between"
            >
              <span className="text-slate-900 dark:text-white">{exercise.name}</span>
              <span className="text-slate-400 text-xs">{exercise.equipment || 'BW'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface AddWeekButtonProps {
  programId: string
  nextWeekNumber: number
  onAdd: (week: ProgramWeek) => void
}

function AddWeekButton({ programId, nextWeekNumber, onAdd }: AddWeekButtonProps) {
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  const handleAdd = async () => {
    setAdding(true)

    const { data, error } = await supabase
      .from('program_weeks')
      .insert({
        program_id: programId,
        week_number: nextWeekNumber,
      })
      .select()
      .single()

    if (data && !error) {
      onAdd({ ...data, workout_days: [] })
    }

    setAdding(false)
  }

  return (
    <button
      onClick={handleAdd}
      disabled={adding}
      className="w-80 flex-shrink-0 h-32 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-all disabled:opacity-50"
    >
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Week
      </div>
    </button>
  )
}

interface AddDayButtonProps {
  weekId: string
  nextDayNumber: number
  onAdd: (day: WorkoutDay) => void
}

function AddDayButton({ weekId, nextDayNumber, onAdd }: AddDayButtonProps) {
  const [adding, setAdding] = useState(false)
  const supabase = createClient()

  const handleAdd = async () => {
    setAdding(true)

    const { data, error } = await supabase
      .from('workout_days')
      .insert({
        week_id: weekId,
        day_number: nextDayNumber,
        name: `Day ${nextDayNumber}`,
      })
      .select()
      .single()

    if (data && !error) {
      onAdd({ ...data, workout_exercises: [] })
    }

    setAdding(false)
  }

  return (
    <button
      onClick={handleAdd}
      disabled={adding}
      className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-all disabled:opacity-50"
    >
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Day
      </div>
    </button>
  )
}
