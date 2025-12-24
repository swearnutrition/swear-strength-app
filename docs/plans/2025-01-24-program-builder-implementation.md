# Program Builder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a spreadsheet-style program builder where coaches create workout programs with weeks as horizontal columns and exercises in editable tables, inspired by Superset Sheets.

**Architecture:** Server component fetches program data, client component handles interactive spreadsheet UI with inline editing, auto-save via debounced mutations, drag-and-drop via @dnd-kit.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, @dnd-kit for drag-drop

---

## Phase 1: Core Structure

### Task 1: Programs List Page

**Files:**
- Create: `src/app/coach/programs/page.tsx`
- Create: `src/app/coach/programs/ProgramsClient.tsx`

**Step 1: Create the server component**

```tsx
// src/app/coach/programs/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProgramsClient } from './ProgramsClient'

export default async function ProgramsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: programs } = await supabase
    .from('programs')
    .select(`
      *,
      program_weeks(count)
    `)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })

  const programsWithWeekCount = (programs || []).map((p) => ({
    ...p,
    week_count: p.program_weeks?.[0]?.count || 0,
  }))

  return <ProgramsClient programs={programsWithWeekCount} />
}
```

**Step 2: Create the client component**

```tsx
// src/app/coach/programs/ProgramsClient.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Program {
  id: string
  name: string
  type: 'strength' | 'mobility' | 'cardio'
  description: string | null
  is_indefinite: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
  week_count: number
}

interface ProgramsClientProps {
  programs: Program[]
}

const typeColors = {
  strength: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
  mobility: 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',
  cardio: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
}

export function ProgramsClient({ programs: initialPrograms }: ProgramsClientProps) {
  const [programs, setPrograms] = useState(initialPrograms)
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const filteredPrograms = programs.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCreate = async () => {
    setCreating(true)
    const { data, error } = await supabase
      .from('programs')
      .insert({
        name: 'Untitled Program',
        type: 'strength',
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single()

    if (data && !error) {
      router.push(`/coach/programs/${data.id}`)
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to archive this program?')) return

    await supabase
      .from('programs')
      .update({ is_archived: true })
      .eq('id', id)

    setPrograms(programs.filter((p) => p.id !== id))
  }

  const handleDuplicate = async (program: Program) => {
    const { data, error } = await supabase
      .from('programs')
      .insert({
        name: `${program.name} (Copy)`,
        type: program.type,
        description: program.description,
        is_indefinite: program.is_indefinite,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select()
      .single()

    if (data && !error) {
      router.push(`/coach/programs/${data.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/coach" className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Programs</h1>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Program
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search programs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          />
        </div>

        <p className="text-slate-500 text-sm mb-4">
          {filteredPrograms.length} program{filteredPrograms.length !== 1 ? 's' : ''}
        </p>

        {filteredPrograms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-500">No programs found</p>
            <button
              onClick={handleCreate}
              className="mt-4 text-purple-600 hover:text-purple-500 font-medium"
            >
              Create your first program
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPrograms.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                onDelete={() => handleDelete(program.id)}
                onDuplicate={() => handleDuplicate(program)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function ProgramCard({
  program,
  onDelete,
  onDuplicate,
}: {
  program: Program
  onDelete: () => void
  onDuplicate: () => void
}) {
  return (
    <Link
      href={`/coach/programs/${program.id}`}
      className="block bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-medium px-2 py-1 rounded-lg ${typeColors[program.type]}`}>
          {program.type.charAt(0).toUpperCase() + program.type.slice(1)}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.preventDefault()
              onDuplicate()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Duplicate"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault()
              onDelete()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            title="Archive"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{program.name}</h3>

      {program.description && (
        <p className="text-slate-500 text-sm line-clamp-2 mb-3">{program.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>{program.week_count} week{program.week_count !== 1 ? 's' : ''}</span>
        {program.is_indefinite && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Rolling
          </span>
        )}
      </div>
    </Link>
  )
}
```

**Step 3: Verify by running dev server**

Run: `npm run dev`
Navigate to: `/coach/programs`
Expected: See programs list page with search and create button

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add programs list page with search, create, duplicate, archive"
```

---

### Task 2: Program Builder Page Shell

**Files:**
- Create: `src/app/coach/programs/[id]/page.tsx`
- Create: `src/app/coach/programs/[id]/ProgramBuilderClient.tsx`
- Create: `src/app/coach/programs/[id]/types.ts`

**Step 1: Create shared types**

```tsx
// src/app/coach/programs/[id]/types.ts
export interface Exercise {
  id: string
  name: string
  equipment: string | null
  muscle_groups: string[]
  type: 'strength' | 'mobility' | 'cardio'
  primary_muscle: string | null
  focus_area: string | null
}

export interface WorkoutExercise {
  id: string
  day_id: string
  exercise_id: string
  exercise?: Exercise
  section: 'warmup' | 'strength' | 'cooldown' | 'cardio'
  label: string | null
  sets: string | null
  reps: string | null
  weight: string | null
  rest_seconds: number | null
  rpe: number | null
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

export interface Program {
  id: string
  name: string
  type: 'strength' | 'mobility' | 'cardio'
  description: string | null
  is_indefinite: boolean
  is_archived: boolean
  created_by: string
  program_weeks: ProgramWeek[]
}
```

**Step 2: Create the server component**

```tsx
// src/app/coach/programs/[id]/page.tsx
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
```

**Step 3: Create the client component shell**

```tsx
// src/app/coach/programs/[id]/ProgramBuilderClient.tsx
'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Program, ProgramWeek, WorkoutDay, Exercise } from './types'

interface Template {
  id: string
  name: string
  type: 'warmup' | 'cooldown'
  description: string | null
  duration_minutes: number | null
}

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
}: {
  week: ProgramWeek
  exercises: Exercise[]
  templates: Template[]
  onUpdate: (week: ProgramWeek) => void
}) {
  const supabase = createClient()

  const updateWeekName = async (name: string) => {
    await supabase
      .from('program_weeks')
      .update({ name })
      .eq('id', week.id)

    onUpdate({ ...week, name })
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
}: {
  day: WorkoutDay
  exercises: Exercise[]
  templates: Template[]
  onUpdate: (day: WorkoutDay) => void
}) {
  const supabase = createClient()

  const updateDay = async (updates: Partial<WorkoutDay>) => {
    await supabase
      .from('workout_days')
      .update(updates)
      .eq('id', day.id)

    onUpdate({ ...day, ...updates })
  }

  if (day.is_rest_day) {
    return (
      <div className="bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Day {day.day_number} - Rest Day
          </span>
          <button
            onClick={() => updateDay({ is_rest_day: false })}
            className="text-xs text-purple-600 hover:text-purple-500"
          >
            Convert to workout
          </button>
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

  return (
    <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Day Header */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <input
            type="text"
            value={day.name}
            onChange={(e) => updateDay({ name: e.target.value })}
            className="font-medium text-slate-900 dark:text-white bg-transparent border-none focus:outline-none p-0"
            placeholder="Day name"
          />
          <button
            onClick={() => updateDay({ is_rest_day: true })}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            title="Mark as rest day"
          >
            Rest
          </button>
        </div>
        <input
          type="text"
          value={day.subtitle || ''}
          onChange={(e) => updateDay({ subtitle: e.target.value })}
          placeholder="Subtitle (e.g., Upper Body Focus)"
          className="w-full text-sm text-slate-500 dark:text-slate-400 bg-transparent border-none focus:outline-none p-0 mt-1"
        />
      </div>

      {/* Exercise Sections - Placeholder for now */}
      <div className="p-3">
        <p className="text-sm text-slate-400 text-center py-4">
          Exercise table coming in Phase 2
        </p>
      </div>
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
```

**Step 4: Verify by running dev server**

Run: `npm run dev`
Navigate to: `/coach/programs` then create/click a program
Expected: See program builder with week columns, can add weeks/days, edit names

**Step 5: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add program builder page shell with week columns and day cards"
```

---

## Phase 2: Exercise Management

### Task 3: Exercise Table Component

**Files:**
- Create: `src/app/coach/programs/[id]/ExerciseTable.tsx`
- Modify: `src/app/coach/programs/[id]/ProgramBuilderClient.tsx`

**Step 1: Create the ExerciseTable component**

```tsx
// src/app/coach/programs/[id]/ExerciseTable.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutExercise, Exercise } from './types'

interface ExerciseTableProps {
  exercises: WorkoutExercise[]
  allExercises: Exercise[]
  section: 'warmup' | 'strength' | 'cooldown'
  dayId: string
  onUpdate: (exercises: WorkoutExercise[]) => void
}

export function ExerciseTable({
  exercises,
  allExercises,
  section,
  dayId,
  onUpdate,
}: ExerciseTableProps) {
  const supabase = createClient()
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)

  const sectionExercises = exercises.filter((e) => e.section === section)

  const updateExercise = async (id: string, field: string, value: string | number | null) => {
    await supabase
      .from('workout_exercises')
      .update({ [field]: value })
      .eq('id', id)

    onUpdate(
      exercises.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      )
    )
    setEditingCell(null)
  }

  const deleteExercise = async (id: string) => {
    await supabase
      .from('workout_exercises')
      .delete()
      .eq('id', id)

    onUpdate(exercises.filter((e) => e.id !== id))
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 px-2 font-medium w-8"></th>
            <th className="py-2 px-2 font-medium">Exercise</th>
            <th className="py-2 px-2 font-medium w-16 text-center">Sets</th>
            <th className="py-2 px-2 font-medium w-20 text-center">Reps</th>
            <th className="py-2 px-2 font-medium w-20 text-center">Weight</th>
            <th className="py-2 px-2 font-medium w-16 text-center">RPE</th>
            <th className="py-2 px-2 font-medium w-16 text-center">Rest</th>
            <th className="py-2 px-2 font-medium w-8"></th>
          </tr>
        </thead>
        <tbody>
          {sectionExercises.map((exercise, index) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              index={index}
              editingCell={editingCell}
              onEditCell={setEditingCell}
              onUpdate={updateExercise}
              onDelete={() => deleteExercise(exercise.id)}
            />
          ))}
        </tbody>
      </table>

      <AddExerciseRow
        allExercises={allExercises}
        section={section}
        dayId={dayId}
        nextSortOrder={sectionExercises.length}
        onAdd={(newExercise) => onUpdate([...exercises, newExercise])}
      />
    </div>
  )
}

function ExerciseRow({
  exercise,
  index,
  editingCell,
  onEditCell,
  onUpdate,
  onDelete,
}: {
  exercise: WorkoutExercise
  index: number
  editingCell: { id: string; field: string } | null
  onEditCell: (cell: { id: string; field: string } | null) => void
  onUpdate: (id: string, field: string, value: string | number | null) => void
  onDelete: () => void
}) {
  const isEditing = (field: string) =>
    editingCell?.id === exercise.id && editingCell?.field === field

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      {/* Drag Handle / Superset Label */}
      <td className="py-2 px-2">
        {exercise.label ? (
          <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
            {exercise.label}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 cursor-grab">⋮⋮</span>
        )}
      </td>

      {/* Exercise Name */}
      <td className="py-2 px-2">
        <span className="text-slate-900 dark:text-white">
          {exercise.exercise?.name || 'Unknown'}
        </span>
      </td>

      {/* Sets */}
      <td className="py-2 px-2 text-center">
        <EditableCell
          value={exercise.sets || ''}
          isEditing={isEditing('sets')}
          onStartEdit={() => onEditCell({ id: exercise.id, field: 'sets' })}
          onSave={(value) => onUpdate(exercise.id, 'sets', value)}
          onCancel={() => onEditCell(null)}
          placeholder="3"
        />
      </td>

      {/* Reps */}
      <td className="py-2 px-2 text-center">
        <EditableCell
          value={exercise.reps || ''}
          isEditing={isEditing('reps')}
          onStartEdit={() => onEditCell({ id: exercise.id, field: 'reps' })}
          onSave={(value) => onUpdate(exercise.id, 'reps', value)}
          onCancel={() => onEditCell(null)}
          placeholder="10"
        />
      </td>

      {/* Weight */}
      <td className="py-2 px-2 text-center">
        <EditableCell
          value={exercise.weight || ''}
          isEditing={isEditing('weight')}
          onStartEdit={() => onEditCell({ id: exercise.id, field: 'weight' })}
          onSave={(value) => onUpdate(exercise.id, 'weight', value)}
          onCancel={() => onEditCell(null)}
          placeholder="BW"
        />
      </td>

      {/* RPE */}
      <td className="py-2 px-2 text-center">
        <EditableCell
          value={exercise.rpe?.toString() || ''}
          isEditing={isEditing('rpe')}
          onStartEdit={() => onEditCell({ id: exercise.id, field: 'rpe' })}
          onSave={(value) => onUpdate(exercise.id, 'rpe', value ? parseInt(value) : null)}
          onCancel={() => onEditCell(null)}
          placeholder="8"
        />
      </td>

      {/* Rest */}
      <td className="py-2 px-2 text-center">
        <EditableCell
          value={exercise.rest_seconds ? `${exercise.rest_seconds}s` : ''}
          isEditing={isEditing('rest_seconds')}
          onStartEdit={() => onEditCell({ id: exercise.id, field: 'rest_seconds' })}
          onSave={(value) => onUpdate(exercise.id, 'rest_seconds', value ? parseInt(value.replace('s', '')) : null)}
          onCancel={() => onEditCell(null)}
          placeholder="60s"
        />
      </td>

      {/* Delete */}
      <td className="py-2 px-2">
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function EditableCell({
  value,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
  placeholder,
}: {
  value: string
  isEditing: boolean
  onStartEdit: () => void
  onSave: (value: string) => void
  onCancel: () => void
  placeholder: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => onSave(editValue)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(editValue)
          if (e.key === 'Escape') onCancel()
        }}
        className="w-full bg-white dark:bg-slate-800 border border-purple-500 rounded px-1 py-0.5 text-center text-slate-900 dark:text-white focus:outline-none"
      />
    )
  }

  return (
    <span
      onClick={onStartEdit}
      className="cursor-pointer text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400"
    >
      {value || <span className="text-slate-400">{placeholder}</span>}
    </span>
  )
}

