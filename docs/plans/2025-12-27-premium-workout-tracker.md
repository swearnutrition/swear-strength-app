# Premium Workout Tracker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace WorkoutDayClient.tsx with a premium workout tracker featuring glassmorphism, volume tracking, PR detection with celebrations, and add-set functionality.

**Architecture:** Extend the useColors hook with premium theme tokens. Rewrite WorkoutDayClient with new visual design and features. Add database migration for PR upsert support. All existing functionality preserved.

**Tech Stack:** Next.js 16, React 19, Tailwind 4, Supabase, TypeScript

---

## Task 1: Database Migration for PR Upsert

**Files:**
- Create: `supabase/migrations/029_personal_records_unique_constraint.sql`

**Step 1: Create migration file**

```sql
-- Add unique constraint for upsert on personal_records
ALTER TABLE personal_records
ADD CONSTRAINT personal_records_user_exercise_type_unique
UNIQUE (user_id, exercise_id, record_type);
```

**Step 2: Apply migration locally**

Run: `npx supabase db reset` or apply via Supabase dashboard

**Step 3: Commit**

```bash
git add supabase/migrations/029_personal_records_unique_constraint.sql
git commit -m "feat: add unique constraint to personal_records for upsert"
```

---

## Task 2: Extend useColors Hook with Premium Theme

**Files:**
- Modify: `src/hooks/useColors.ts`

**Step 1: Replace entire file with extended color system**

```typescript
'use client'

import { useTheme } from '@/lib/theme'

export interface ThemeColors {
  // Backgrounds
  bg: string
  bgGradient: string
  bgCard: string
  bgCardSolid: string
  bgCardHover: string
  bgGlass: string
  bgTertiary: string
  bgInput: string

  // Text
  text: string
  textSecondary: string
  textMuted: string

  // Borders
  border: string
  borderLight: string
  borderGlow: string

  // Brand - Purple
  purple: string
  purpleLight: string
  purpleDark: string
  purpleGlow: string
  purpleGradient: string

  // Status - Green
  green: string
  greenLight: string
  greenGradient: string

  // Status - Amber
  amber: string
  amberLight: string
  amberGradient: string

  // Status - Red
  red: string

  // Status - Blue
  blue: string

  // Card gradient
  cardGradient: string

  // Shadows
  shadowSm: string
  shadowMd: string
  shadowLg: string
  shadowPurple: string
  shadowGreen: string
  shadowAmber: string
}

const darkColors: ThemeColors = {
  // Backgrounds - rich dark with purple undertone
  bg: '#0c0a1d',
  bgGradient: 'linear-gradient(180deg, #0c0a1d 0%, #1a1333 50%, #0f0d1a 100%)',
  bgCard: 'rgba(26, 22, 48, 0.6)',
  bgCardSolid: '#1a1630',
  bgCardHover: 'rgba(36, 30, 66, 0.8)',
  bgGlass: 'rgba(255, 255, 255, 0.03)',
  bgTertiary: 'rgba(139, 92, 246, 0.08)',
  bgInput: 'rgba(255, 255, 255, 0.05)',

  // Text
  text: '#ffffff',
  textSecondary: '#a5a3b8',
  textMuted: '#6b6880',

  // Borders
  border: 'rgba(139, 92, 246, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  borderGlow: 'rgba(139, 92, 246, 0.3)',

  // Brand - Purple
  purple: '#a78bfa',
  purpleLight: 'rgba(167, 139, 250, 0.15)',
  purpleDark: '#8b5cf6',
  purpleGlow: 'rgba(139, 92, 246, 0.4)',
  purpleGradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)',

  // Status - Green
  green: '#34d399',
  greenLight: 'rgba(52, 211, 153, 0.15)',
  greenGradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',

  // Status - Amber
  amber: '#fbbf24',
  amberLight: 'rgba(251, 191, 36, 0.15)',
  amberGradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',

  // Status - Red
  red: '#ef4444',

  // Status - Blue
  blue: '#60a5fa',

  // Card gradient
  cardGradient: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%)',

  // Shadows (colored, not gray)
  shadowSm: '0 2px 8px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 8px 24px rgba(0, 0, 0, 0.4)',
  shadowLg: '0 16px 48px rgba(0, 0, 0, 0.5)',
  shadowPurple: '0 8px 32px rgba(139, 92, 246, 0.3)',
  shadowGreen: '0 4px 16px rgba(52, 211, 153, 0.3)',
  shadowAmber: '0 4px 16px rgba(251, 191, 36, 0.3)',
}

const lightColors: ThemeColors = {
  // Backgrounds - warm off-white with subtle purple tint
  bg: '#faf8ff',
  bgGradient: 'linear-gradient(180deg, #faf8ff 0%, #f5f3ff 50%, #ffffff 100%)',
  bgCard: 'rgba(255, 255, 255, 0.9)',
  bgCardSolid: '#ffffff',
  bgCardHover: '#ffffff',
  bgGlass: 'rgba(255, 255, 255, 0.7)',
  bgTertiary: '#f5f3ff',
  bgInput: '#f8fafc',

  // Text
  text: '#1e1b4b',
  textSecondary: '#4c4977',
  textMuted: '#8b85ad',

  // Borders
  border: 'rgba(139, 92, 246, 0.12)',
  borderLight: '#e9e5ff',
  borderGlow: 'rgba(139, 92, 246, 0.25)',

  // Brand - Purple
  purple: '#7c3aed',
  purpleLight: 'rgba(124, 58, 237, 0.08)',
  purpleDark: '#6d28d9',
  purpleGlow: 'rgba(124, 58, 237, 0.2)',
  purpleGradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)',

  // Status - Green
  green: '#059669',
  greenLight: 'rgba(5, 150, 105, 0.1)',
  greenGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',

  // Status - Amber
  amber: '#d97706',
  amberLight: 'rgba(217, 119, 6, 0.1)',
  amberGradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',

  // Status - Red
  red: '#ef4444',

  // Status - Blue
  blue: '#2563eb',

  // Card gradient
  cardGradient: 'linear-gradient(135deg, rgba(124, 58, 237, 0.04) 0%, rgba(59, 130, 246, 0.02) 100%)',

  // Shadows (purple-tinted, not gray)
  shadowSm: '0 2px 8px rgba(124, 58, 237, 0.06)',
  shadowMd: '0 8px 24px rgba(124, 58, 237, 0.08)',
  shadowLg: '0 16px 48px rgba(124, 58, 237, 0.12)',
  shadowPurple: '0 8px 32px rgba(124, 58, 237, 0.15)',
  shadowGreen: '0 4px 16px rgba(5, 150, 105, 0.2)',
  shadowAmber: '0 4px 16px rgba(217, 119, 6, 0.2)',
}

export function useColors(): ThemeColors {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'light' ? lightColors : darkColors
}

export function getColors(theme: 'dark' | 'light'): ThemeColors {
  return theme === 'light' ? lightColors : darkColors
}
```

