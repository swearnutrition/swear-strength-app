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