function AddExerciseRow({
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
  onAdd: (exercise: WorkoutExercise) => void
}) {
  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const filteredExercises = query
    ? allExercises.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 10)
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
    inputRef.current?.focus()
  }

  return (
    <div className="relative mt-2">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowDropdown(e.target.value.length > 0)
        }}
        onFocus={() => setShowDropdown(query.length > 0)}
        disabled={adding}
        placeholder="+ Add exercise..."
        className="w-full bg-transparent border-none text-sm text-slate-500 dark:text-slate-400 focus:outline-none placeholder-slate-400 py-2"
      />

      {showDropdown && filteredExercises.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
          {filteredExercises.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => addExercise(exercise)}
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
```

**Step 2: Update WorkoutDayCard to use ExerciseTable**

In `ProgramBuilderClient.tsx`, replace the placeholder in `WorkoutDayCard`:

```tsx
// Replace the placeholder div in WorkoutDayCard with:
import { ExerciseTable } from './ExerciseTable'

// In WorkoutDayCard, replace the exercise sections placeholder:
      {/* Exercise Sections */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
        {/* Warmup Section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wide">
              Warmup
            </span>
          </div>
          <ExerciseTable
            exercises={day.workout_exercises}
            allExercises={exercises}
            section="warmup"
            dayId={day.id}
            onUpdate={(updated) => onUpdate({ ...day, workout_exercises: updated })}
          />
        </div>

        {/* Strength Section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
              Strength
            </span>
          </div>
          <ExerciseTable
            exercises={day.workout_exercises}
            allExercises={exercises}
            section="strength"
            dayId={day.id}
            onUpdate={(updated) => onUpdate({ ...day, workout_exercises: updated })}
          />
        </div>

        {/* Cooldown Section */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Cooldown
            </span>
          </div>
          <ExerciseTable
            exercises={day.workout_exercises}
            allExercises={exercises}
            section="cooldown"
            dayId={day.id}
            onUpdate={(updated) => onUpdate({ ...day, workout_exercises: updated })}
          />
        </div>
      </div>
```

**Step 3: Verify the exercise table**

Run: `npm run dev`
Navigate to: Program builder page
Expected: See exercise tables with inline editing, can add exercises via search

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add exercise table with inline editing and autocomplete search"
```

---

### Task 4: Exercise Browser Modal

**Files:**
- Create: `src/app/coach/programs/[id]/ExerciseBrowserModal.tsx`
- Modify: `src/app/coach/programs/[id]/ExerciseTable.tsx`

**Step 1: Create the ExerciseBrowserModal**

```tsx
// src/app/coach/programs/[id]/ExerciseBrowserModal.tsx
'use client'

import { useState, useMemo } from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import type { Exercise } from './types'

interface ExerciseBrowserModalProps {
  isOpen: boolean
  onClose: () => void
  exercises: Exercise[]
  onSelect: (exercises: Exercise[]) => void
}

const muscleGroups = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
]

const focusAreas = [
  { value: 'hip_flexors', label: 'Hip Flexors' },
  { value: 'hips', label: 'Hips' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'thoracic_spine', label: 'T-Spine' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'ankles', label: 'Ankles' },
]

export function ExerciseBrowserModal({
  isOpen,
  onClose,
  exercises,
  onSelect,
}: ExerciseBrowserModalProps) {
  const [activeType, setActiveType] = useState<'strength' | 'mobility'>('strength')
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  const [selectedFocus, setSelectedFocus] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filteredExercises = useMemo(() => {
    return exercises.filter((e) => {
      if (e.type !== activeType) return false
      if (searchQuery && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (activeType === 'strength' && selectedMuscle) {
        if (e.primary_muscle !== selectedMuscle) return false
      }
      if (activeType === 'mobility' && selectedFocus) {
        if (e.focus_area !== selectedFocus) return false
      }
      return true
    })
  }, [exercises, activeType, searchQuery, selectedMuscle, selectedFocus])

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const handleAdd = () => {
    const selectedExercises = exercises.filter((e) => selected.has(e.id))
    onSelect(selectedExercises)
    setSelected(new Set())
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Browse Exercises" size="xl">
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setActiveType('strength')
            setSelectedFocus(null)
          }}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            activeType === 'strength'
              ? 'bg-purple-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Strength
        </button>
        <button
          onClick={() => {
            setActiveType('mobility')
            setSelectedMuscle(null)
          }}
          className={`px-4 py-2 rounded-xl font-medium transition-all ${
            activeType === 'mobility'
              ? 'bg-blue-500 text-white'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Mobility
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search exercises..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {activeType === 'strength' ? (
          muscleGroups.map((mg) => (
            <button
              key={mg.value}
              onClick={() => setSelectedMuscle(selectedMuscle === mg.value ? null : mg.value)}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                selectedMuscle === mg.value
                  ? 'bg-purple-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {mg.label}
            </button>
          ))
        ) : (
          focusAreas.map((fa) => (
            <button
              key={fa.value}
              onClick={() => setSelectedFocus(selectedFocus === fa.value ? null : fa.value)}
              className={`px-3 py-1 rounded-full text-sm transition-all ${
                selectedFocus === fa.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {fa.label}
            </button>
          ))
        )}
      </div>

      {/* Exercise List */}
      <div className="max-h-64 overflow-y-auto border border-slate-700 rounded-xl">
        {filteredExercises.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No exercises found</div>
        ) : (
          filteredExercises.map((exercise) => (
            <button
              key={exercise.id}
              onClick={() => toggleSelect(exercise.id)}
              className={`w-full text-left px-4 py-3 flex items-center justify-between border-b border-slate-700 last:border-0 transition-all ${
                selected.has(exercise.id)
                  ? 'bg-purple-500/20'
                  : 'hover:bg-slate-800'
              }`}
            >
              <div>
                <span className="text-white">{exercise.name}</span>
                <span className="text-slate-500 text-sm ml-2">
                  {exercise.equipment || 'Bodyweight'}
                </span>
              </div>
              {selected.has(exercise.id) && (
                <svg className="w-5 h-5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))
        )}
      </div>

      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={selected.size === 0}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add {selected.size > 0 ? `(${selected.size})` : ''}
        </button>
      </ModalFooter>
    </Modal>
  )
}
```

**Step 2: Add browse button to ExerciseTable**

In `ExerciseTable.tsx`, add a browse button next to the add exercise input:

```tsx
// Add state for modal at the top of ExerciseTable component
const [showBrowser, setShowBrowser] = useState(false)

// Import the modal
import { ExerciseBrowserModal } from './ExerciseBrowserModal'

// Add the browse button next to AddExerciseRow and modal at the end
<div className="flex items-center gap-2 mt-2">
  <div className="flex-1">
    <AddExerciseRow ... />
  </div>
  <button
    onClick={() => setShowBrowser(true)}
    className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-500 whitespace-nowrap"
  >
    Browse
  </button>
</div>

<ExerciseBrowserModal
  isOpen={showBrowser}
  onClose={() => setShowBrowser(false)}
  exercises={allExercises}
  onSelect={async (selectedExercises) => {
    for (const exercise of selectedExercises) {
      const { data } = await supabase
        .from('workout_exercises')
        .insert({
          day_id: dayId,
          exercise_id: exercise.id,
          section,
          sort_order: exercises.filter((e) => e.section === section).length,
          sets: '3',
          reps: '10',
        })
        .select(`*, exercise:exercises (*)`)
        .single()

      if (data) {
        onUpdate([...exercises, data])
      }
    }
  }}
/>
```

**Step 3: Verify the exercise browser**

Run: `npm run dev`
Expected: Click "Browse" to open modal, filter by muscle group, select multiple exercises

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add exercise browser modal with filtering by muscle group and focus area"
```

---

### Task 5: Drag and Drop Reordering

**Files:**
- Install: `@dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- Modify: `src/app/coach/programs/[id]/ExerciseTable.tsx`

**Step 1: Install dnd-kit**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

**Step 2: Add drag and drop to ExerciseTable**

```tsx
// src/app/coach/programs/[id]/ExerciseTable.tsx
// Add at top:
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

// Wrap table body with DndContext and SortableContext:
export function ExerciseTable({...}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = sectionExercises.findIndex((e) => e.id === active.id)
      const newIndex = sectionExercises.findIndex((e) => e.id === over.id)

      const reordered = arrayMove(sectionExercises, oldIndex, newIndex)

      // Update sort_order for all reordered exercises
      const updates = reordered.map((ex, idx) => ({
        ...ex,
        sort_order: idx,
      }))

      // Update local state immediately
      const updatedExercises = exercises.map((e) => {
        const updated = updates.find((u) => u.id === e.id)
        return updated || e
      })
      onUpdate(updatedExercises)

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
    <div className="overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <table className="w-full text-sm">
          <thead>...</thead>
          <tbody>
            <SortableContext
              items={sectionExercises.map((e) => e.id)}
              strategy={verticalListSortingStrategy}
            >
              {sectionExercises.map((exercise, index) => (
                <SortableExerciseRow
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  editingCell={editingCell}
                  onEditCell={setEditingCell}
                  onUpdate={updateExercise}
                  onDelete={() => deleteExercise(exercise.id)}
                />
              ))}
            </SortableContext>
          </tbody>
        </table>
      </DndContext>
      ...
    </div>
  )
}

// Replace ExerciseRow with SortableExerciseRow:
function SortableExerciseRow({
  exercise,
  index,
  editingCell,
  onEditCell,
  onUpdate,
  onDelete,
}: {
  exercise: WorkoutExercise
  index: number
  editingCell: { id: string; field: string } | null
  onEditCell: (cell: { id: string; field: string } | null) => void
  onUpdate: (id: string, field: string, value: string | number | null) => void
  onDelete: () => void
}) {
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

  const isEditing = (field: string) =>
    editingCell?.id === exercise.id && editingCell?.field === field

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
    >
      {/* Drag Handle */}
      <td className="py-2 px-2">
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab text-slate-300 dark:text-slate-600 hover:text-slate-500"
        >
          ⋮⋮
        </span>
      </td>
      {/* ... rest of row cells unchanged ... */}
    </tr>
  )
}
```

**Step 3: Verify drag and drop**

Run: `npm run dev`
Expected: Drag exercises by the handle to reorder within section

**Step 4: Commit**

```bash
git add package*.json src/app/coach/programs/
git commit -m "feat: add drag and drop reordering for exercises with dnd-kit"
```

---

## Phase 3: Advanced Features

### Task 6: Superset Grouping

**Files:**
- Create: `src/app/coach/programs/[id]/SupersetManager.tsx`
- Modify: `src/app/coach/programs/[id]/ExerciseTable.tsx`

**Step 1: Create SupersetManager component**

```tsx
// src/app/coach/programs/[id]/SupersetManager.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutExercise } from './types'

interface SupersetManagerProps {
  exercises: WorkoutExercise[]
  onUpdate: (exercises: WorkoutExercise[]) => void
}

export function SupersetManager({ exercises, onUpdate }: SupersetManagerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const supabase = createClient()

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const getNextSupersetLabel = (): string => {
    const existingLabels = exercises
      .filter((e) => e.label)
      .map((e) => e.label![0])
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    for (const letter of alphabet) {
      if (!existingLabels.includes(letter)) {
        return letter
      }
    }
    return 'A' // Fallback
  }

  const createSuperset = async () => {
    if (selectedIds.size < 2) return

    const label = getNextSupersetLabel()
    const selectedExercises = exercises.filter((e) => selectedIds.has(e.id))
    const updates: WorkoutExercise[] = []

    for (let i = 0; i < selectedExercises.length; i++) {
      const ex = selectedExercises[i]
      const newLabel = `${label}${i + 1}`

      await supabase
        .from('workout_exercises')
        .update({ label: newLabel })
        .eq('id', ex.id)

      updates.push({ ...ex, label: newLabel })
    }

    const updatedExercises = exercises.map((e) => {
      const updated = updates.find((u) => u.id === e.id)
      return updated || e
    })

    onUpdate(updatedExercises)
    setSelectedIds(new Set())
  }

  const removeFromSuperset = async (id: string) => {
    await supabase
      .from('workout_exercises')
      .update({ label: null })
      .eq('id', id)

    onUpdate(
      exercises.map((e) =>
        e.id === id ? { ...e, label: null } : e
      )
    )
  }

  return {
    selectedIds,
    toggleSelect,
    createSuperset,
    removeFromSuperset,
  }
}
```

**Step 2: Integrate with ExerciseTable**

Add superset functionality to the exercise row with checkbox selection and group button.

```tsx
// In ExerciseTable, add:
const supersetManager = useSupersetManager(exercises, onUpdate)

// Add checkbox column to table header
<th className="py-2 px-2 w-8">
  {supersetManager.selectedIds.size > 1 && (
    <button
      onClick={supersetManager.createSuperset}
      className="text-xs text-purple-600 hover:text-purple-500"
      title="Group as superset"
    >
      Group
    </button>
  )}
</th>

// Add checkbox to each row
<td className="py-2 px-2">
  <input
    type="checkbox"
    checked={supersetManager.selectedIds.has(exercise.id)}
    onChange={() => supersetManager.toggleSelect(exercise.id)}
    className="rounded border-slate-600"
  />
</td>

// Show superset label with ungroup button
{exercise.label && (
  <button
    onClick={() => supersetManager.removeFromSuperset(exercise.id)}
    className="text-xs text-purple-600 hover:text-purple-500"
    title="Remove from superset"
  >
    {exercise.label}
  </button>
)}
```

**Step 3: Verify superset grouping**

Run: `npm run dev`
Expected: Select 2+ exercises, click Group to create superset (A1, A2), click label to ungroup

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add superset grouping with A1/A2 labels"
```

---

### Task 7: Copy/Paste Workouts and Weeks

**Files:**
- Create: `src/app/coach/programs/[id]/useCopyPaste.ts`
- Modify: `src/app/coach/programs/[id]/ProgramBuilderClient.tsx`

**Step 1: Create useCopyPaste hook**

```tsx
// src/app/coach/programs/[id]/useCopyPaste.ts
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutDay, ProgramWeek, WorkoutExercise } from './types'

interface ClipboardData {
  type: 'day' | 'week'
  data: WorkoutDay | ProgramWeek
}

export function useCopyPaste() {
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)
  const supabase = createClient()

  const copyDay = (day: WorkoutDay) => {
    setClipboard({ type: 'day', data: day })
  }

  const copyWeek = (week: ProgramWeek) => {
    setClipboard({ type: 'week', data: week })
  }

  const pasteDay = async (
    targetWeekId: string,
    dayNumber: number
  ): Promise<WorkoutDay | null> => {
    if (!clipboard || clipboard.type !== 'day') return null

    const sourceDay = clipboard.data as WorkoutDay

    // Create new day
    const { data: newDay, error: dayError } = await supabase
      .from('workout_days')
      .insert({
        week_id: targetWeekId,
        day_number: dayNumber,
        name: sourceDay.name,
        subtitle: sourceDay.subtitle,
        is_rest_day: sourceDay.is_rest_day,
        rest_day_notes: sourceDay.rest_day_notes,
        warmup_template_id: sourceDay.warmup_template_id,
        cooldown_template_id: sourceDay.cooldown_template_id,
      })
      .select()
      .single()

    if (dayError || !newDay) return null

    // Copy exercises
    const exercisesToInsert = sourceDay.workout_exercises.map((ex) => ({
      day_id: newDay.id,
      exercise_id: ex.exercise_id,
      section: ex.section,
      label: ex.label,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      rest_seconds: ex.rest_seconds,
      rpe: ex.rpe,
      notes: ex.notes,
      sort_order: ex.sort_order,
    }))

    if (exercisesToInsert.length > 0) {
      const { data: newExercises } = await supabase
        .from('workout_exercises')
        .insert(exercisesToInsert)
        .select(`*, exercise:exercises (*)`)

      return { ...newDay, workout_exercises: newExercises || [] }
    }

    return { ...newDay, workout_exercises: [] }
  }

  const duplicateWeek = async (
    week: ProgramWeek,
    nextWeekNumber: number
  ): Promise<ProgramWeek | null> => {
    // Create new week
    const { data: newWeek, error: weekError } = await supabase
      .from('program_weeks')
      .insert({
        program_id: week.program_id,
        week_number: nextWeekNumber,
        name: week.name ? `${week.name} (Copy)` : null,
      })
      .select()
      .single()

    if (weekError || !newWeek) return null

    // Copy all days and their exercises
    const newDays: WorkoutDay[] = []

    for (const day of week.workout_days) {
      const { data: newDay } = await supabase
        .from('workout_days')
        .insert({
          week_id: newWeek.id,
          day_number: day.day_number,
          name: day.name,
          subtitle: day.subtitle,
          is_rest_day: day.is_rest_day,
          rest_day_notes: day.rest_day_notes,
          warmup_template_id: day.warmup_template_id,
          cooldown_template_id: day.cooldown_template_id,
        })
        .select()
        .single()

      if (!newDay) continue

      const exercisesToInsert = day.workout_exercises.map((ex) => ({
        day_id: newDay.id,
        exercise_id: ex.exercise_id,
        section: ex.section,
        label: ex.label,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        rest_seconds: ex.rest_seconds,
        rpe: ex.rpe,
        notes: ex.notes,
        sort_order: ex.sort_order,
      }))

      if (exercisesToInsert.length > 0) {
        const { data: newExercises } = await supabase
          .from('workout_exercises')
          .insert(exercisesToInsert)
          .select(`*, exercise:exercises (*)`)

        newDays.push({ ...newDay, workout_exercises: newExercises || [] })
      } else {
        newDays.push({ ...newDay, workout_exercises: [] })
      }
    }

    return { ...newWeek, workout_days: newDays }
  }

  return {
    clipboard,
    copyDay,
    copyWeek,
    pasteDay,
    duplicateWeek,
  }
}
```

**Step 2: Add copy/paste buttons to UI**

In `ProgramBuilderClient.tsx`, add copy buttons to week headers and day cards, and paste buttons where appropriate.

**Step 3: Verify copy/paste**

Run: `npm run dev`
Expected: Copy a workout day, paste it to another week. Duplicate a week.

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add copy/paste for workout days and week duplication"
```

---

### Task 8: Template Application

**Files:**
- Create: `src/app/coach/programs/[id]/TemplatePicker.tsx`
- Modify: `src/app/coach/programs/[id]/ProgramBuilderClient.tsx`

**Step 1: Create TemplatePicker component**

```tsx
// src/app/coach/programs/[id]/TemplatePicker.tsx
'use client'

import { useState } from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { createClient } from '@/lib/supabase/client'

interface Template {
  id: string
  name: string
  type: 'warmup' | 'cooldown'
  description: string | null
  duration_minutes: number | null
}

interface TemplatePickerProps {
  isOpen: boolean
  onClose: () => void
  templates: Template[]
  type: 'warmup' | 'cooldown'
  dayId: string
  onApply: (templateId: string) => void
}

export function TemplatePicker({
  isOpen,
  onClose,
  templates,
  type,
  dayId,
  onApply,
}: TemplatePickerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const filteredTemplates = templates.filter((t) => t.type === type)

  const handleApply = async () => {
    if (!selectedId) return

    setLoading(true)

    // Delete existing exercises in this section
    await supabase
      .from('workout_exercises')
      .delete()
      .eq('day_id', dayId)
      .eq('section', type)

    // Fetch template exercises
    const { data: templateExercises } = await supabase
      .from('routine_template_exercises')
      .select(`*, exercise:exercises (*)`)
      .eq('template_id', selectedId)
      .order('sort_order')

    // Insert exercises from template
    if (templateExercises && templateExercises.length > 0) {
      const exercisesToInsert = templateExercises.map((te, idx) => ({
        day_id: dayId,
        exercise_id: te.exercise_id,
        section: type,
        sets: te.sets,
        reps: te.reps,
        notes: te.notes,
        sort_order: idx,
      }))

      await supabase.from('workout_exercises').insert(exercisesToInsert)
    }

    // Update day with template reference
    const templateField = type === 'warmup' ? 'warmup_template_id' : 'cooldown_template_id'
    await supabase
      .from('workout_days')
      .update({ [templateField]: selectedId })
      .eq('id', dayId)

    onApply(selectedId)
    setLoading(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Apply ${type === 'warmup' ? 'Warmup' : 'Cooldown'} Template`}
    >
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filteredTemplates.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No templates available</p>
        ) : (
          filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedId(template.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedId === template.id
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="font-medium text-white">{template.name}</div>
              {template.description && (
                <div className="text-sm text-slate-400 mt-1">{template.description}</div>
              )}
              {template.duration_minutes && (
                <div className="text-xs text-slate-500 mt-2">
                  ~{template.duration_minutes} min
                </div>
              )}
            </button>
          ))
        )}
      </div>

      <ModalFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={!selectedId || loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors disabled:opacity-50"
        >
          {loading ? 'Applying...' : 'Apply Template'}
        </button>
      </ModalFooter>
    </Modal>
  )
}
```

**Step 2: Add template buttons to section headers**

In `WorkoutDayCard`, add "Apply Template" buttons to the warmup and cooldown section headers.

**Step 3: Verify template application**

Run: `npm run dev`
Expected: Click "Apply Template" in warmup/cooldown section, select template, exercises are added

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add warmup/cooldown template application"
```

---

## Phase 4: Polish

### Task 9: Auto-Save with Debounce

**Files:**
- Create: `src/app/coach/programs/[id]/useAutoSave.ts`
- Modify: `src/app/coach/programs/[id]/ProgramBuilderClient.tsx`

**Step 1: Create useAutoSave hook**

```tsx
// src/app/coach/programs/[id]/useAutoSave.ts
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseAutoSaveOptions {
  delay?: number
  onSave: () => Promise<void>
}

export function useAutoSave({ delay = 2000, onSave }: UseAutoSaveOptions) {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [pendingChanges, setPendingChanges] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerSave = useCallback(() => {
    setPendingChanges(true)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      setSaving(true)
      try {
        await onSave()
        setLastSaved(new Date())
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
      setSaving(false)
      setPendingChanges(false)
    }, delay)
  }, [delay, onSave])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getStatusText = () => {
    if (saving) return 'Saving...'
    if (pendingChanges) return 'Unsaved changes'
    if (lastSaved) return `Saved ${lastSaved.toLocaleTimeString()}`
    return 'All changes saved'
  }

  return {
    saving,
    lastSaved,
    pendingChanges,
    triggerSave,
    statusText: getStatusText(),
  }
}
```

**Step 2: Integrate auto-save in ProgramBuilderClient**

Wire up all edit functions to call `triggerSave()` after local state updates.

**Step 3: Verify auto-save**

Run: `npm run dev`
Expected: Changes trigger "Unsaved changes", then "Saving...", then "Saved [time]"

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add auto-save with 2s debounce and status indicator"
```

---

### Task 10: Delete Week and Day Actions

**Files:**
- Modify: `src/app/coach/programs/[id]/ProgramBuilderClient.tsx`

**Step 1: Add delete functions**

```tsx
// In WeekColumn, add delete button and handler:
const deleteWeek = async () => {
  if (!confirm('Delete this week and all its workouts?')) return

  await supabase.from('program_weeks').delete().eq('id', week.id)

  // Call parent to remove from state
  onDelete()
}

// Add delete button to week header menu

// In WorkoutDayCard, add delete button:
const deleteDay = async () => {
  if (!confirm('Delete this workout?')) return

  await supabase.from('workout_days').delete().eq('id', day.id)

  onDelete()
}
```

**Step 2: Wire up delete callbacks in parent components**

Pass `onDelete` props through the component tree.

**Step 3: Verify delete functionality**

Run: `npm run dev`
Expected: Can delete weeks and days with confirmation

**Step 4: Commit**

```bash
git add src/app/coach/programs/
git commit -m "feat: add delete actions for weeks and workout days"
```

---

### Task 11: Add Link to Programs from Coach Dashboard

**Files:**
- Modify: `src/app/coach/CoachDashboardClient.tsx`

**Step 1: Add Programs link to dashboard navigation**

Find the navigation section in `CoachDashboardClient.tsx` and add a link to `/coach/programs`.

**Step 2: Verify navigation**

Run: `npm run dev`
Navigate to: `/coach`
Expected: See Programs link in dashboard, clicking leads to programs list

**Step 3: Commit**

```bash
git add src/app/coach/
git commit -m "feat: add Programs link to coach dashboard navigation"
```

---

## Summary

This implementation plan covers:

1. **Phase 1**: Core structure (programs list, builder shell, week columns, day cards)
2. **Phase 2**: Exercise management (table, inline editing, autocomplete, browser modal, drag-drop)
3. **Phase 3**: Advanced features (supersets, copy/paste, templates)
4. **Phase 4**: Polish (auto-save, delete actions, dashboard link)

Each task follows TDD principles where applicable and includes verification steps.