**Step 2: Commit**

```bash
git add src/hooks/useColors.ts
git commit -m "feat: extend useColors with premium theme tokens"
```

---

## Task 3: Add Premium Animations to globals.css

**Files:**
- Modify: `src/app/globals.css` (add after existing animations section around line 211)

**Step 1: Add new keyframes after `@keyframes number-tick`**

Find the line `@keyframes number-tick { ... }` (around line 199-211) and add after it:

```css
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}

@keyframes celebrate {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes pr-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(139, 92, 246, 0.5);
  }
}

@keyframes expand-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Step 2: Add animation utility classes at the end of the file**

```css
/* Premium Workout Tracker Animations */
.animate-float {
  animation: float 2s ease-in-out infinite;
}

.animate-celebrate {
  animation: celebrate 2s ease-in-out infinite;
}

.animate-pr-glow {
  animation: pr-glow 2s ease-in-out infinite;
}

.animate-expand-in {
  animation: expand-in 0.3s ease-out;
}
```

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add premium workout tracker animations"
```

---

## Task 4: Update Page.tsx to Fetch Personal Records

**Files:**
- Modify: `src/app/(client)/workouts/[dayId]/page.tsx`

**Step 1: Add personal records fetch and pass to client**

Replace the entire file:

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkoutDayClient } from './WorkoutDayClient'

interface PageProps {
  params: Promise<{ dayId: string }>
}

export default async function WorkoutDayPage({ params }: PageProps) {
  const { dayId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get workout day with exercises
  const { data: workoutDay } = await supabase
    .from('workout_days')
    .select(`
      *,
      program_weeks(
        program_id,
        week_number,
        programs(name)
      ),
      workout_exercises(
        id,
        section,
        label,
        sets,
        reps,
        weight,
        rest_seconds,
        rpe,
        notes,
        sort_order,
        exercises(
          id,
          name,
          equipment,
          muscle_groups,
          demo_url,
          cues,
          instructions
        )
      )
    `)
    .eq('id', dayId)
    .single()

  if (!workoutDay) {
    redirect('/workouts')
  }

  // Verify user has access to this workout (has active assignment for this program)
  const { data: assignment } = await supabase
    .from('user_program_assignments')
    .select('id')
    .eq('user_id', user.id)
    .eq('program_id', workoutDay.program_weeks.program_id)
    .eq('is_active', true)
    .single()

  if (!assignment) {
    redirect('/workouts')
  }

  // Get or create workout log
  let { data: workoutLog } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('workout_day_id', dayId)
    .eq('assignment_id', assignment.id)
    .is('completed_at', null)
    .single()

  if (!workoutLog) {
    const { data: newLog } = await supabase
      .from('workout_logs')
      .insert({
        user_id: user.id,
        workout_day_id: dayId,
        assignment_id: assignment.id,
      })
      .select()
      .single()

    workoutLog = newLog
  }

  // Get existing set logs for this workout
  const { data: setLogs } = await supabase
    .from('set_logs')
    .select('*')
    .eq('workout_log_id', workoutLog?.id || '')
    .order('set_number')

  // Get exercise IDs from workout
  const exerciseIds = workoutDay.workout_exercises.map(
    (we: { exercises: { id: string } }) => we.exercises.id
  )

  // Fetch personal records for all exercises in this workout
  const { data: personalRecords } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', user.id)
    .in('exercise_id', exerciseIds)

  // Sort exercises by sort_order
  const sortedExercises = workoutDay.workout_exercises.sort(
    (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
  )

  return (
    <WorkoutDayClient
      workoutDay={{
        ...workoutDay,
        workout_exercises: sortedExercises,
      }}
      workoutLog={workoutLog}
      setLogs={setLogs || []}
      personalRecords={personalRecords || []}
      programName={workoutDay.program_weeks.programs.name}
      weekNumber={workoutDay.program_weeks.week_number}
      userId={user.id}
    />
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(client\)/workouts/\[dayId\]/page.tsx
git commit -m "feat: fetch personal records in workout page"
```

---

## Task 5: Rewrite WorkoutDayClient - Part 1 (Types and Setup)

**Files:**
- Modify: `src/app/(client)/workouts/[dayId]/WorkoutDayClient.tsx`

**Step 1: Replace the entire file with the new implementation**

This is a large file. We'll build it in sections. Start with the imports, types, and constants:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useColors } from '@/hooks/useColors'

// ============================================
// TYPES
// ============================================

interface Exercise {
  id: string
  name: string
  equipment: string | null
  muscle_groups: string[]
  demo_url: string | null
  cues: string | null
  instructions: string | null
}

interface WorkoutExercise {
  id: string
  section: string
  label: string | null
  sets: string | null
  reps: string | null
  weight: string | null
  rest_seconds: number | null
  rpe: number | null
  notes: string | null
  sort_order: number
  exercises: Exercise
}

interface WorkoutDay {
  id: string
  day_number: number
  name: string
  subtitle: string | null
  is_rest_day: boolean
  workout_exercises: WorkoutExercise[]
}

interface WorkoutLog {
  id: string
  started_at: string
  completed_at: string | null
}

interface SetLog {
  id: string
  workout_exercise_id: string
  set_number: number
  weight: number | null
  reps_completed: number | null
  is_bodyweight: boolean
  notes: string | null
}

interface PersonalRecord {
  id: string
  exercise_id: string
  record_type: string
  value: number
}

interface WorkoutDayClientProps {
  workoutDay: WorkoutDay
  workoutLog: WorkoutLog
  setLogs: SetLog[]
  personalRecords: PersonalRecord[]
  programName: string
  weekNumber: number
  userId: string
}

interface SetData {
  weight: string
  reps: string
  completed: boolean
  isWeightPR: boolean
  isVolumePR: boolean
  setLogId: string | null
}

// ============================================
// CONSTANTS
// ============================================

const sectionOrder = ['warmup', 'strength', 'cardio', 'cooldown']
const sectionLabels: Record<string, string> = {
  warmup: 'Warm-up',
  strength: 'Strength',
  cardio: 'Cardio',
  cooldown: 'Cool-down',
}
const sectionIcons: Record<string, string> = {
  warmup: '🔥',
  strength: '🏋️',
  cardio: '🫀',
  cooldown: '🧘',
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const calculateSetVolume = (weight: string, reps: string): number => {
  const w = parseFloat(weight) || 0
  const r = parseInt(reps) || 0
  return w * r
}

const calculateExerciseVolume = (sets: SetData[]): number => {
  return sets
    .filter(s => s.completed)
    .reduce((sum, s) => sum + calculateSetVolume(s.weight, s.reps), 0)
}

const formatVolume = (volume: number): string => {
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}k`
  }
  return volume.toLocaleString()
}

const groupExercisesBySection = (exercises: WorkoutExercise[]) => {
  const groups: Record<string, WorkoutExercise[]> = {}
  exercises.forEach(ex => {
    if (!groups[ex.section]) {
      groups[ex.section] = []
    }
    groups[ex.section].push(ex)
  })
  return groups
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkoutDayClient({
  workoutDay,
  workoutLog,
  setLogs,
  personalRecords,
  programName,
  weekNumber,
  userId,
}: WorkoutDayClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const colors = useColors()

  // Build PR lookup map
  const prMap = new Map<string, { weight: number; volume: number }>()
  personalRecords.forEach(pr => {
    const existing = prMap.get(pr.exercise_id) || { weight: 0, volume: 0 }
    if (pr.record_type === 'weight') {
      existing.weight = pr.value
    } else if (pr.record_type === 'volume') {
      existing.volume = pr.value
    }
    prMap.set(pr.exercise_id, existing)
  })

  // Initialize sets data from existing logs
  const initializeSetsData = useCallback(() => {
    const data: Record<string, SetData[]> = {}
    workoutDay.workout_exercises.forEach(ex => {
      const numSets = parseInt(ex.sets?.split('-')[0] || '3', 10)
      const existingLogs = setLogs.filter(log => log.workout_exercise_id === ex.id)
      const exercisePRs = prMap.get(ex.exercises.id)

      data[ex.id] = Array.from({ length: numSets }, (_, i) => {
        const existingLog = existingLogs.find(log => log.set_number === i + 1)
        const weight = existingLog?.weight?.toString() || ''
        const reps = existingLog?.reps_completed?.toString() || ''
        const volume = calculateSetVolume(weight, reps)

        return {
          weight: weight || ex.weight || '',
          reps: reps,
          completed: !!existingLog,
          isWeightPR: existingLog ? (parseFloat(weight) > (exercisePRs?.weight || 0)) : false,
          isVolumePR: existingLog ? (volume > (exercisePRs?.volume || 0)) : false,
          setLogId: existingLog?.id || null,
        }
      })
    })
    return data
  }, [workoutDay.workout_exercises, setLogs, prMap])

  // State
  const [setsData, setSetsData] = useState<Record<string, SetData[]>>(initializeSetsData)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [showInfoFor, setShowInfoFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [newPRs, setNewPRs] = useState<Set<string>>(new Set())

  // Timer effect
  useEffect(() => {
    const startTime = new Date(workoutLog.started_at).getTime()
    const interval = setInterval(() => {
      const now = Date.now()
      setElapsedTime(Math.floor((now - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [workoutLog.started_at])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate totals
  const exercisesBySection = groupExercisesBySection(workoutDay.workout_exercises)
  const totalSets = Object.values(setsData).flat().length
  const completedSets = Object.values(setsData).flat().filter(s => s.completed).length
  const progress = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0
  const totalVolume = Object.values(setsData).reduce(
    (sum, sets) => sum + calculateExerciseVolume(sets),
    0
  )

  // Handlers
  const handleSetChange = (exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string) => {
    setSetsData(prev => ({
      ...prev,
      [exerciseId]: prev[exerciseId].map((set, i) =>
        i === setIndex ? { ...set, [field]: value } : set
      ),
    }))
  }

  const handleAddSet = (exerciseId: string) => {
    setSetsData(prev => ({
      ...prev,
      [exerciseId]: [
        ...prev[exerciseId],
        {
          weight: prev[exerciseId][prev[exerciseId].length - 1]?.weight || '',
          reps: '',
          completed: false,
          isWeightPR: false,
          isVolumePR: false,
          setLogId: null,
        },
      ],
    }))
  }

  const handleSetComplete = async (exerciseId: string, setIndex: number, exercise: WorkoutExercise) => {
    const setData = setsData[exerciseId][setIndex]
    const weight = parseFloat(setData.weight) || 0
    const reps = parseInt(setData.reps) || 0
    const volume = weight * reps

    if (!weight || !reps) return

    setSaving(true)

    try {
      // Check for PRs
      const exercisePRs = prMap.get(exercise.exercises.id) || { weight: 0, volume: 0 }
      const isWeightPR = weight > exercisePRs.weight
      const isVolumePR = volume > exercisePRs.volume

      // Save or update set log
      let setLogId = setData.setLogId

      if (setLogId) {
        await supabase
          .from('set_logs')
          .update({
            weight: weight,
            reps_completed: reps,
          })
          .eq('id', setLogId)
      } else {
        const { data: newLog } = await supabase
          .from('set_logs')
          .insert({
            workout_log_id: workoutLog.id,
            workout_exercise_id: exerciseId,
            set_number: setIndex + 1,
            weight: weight,
            reps_completed: reps,
            is_bodyweight: !weight,
          })
          .select()
          .single()

        setLogId = newLog?.id || null
      }

      // Save PRs if achieved
      if (isWeightPR) {
        await supabase
          .from('personal_records')
          .upsert({
            user_id: userId,
            exercise_id: exercise.exercises.id,
            record_type: 'weight',
            value: weight,
            set_log_id: setLogId,
            achieved_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,exercise_id,record_type',
          })

        // Update local PR map
        const existing = prMap.get(exercise.exercises.id) || { weight: 0, volume: 0 }
        existing.weight = weight
        prMap.set(exercise.exercises.id, existing)

        // Track new PR for celebration
        setNewPRs(prev => new Set(prev).add(`${exerciseId}-${setIndex}-weight`))
      }

      if (isVolumePR) {
        await supabase
          .from('personal_records')
          .upsert({
            user_id: userId,
            exercise_id: exercise.exercises.id,
            record_type: 'volume',
            value: volume,
            set_log_id: setLogId,
            achieved_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,exercise_id,record_type',
          })

        // Update local PR map
        const existing = prMap.get(exercise.exercises.id) || { weight: 0, volume: 0 }
        existing.volume = volume
        prMap.set(exercise.exercises.id, existing)

        setNewPRs(prev => new Set(prev).add(`${exerciseId}-${setIndex}-volume`))
      }

      // Update local state
      setSetsData(prev => ({
        ...prev,
        [exerciseId]: prev[exerciseId].map((set, i) =>
          i === setIndex
            ? { ...set, completed: true, isWeightPR, isVolumePR, setLogId }
            : set
        ),
      }))
    } catch (error) {
      console.error('Error saving set:', error)
    }

    setSaving(false)
  }

  const handleCompleteWorkout = async () => {
    setCompleting(true)

    await supabase
      .from('workout_logs')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', workoutLog.id)

    router.push('/workouts')
    router.refresh()
  }

  // Check if any exercise has a new PR
  const exerciseHasPR = (exerciseId: string) => {
    return setsData[exerciseId]?.some(s => s.isWeightPR || s.isVolumePR)
  }

  // Continue in next part...
```

**Note:** This is Part 1. Continue to Task 6 for the JSX rendering.

**Step 2: Commit (after completing all parts)**

Wait until Task 7 is complete before committing.

---

## Task 6: Rewrite WorkoutDayClient - Part 2 (JSX Render)

**Files:**
- Continue modifying: `src/app/(client)/workouts/[dayId]/WorkoutDayClient.tsx`

**Step 1: Add the return statement with JSX (append to the component)**

```typescript
  // ============================================
  // RENDER
  // ============================================

  return (
    <div
      className="min-h-screen pb-32"
      style={{ background: colors.bgGradient }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl border-b"
        style={{
          background: `${colors.bgCard}`,
          borderColor: colors.border,
        }}
      >
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/workouts"
                className="flex items-center justify-center w-11 h-11 rounded-xl border transition-all hover:scale-105"
                style={{
                  background: colors.bgGlass,
                  borderColor: colors.border,
                }}
              >
                <svg className="w-5 h-5" style={{ color: colors.textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <p className="text-sm" style={{ color: colors.textMuted }}>
                  {programName}
                </p>
                <p className="text-xs" style={{ color: colors.textMuted }}>
                  Week {weekNumber} · Day {workoutDay.day_number} · {formatTime(elapsedTime)}
                </p>
              </div>
            </div>

            {/* Progress Ring */}
            <div className="relative w-14 h-14">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  strokeWidth="4"
                  fill="none"
                  style={{ stroke: colors.borderLight }}
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  style={{
                    stroke: colors.purple,
                    strokeDasharray: 150.8,
                    strokeDashoffset: 150.8 - (150.8 * progress) / 100,
                    transition: 'stroke-dashoffset 0.5s ease',
                  }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                style={{ color: colors.text }}
              >
                {progress}%
              </span>
            </div>
          </div>

          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: colors.text }}
          >
            {workoutDay.name}
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Total Volume Card */}
        <div
          className="p-5 rounded-2xl border"
          style={{
            background: colors.cardGradient,
            borderColor: colors.border,
            boxShadow: colors.shadowMd,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-wider mb-1"
                style={{ color: colors.textMuted }}
              >
                Total Volume
              </p>
              <p
                className="text-3xl font-extrabold"
                style={{
                  background: colors.purpleGradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {formatVolume(totalVolume)} lbs
              </p>
            </div>
            {totalVolume > 0 && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl"
                style={{
                  background: colors.greenGradient,
                  boxShadow: colors.shadowGreen,
                }}
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-sm font-bold text-white">
                  {completedSets}/{totalSets}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Sections */}
        {sectionOrder.map(sectionKey => {
          const exercises = exercisesBySection[sectionKey]
          if (!exercises || exercises.length === 0) return null

          return (
            <div key={sectionKey} className="space-y-3">
              {/* Section Header */}
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-sm"
                  style={{
                    background: colors.purpleGradient,
                    boxShadow: colors.shadowPurple,
                  }}
                >
                  {sectionIcons[sectionKey]}
                </div>
                <span
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: colors.textSecondary }}
                >
                  {sectionLabels[sectionKey]}
                </span>
              </div>

              {/* Exercise Cards */}
              {exercises.map(ex => {
                const sets = setsData[ex.id] || []
                const isExpanded = expandedExercise === ex.id
                const showInfo = showInfoFor === ex.id
                const hasPR = exerciseHasPR(ex.id)
                const exerciseVolume = calculateExerciseVolume(sets)

                return (
                  <div
                    key={ex.id}
                    className={`rounded-2xl border overflow-hidden transition-all duration-300 ${hasPR ? 'animate-pr-glow' : ''}`}
                    style={{
                      background: colors.bgCard,
                      borderColor: hasPR ? colors.borderGlow : colors.border,
                      boxShadow: hasPR ? colors.shadowPurple : colors.shadowSm,
                    }}
                  >
                    {/* PR Badge */}
                    {hasPR && (
                      <div className="px-4 pt-4">
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white animate-celebrate"
                          style={{
                            background: colors.amberGradient,
                            boxShadow: colors.shadowAmber,
                          }}
                        >
                          🏆 NEW PR!
                        </span>
                      </div>
                    )}

                    {/* Exercise Header */}
                    <button
                      onClick={() => setExpandedExercise(isExpanded ? null : ex.id)}
                      className="w-full p-4 flex items-start justify-between text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {ex.label && (
                            <span
                              className="text-xs font-bold px-2 py-0.5 rounded"
                              style={{
                                background: colors.purpleLight,
                                color: colors.purple,
                              }}
                            >
                              {ex.label}
                            </span>
                          )}
                          <h3
                            className="text-lg font-bold"
                            style={{ color: colors.text }}
                          >
                            {ex.exercises.name}
                          </h3>
                        </div>
                        <p className="text-sm" style={{ color: colors.textMuted }}>
                          {ex.sets} sets · {ex.reps} reps
                          {ex.rpe && (
                            <span
                              className="ml-2 px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                background: colors.amberLight,
                                color: colors.amber,
                              }}
                            >
                              RPE {ex.rpe}
                            </span>
                          )}
                        </p>
                      </div>
                      <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        style={{ color: colors.textMuted }}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-4 animate-expand-in">
                        {/* Info/Demo Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowInfoFor(showInfo ? null : ex.id)}
                            className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all"
                            style={{
                              background: showInfo ? colors.purpleGradient : colors.bgTertiary,
                              color: showInfo ? '#fff' : colors.textSecondary,
                              boxShadow: showInfo ? colors.shadowPurple : 'none',
                            }}
                          >
                            Info
                          </button>
                          {ex.exercises.demo_url && (
                            <a
                              href={ex.exercises.demo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-center transition-all"
                              style={{
                                background: colors.bgTertiary,
                                color: colors.textSecondary,
                              }}
                            >
                              Demo
                            </a>
                          )}
                        </div>

                        {/* Exercise Info Panel */}
                        {showInfo && (
                          <div className="space-y-3 animate-expand-in">
                            {/* Target Muscles */}
                            {ex.exercises.muscle_groups && ex.exercises.muscle_groups.length > 0 && (
                              <div>
                                <p
                                  className="text-xs font-bold uppercase tracking-wider mb-2"
                                  style={{ color: colors.purple }}
                                >
                                  Target Muscles
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {ex.exercises.muscle_groups.map((muscle, i) => (
                                    <span
                                      key={muscle}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                                      style={{
                                        background: i === 0 ? colors.purpleGradient : colors.bgTertiary,
                                        color: i === 0 ? '#fff' : colors.textSecondary,
                                        boxShadow: i === 0 ? colors.shadowPurple : 'none',
                                      }}
                                    >
                                      {muscle.toUpperCase()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Coaching Cues */}
                            {ex.exercises.cues && (
                              <div
                                className="p-4 rounded-xl"
                                style={{ background: colors.bgTertiary }}
                              >
                                <p
                                  className="text-xs font-bold uppercase tracking-wider mb-2"
                                  style={{ color: colors.purple }}
                                >
                                  Coaching Cues
                                </p>
                                <ul className="space-y-2">
                                  {ex.exercises.cues.split('\n').filter(Boolean).map((cue, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <span
                                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                                        style={{ background: colors.purpleGradient }}
                                      />
                                      <span
                                        className="text-sm"
                                        style={{ color: colors.textSecondary }}
                                      >
                                        {cue}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Coach Note */}
                        {ex.notes && (
                          <div
                            className="p-4 rounded-xl border-l-4"
                            style={{
                              background: colors.bgTertiary,
                              borderColor: colors.purple,
                            }}
                          >
                            <p className="text-xs font-bold mb-1" style={{ color: colors.purple }}>
                              Coach Note
                            </p>
                            <p className="text-sm" style={{ color: colors.textSecondary }}>
                              {ex.notes}
                            </p>
                          </div>
                        )}

                        {/* Set Rows */}
                        <div className="space-y-2">
                          <div
                            className="grid grid-cols-4 gap-2 px-2 text-xs font-bold uppercase tracking-wider"
                            style={{ color: colors.textMuted }}
                          >
                            <span>Set</span>
                            <span>Weight</span>
                            <span>Reps</span>
                            <span></span>
                          </div>

                          {sets.map((set, i) => (
                            <div
                              key={i}
                              className="grid grid-cols-4 gap-2 items-center p-3 rounded-xl transition-all"
                              style={{
                                background: set.completed ? colors.greenLight : colors.bgTertiary,
                                border: `1px solid ${set.completed ? colors.green + '30' : 'transparent'}`,
                              }}
                            >
                              {/* Set Number / Check */}
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                                style={{
                                  background: set.completed ? colors.greenGradient : colors.bgGlass,
                                  border: set.completed ? 'none' : `2px solid ${colors.border}`,
                                  color: set.completed ? '#fff' : colors.textMuted,
                                  boxShadow: set.completed ? colors.shadowGreen : 'none',
                                }}
                              >
                                {set.completed ? (
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  i + 1
                                )}
                              </div>

                              {/* Weight Input */}
                              <div
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg"
                                style={{
                                  background: colors.bgInput,
                                  border: `1px solid ${colors.border}`,
                                }}
                              >
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={set.weight}
                                  onChange={(e) => handleSetChange(ex.id, i, 'weight', e.target.value)}
                                  placeholder="0"
                                  disabled={set.completed}
                                  className="w-12 bg-transparent text-center font-bold disabled:opacity-50 focus:outline-none"
                                  style={{ color: colors.text }}
                                />
                                <span className="text-xs" style={{ color: colors.textMuted }}>
                                  lbs
                                </span>
                              </div>

                              {/* Reps Input */}
                              <div
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg"
                                style={{
                                  background: colors.bgInput,
                                  border: `1px solid ${colors.border}`,
                                }}
                              >
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={set.reps}
                                  onChange={(e) => handleSetChange(ex.id, i, 'reps', e.target.value)}
                                  placeholder="0"
                                  disabled={set.completed}
                                  className="w-8 bg-transparent text-center font-bold disabled:opacity-50 focus:outline-none"
                                  style={{ color: colors.text }}
                                />
                                <span className="text-xs" style={{ color: colors.textMuted }}>
                                  reps
                                </span>
                              </div>

                              {/* Log Button / Trophy */}
                              {set.completed ? (
                                (set.isWeightPR || set.isVolumePR) ? (
                                  <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center animate-float"
                                    style={{
                                      background: colors.amberGradient,
                                      boxShadow: colors.shadowAmber,
                                    }}
                                  >
                                    <span className="text-lg">🏆</span>
                                  </div>
                                ) : (
                                  <div className="w-10 h-10" />
                                )
                              ) : (
                                <button
                                  onClick={() => handleSetComplete(ex.id, i, ex)}
                                  disabled={saving || !set.weight || !set.reps}
                                  className="w-full py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
                                  style={{
                                    background: colors.purpleGradient,
                                    boxShadow: colors.shadowPurple,
                                  }}
                                >
                                  Log
                                </button>
                              )}
                            </div>
                          ))}

                          {/* Add Set Button */}
                          <button
                            onClick={() => handleAddSet(ex.id)}
                            className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-semibold transition-all hover:border-solid"
                            style={{
                              borderColor: colors.border,
                              color: colors.textMuted,
                            }}
                          >
                            + Add Set
                          </button>
                        </div>

                        {/* Exercise Volume */}
                        {exerciseVolume > 0 && (
                          <div
                            className="flex items-center justify-between p-4 rounded-xl"
                            style={{ background: colors.bgTertiary }}
                          >
                            <div>
                              <p className="text-xs uppercase tracking-wider" style={{ color: colors.textMuted }}>
                                Exercise Volume
                              </p>
                              <p
                                className="text-xl font-extrabold"
                                style={{
                                  background: colors.purpleGradient,
                                  WebkitBackgroundClip: 'text',
                                  WebkitTextFillColor: 'transparent',
                                }}
                              >
                                {formatVolume(exerciseVolume)} lbs
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </main>

      {/* Complete Workout Button */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4"
        style={{
          background: `linear-gradient(to top, ${colors.bg} 80%, transparent)`,
        }}
      >
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleCompleteWorkout}
            disabled={completing || completedSets === 0}
            className="w-full py-5 rounded-2xl text-lg font-bold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{
              background: colors.purpleGradient,
              boxShadow: colors.shadowPurple,
            }}
          >
            {completing ? (
              'Completing...'
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Complete Workout
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify file is complete**

The file should now have:
- Imports
- Type definitions
- Constants
- Helper functions
- Main component with all state and handlers
- Full JSX render

---

## Task 7: Commit WorkoutDayClient

**Step 1: Commit the complete rewrite**

```bash
git add src/app/\(client\)/workouts/\[dayId\]/WorkoutDayClient.tsx
git commit -m "feat: premium workout tracker with volume tracking and PR detection"
```

---

## Task 8: Test the Implementation

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to a workout**

1. Log in as a client
2. Go to `/workouts`
3. Start a workout
4. Verify:
   - Premium styling appears (purple gradients, glassmorphism)
   - Timer is running
   - Progress ring updates
   - Exercises expand/collapse
   - Can log sets with weight/reps
   - Volume calculates correctly
   - Can add extra sets
   - PR badges appear when beating previous records
   - Complete workout works

**Step 3: Test PR detection**

1. Log a set with weight higher than any previous
2. Verify "NEW PR!" badge appears
3. Verify trophy icon appears on the set row
4. Check `personal_records` table has new entry

---

## Task 9: Final Commit

**Step 1: If all tests pass, create final commit**

```bash
git add -A
git commit -m "feat: complete premium workout tracker implementation

- Extended useColors with premium theme (gradients, shadows, glassmorphism)
- Added float, celebrate, pr-glow animations
- Rewrote WorkoutDayClient with premium UI
- Added volume tracking (total + per-exercise)
- Added dual PR detection (weight + volume)
- Added add-set functionality
- Preserved all existing functionality"
```

---

## Deferred: Add Extra Exercises

**Reminder:** User wants to add ability for clients to add exercises beyond the programmed workout. This will require:

1. Exercise picker modal (reuse from coach's ExerciseBrowserModal)
2. "Add Exercise" button at bottom of each section
3. New database table or field to store ad-hoc exercises in workout_logs
4. UI to display and log sets for added exercises

Implement in a future iteration.
