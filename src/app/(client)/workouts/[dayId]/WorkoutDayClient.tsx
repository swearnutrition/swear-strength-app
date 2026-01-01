'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useColors } from '@/hooks/useColors'

// ============================================
// VIDEO MODAL COMPONENT
// ============================================

function VideoModal({
  url,
  exerciseName,
  onClose,
  colors
}: {
  url: string
  exerciseName: string
  onClose: () => void
  colors: ReturnType<typeof useColors>
}) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Determine if it's a YouTube/Vimeo embed or direct video
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')
  const isVimeo = url.includes('vimeo.com')

  let embedUrl = url
  if (isYouTube) {
    const videoId = url.includes('youtu.be')
      ? url.split('/').pop()?.split('?')[0]
      : new URLSearchParams(url.split('?')[1]).get('v')
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`
  } else if (isVimeo) {
    const videoId = url.split('/').pop()?.split('?')[0]
    embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1`
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal Content */}
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
        style={{ background: colors.bgCard }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: colors.border }}
        >
          <h3 className="font-bold" style={{ color: colors.text }}>
            {exerciseName}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: colors.bgTertiary }}
          >
            <svg className="w-5 h-5" style={{ color: colors.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Container */}
        <div className="aspect-video bg-black w-full">
          {isYouTube || isVimeo ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              style={{ minHeight: '300px' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={url}
              controls
              autoPlay
              className="w-full h-full"
              style={{ minHeight: '300px' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// TYPES
// ============================================

type LoggingType = 'weight_reps' | 'reps_only' | 'duration' | 'distance' | 'weight_duration'

interface Exercise {
  id: string
  name: string
  equipment: string | null
  muscle_groups: string[]
  demo_url: string | null
  cues: string | null
  purpose: string | null
  logging_type: LoggingType | null
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
  cardio_notes: string | null
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

interface ExerciseHistoryEntry {
  exercise_id: string
  workout_exercise_id: string
  set_number: number
  weight: number | null
  reps_completed: number | null
  completed_at: string
  notes: string | null
}

interface ClientExerciseNote {
  id: string
  user_id: string
  exercise_id: string
  content: string
  created_at: string
  updated_at: string
}

interface WorkoutDayClientProps {
  workoutDay: WorkoutDay
  workoutLog: WorkoutLog
  setLogs: SetLog[]
  personalRecords: PersonalRecord[]
  exerciseHistory: ExerciseHistoryEntry[]
  clientExerciseNotes: ClientExerciseNote[]
  programName: string
  weekNumber: number
  userId: string
  isViewingCompleted?: boolean
}

interface SetData {
  weight: string
  reps: string
  completed: boolean
  isWeightPR: boolean
  isVolumePR: boolean
  setLogId: string | null
  prefilledFromHistory?: boolean
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

// Generate progressive overload suggestion based on last session
// Logic: Always suggest +1-2 reps first. Only suggest adding weight once
// the user has hit high rep ranges consistently (12+ reps).
const getProgressiveSuggestion = (weight: string, reps: string, loggingType: LoggingType | null): string | null => {
  const r = parseInt(reps) || 0

  if (loggingType === 'reps_only' || loggingType === 'duration') {
    // For bodyweight/duration exercises, always suggest adding reps/time
    if (r > 0) {
      return `+1-2`
    }
  } else if (loggingType === 'weight_reps' || loggingType === 'weight_duration' || !loggingType) {
    // For weighted exercises:
    // Only suggest adding weight if reps are already high (12+)
    // Otherwise, focus on adding reps first
    if (r >= 12) {
      return `+2.5-5 lbs`
    } else if (r > 0) {
      return `+1-2 reps`
    }
  }

  return null
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
  exerciseHistory,
  clientExerciseNotes,
  programName,
  weekNumber,
  userId,
  isViewingCompleted = false,
}: WorkoutDayClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const colors = useColors()

  // Build PR lookup map
  const prMap = useMemo(() => {
    const map = new Map<string, { weight: number; volume: number }>()
    personalRecords.forEach(pr => {
      const existing = map.get(pr.exercise_id) || { weight: 0, volume: 0 }
      if (pr.record_type === 'weight') {
        existing.weight = pr.value
      } else if (pr.record_type === 'volume') {
        existing.volume = pr.value
      }
      map.set(pr.exercise_id, existing)
    })
    return map
  }, [personalRecords])

  // Build exercise history map for quick lookup (needed for initialization)
  const exerciseHistoryMap = useMemo(() => {
    const map = new Map<string, ExerciseHistoryEntry[]>()
    exerciseHistory.forEach(entry => {
      const existing = map.get(entry.exercise_id) || []
      existing.push(entry)
      map.set(entry.exercise_id, existing)
    })
    return map
  }, [exerciseHistory])

  // Get last session's sets for an exercise
  const getLastSessionSets = useCallback((exerciseId: string) => {
    const history = exerciseHistoryMap.get(exerciseId) || []
    if (history.length === 0) return null

    // Group by date and get most recent session
    const sessionsByDate = new Map<string, ExerciseHistoryEntry[]>()
    history.forEach(entry => {
      const date = new Date(entry.completed_at).toDateString()
      const existing = sessionsByDate.get(date) || []
      existing.push(entry)
      sessionsByDate.set(date, existing)
    })

    const sortedSessions = Array.from(sessionsByDate.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())

    if (sortedSessions.length === 0) return null
    return sortedSessions[0][1].sort((a, b) => a.set_number - b.set_number)
  }, [exerciseHistoryMap])

  // Initialize sets data from existing logs OR pre-fill from last session
  const initializeSetsData = useCallback(() => {
    const data: Record<string, SetData[]> = {}
    workoutDay.workout_exercises.forEach(ex => {
      const numSets = parseInt(ex.sets?.split('-')[0] || '3', 10)
      const existingLogs = setLogs.filter(log => log.workout_exercise_id === ex.id)
      const exercisePRs = prMap.get(ex.exercises.id)
      const lastSession = getLastSessionSets(ex.exercises.id)

      data[ex.id] = Array.from({ length: numSets }, (_, i) => {
        const existingLog = existingLogs.find(log => log.set_number === i + 1)

        // If we have an existing log for this workout, use it
        if (existingLog) {
          const weight = existingLog.weight?.toString() || ''
          const reps = existingLog.reps_completed?.toString() || ''
          const volume = calculateSetVolume(weight, reps)

          return {
            weight: weight,
            reps: reps,
            completed: true,
            isWeightPR: parseFloat(weight) > (exercisePRs?.weight || 0),
            isVolumePR: volume > (exercisePRs?.volume || 0),
            setLogId: existingLog.id,
          }
        }

        // Otherwise, pre-fill from last session if available
        const lastSessionSet = lastSession?.find(s => s.set_number === i + 1)
        if (lastSessionSet) {
          return {
            weight: lastSessionSet.weight?.toString() || ex.weight || '',
            reps: lastSessionSet.reps_completed?.toString() || '',
            completed: false,
            isWeightPR: false,
            isVolumePR: false,
            setLogId: null,
            prefilledFromHistory: true,
          }
        }

        // Fallback to prescription weight or empty
        return {
          weight: ex.weight || '',
          reps: '',
          completed: false,
          isWeightPR: false,
          isVolumePR: false,
          setLogId: null,
          prefilledFromHistory: false,
        }
      })
    })
    return data
  }, [workoutDay.workout_exercises, setLogs, prMap, getLastSessionSets])

  // State
  const [setsData, setSetsData] = useState<Record<string, SetData[]>>(initializeSetsData)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [showInfoFor, setShowInfoFor] = useState<string | null>(null)
  const [_saving, _setSaving] = useState(false) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [completing, _setCompleting] = useState(false) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [deleting, setDeleting] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [newPRs, setNewPRs] = useState<Set<string>>(new Set())
  const [prToast, setPrToast] = useState<{ type: 'weight' | 'volume'; value: number; exerciseName: string } | null>(null)
  const [videoModal, setVideoModal] = useState<{ url: string; name: string } | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Exercise notes state
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>(() => {
    const notes: Record<string, string> = {}
    clientExerciseNotes.forEach(note => {
      notes[note.exercise_id] = note.content
    })
    return notes
  })
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Completion feedback state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackDifficulty, setFeedbackDifficulty] = useState<number | null>(null)
  const [feedbackEnergy, setFeedbackEnergy] = useState<string | null>(null)
  const [feedbackFeeling, setFeedbackFeeling] = useState<number | null>(null)
  const [feedbackNotes, setFeedbackNotes] = useState('')
  const [feedbackCardioCompleted, setFeedbackCardioCompleted] = useState<boolean | null>(null)
  const [savingFeedback, setSavingFeedback] = useState(false)

  // Notes modal state
  const [notesHistoryModal, setNotesHistoryModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null)

  // Auto-save refs and state
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({})
  const [savingIndicator, setSavingIndicator] = useState<Record<string, boolean>>({})
  const pendingSavesRef = useRef<Set<string>>(new Set())

  // Timer effect - only run for active workouts
  useEffect(() => {
    if (isViewingCompleted) {
      // For completed workouts, calculate the total duration
      if (workoutLog.completed_at) {
        const start = new Date(workoutLog.started_at).getTime()
        const end = new Date(workoutLog.completed_at).getTime()
        setElapsedTime(Math.floor((end - start) / 1000))
      }
      return
    }

    const startTime = new Date(workoutLog.started_at).getTime()
    const interval = setInterval(() => {
      const now = Date.now()
      setElapsedTime(Math.floor((now - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [workoutLog.started_at, workoutLog.completed_at, isViewingCompleted])

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

  // Auto-save a set to the database
  const autoSaveSet = useCallback(async (
    exerciseId: string,
    setIndex: number,
    exercise: WorkoutExercise,
    setData: SetData
  ) => {
    const weight = parseFloat(setData.weight) || 0
    const reps = parseInt(setData.reps) || 0
    const logType = exercise.exercises.logging_type || 'weight_reps'

    // Don't save if nothing is filled (based on logging type)
    const hasData = (() => {
      switch (logType) {
        case 'reps_only':
        case 'duration':
        case 'distance':
          return reps > 0
        case 'weight_duration':
        case 'weight_reps':
        default:
          return weight > 0 || reps > 0
      }
    })()

    if (!hasData) return

    const saveKey = `${exerciseId}-${setIndex}`
    pendingSavesRef.current.add(saveKey)
    setSavingIndicator(prev => ({ ...prev, [saveKey]: true }))

    try {
      const volume = weight * reps
      const exercisePRs = prMap.get(exercise.exercises.id) || { weight: 0, volume: 0 }
      // Only track PRs for weight-based exercises
      const isWeightPR = logType === 'weight_reps' && weight > exercisePRs.weight && weight > 0
      const isVolumePR = logType === 'weight_reps' && volume > exercisePRs.volume && volume > 0

      let setLogId = setData.setLogId

      if (setLogId) {
        // Update existing log
        await supabase
          .from('set_logs')
          .update({
            weight: weight || null,
            reps_completed: reps || null,
          })
          .eq('id', setLogId)
      } else {
        // Create new log
        const { data: newLog } = await supabase
          .from('set_logs')
          .insert({
            workout_log_id: workoutLog.id,
            workout_exercise_id: exerciseId,
            set_number: setIndex + 1,
            weight: weight || null,
            reps_completed: reps || null,
            is_bodyweight: logType === 'reps_only' || !weight,
          })
          .select()
          .single()

        setLogId = newLog?.id || null
      }

      // Mark as completed based on logging type
      const isComplete = (() => {
        switch (logType) {
          case 'reps_only':
          case 'duration':
          case 'distance':
            return reps > 0
          case 'weight_duration':
            return weight > 0 && reps > 0
          case 'weight_reps':
          default:
            return weight > 0 && reps > 0
        }
      })()

      // Save PRs if achieved and set is complete
      if (isComplete && isWeightPR) {
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

        const existing = prMap.get(exercise.exercises.id) || { weight: 0, volume: 0 }
        existing.weight = weight
        prMap.set(exercise.exercises.id, existing)

        setNewPRs(prev => new Set(prev).add(`${exerciseId}-${setIndex}-weight`))

        // Show PR toast
        setPrToast({
          type: 'weight',
          value: weight,
          exerciseName: exercise.exercises.name || 'Exercise'
        })
        // Auto-hide after 3 seconds
        setTimeout(() => setPrToast(null), 3000)
      }

      if (isComplete && isVolumePR) {
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

        const existing = prMap.get(exercise.exercises.id) || { weight: 0, volume: 0 }
        existing.volume = volume
        prMap.set(exercise.exercises.id, existing)

        setNewPRs(prev => new Set(prev).add(`${exerciseId}-${setIndex}-volume`))

        // Show PR toast (only if not already showing weight PR)
        if (!isWeightPR) {
          setPrToast({
            type: 'volume',
            value: volume,
            exerciseName: exercise.exercises.name || 'Exercise'
          })
          // Auto-hide after 3 seconds
          setTimeout(() => setPrToast(null), 3000)
        }
      }

      // Update local state with saved data
      setSetsData(prev => ({
        ...prev,
        [exerciseId]: prev[exerciseId].map((set, i) =>
          i === setIndex
            ? {
                ...set,
                completed: isComplete,
                isWeightPR: isComplete && isWeightPR,
                isVolumePR: isComplete && isVolumePR,
                setLogId,
              }
            : set
        ),
      }))
    } catch (error) {
      console.error('Auto-save error:', error)
    } finally {
      pendingSavesRef.current.delete(saveKey)
      setSavingIndicator(prev => ({ ...prev, [saveKey]: false }))
    }
  }, [supabase, workoutLog.id, userId, prMap])

  // Handlers
  const handleSetChange = (
    exerciseId: string,
    setIndex: number,
    field: 'weight' | 'reps',
    value: string,
    exercise: WorkoutExercise
  ) => {
    // Update local state immediately
    setSetsData(prev => {
      const newData = {
        ...prev,
        [exerciseId]: prev[exerciseId].map((set, i) =>
          i === setIndex ? { ...set, [field]: value } : set
        ),
      }

      // Schedule auto-save with debounce
      const saveKey = `${exerciseId}-${setIndex}`
      if (saveTimeoutRef.current[saveKey]) {
        clearTimeout(saveTimeoutRef.current[saveKey])
      }

      saveTimeoutRef.current[saveKey] = setTimeout(() => {
        const currentSet = newData[exerciseId][setIndex]
        autoSaveSet(exerciseId, setIndex, exercise, currentSet)
      }, 800) // 800ms debounce

      return newData
    })
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

  const handleCompleteWorkout = async () => {
    // Show feedback modal instead of completing immediately
    setShowFeedbackModal(true)
  }

  const handleSubmitFeedback = async (skip: boolean = false) => {
    setSavingFeedback(true)

    try {
      // Mark workout as complete
      await supabase
        .from('workout_logs')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', workoutLog.id)

      // Save feedback if not skipping and at least one field is filled (or cardio was tracked)
      const hasCardio = workoutDay.cardio_notes && feedbackCardioCompleted !== null
      if (!skip && (feedbackDifficulty || feedbackEnergy || feedbackFeeling || feedbackNotes || hasCardio)) {
        await supabase.from('workout_completions').insert({
          workout_log_id: workoutLog.id,
          difficulty_rating: feedbackDifficulty,
          energy_level: feedbackEnergy,
          feeling: feedbackFeeling,
          notes: feedbackNotes || null,
          cardio_completed: hasCardio ? feedbackCardioCompleted : null,
        })
      }

      router.push('/workouts')
      router.refresh()
    } catch (error) {
      console.error('Error completing workout:', error)
      setSavingFeedback(false)
    }
  }

  const handleDeleteWorkout = async () => {
    setDeleting(true)

    // Delete the workout log (set_logs will cascade delete)
    await supabase
      .from('workout_logs')
      .delete()
      .eq('id', workoutLog.id)

    router.push('/workouts')
    router.refresh()
  }

  const handleSaveNote = async (exerciseId: string) => {
    setSavingNote(true)

    try {
      // Upsert the note (insert or update)
      await supabase
        .from('client_exercise_notes')
        .upsert({
          user_id: userId,
          exercise_id: exerciseId,
          content: noteInput,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,exercise_id',
        })

      // Update local state
      setExerciseNotes(prev => ({
        ...prev,
        [exerciseId]: noteInput,
      }))
      setEditingNoteFor(null)
      setNoteInput('')
    } catch (error) {
      console.error('Error saving note:', error)
    }

    setSavingNote(false)
  }

  const startEditingNote = (exerciseId: string) => {
    setNoteInput(exerciseNotes[exerciseId] || '')
    setEditingNoteFor(exerciseId)
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
      {/* PR Toast Notification */}
      {prToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-slide-down-bounce">
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl"
            style={{
              background: colors.amberGradient,
              boxShadow: `0 10px 40px -10px ${colors.amber}80`,
            }}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20">
              <span className="text-lg">🏆</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                {prToast.type === 'weight' ? 'Heaviest Weight' : 'Best Volume'}
              </p>
              <p className="text-lg font-bold text-white">
                {prToast.value.toLocaleString()} lbs
              </p>
            </div>
            <button
              onClick={() => setPrToast(null)}
              className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <svg className="w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
                  Week {weekNumber} · Day {workoutDay.day_number} · {isViewingCompleted ? `${formatTime(elapsedTime)} total` : formatTime(elapsedTime)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Completed Badge or Delete Button */}
              {isViewingCompleted ? (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: colors.greenLight }}
                >
                  <svg className="w-4 h-4" style={{ color: colors.green }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-semibold" style={{ color: colors.green }}>
                    Completed
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center w-11 h-11 rounded-xl border transition-all hover:scale-105"
                  style={{
                    background: colors.bgGlass,
                    borderColor: colors.border,
                  }}
                >
                  <svg className="w-5 h-5" style={{ color: colors.red || '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}

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

                // Get exercise-level progressive suggestion
                const lastSession = getLastSessionSets(ex.exercises.id)
                const hasProgressiveSuggestion = lastSession && lastSession.length > 0 && !isViewingCompleted
                const exerciseSuggestion = hasProgressiveSuggestion && lastSession[0]
                  ? getProgressiveSuggestion(
                      lastSession[0].weight?.toString() || '',
                      lastSession[0].reps_completed?.toString() || '',
                      ex.exercises.logging_type
                    )
                  : null

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
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-sm" style={{ color: colors.textMuted }}>
                            {ex.sets} sets · {ex.reps} reps
                          </span>
                          {ex.rpe && (
                            <span
                              className="px-2 py-0.5 rounded text-xs font-bold"
                              style={{
                                background: colors.greenLight,
                                color: colors.green,
                                border: `1px solid ${colors.green}40`,
                              }}
                            >
                              @ RPE {ex.rpe}
                            </span>
                          )}
                          {exerciseSuggestion && (
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                              style={{
                                background: colors.greenLight,
                                color: colors.green,
                              }}
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              Try {exerciseSuggestion}
                            </span>
                          )}
                        </div>
                        {/* Muscle Groups */}
                        {ex.exercises.muscle_groups && ex.exercises.muscle_groups.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1">
                            {ex.exercises.muscle_groups.slice(0, 3).map((muscle, idx) => (
                              <span
                                key={muscle}
                                className="text-xs font-medium px-2 py-0.5 rounded"
                                style={{
                                  background: idx === 0 ? colors.blue : colors.bgTertiary,
                                  color: idx === 0 ? '#fff' : colors.textSecondary,
                                }}
                              >
                                {muscle}
                              </span>
                            ))}
                          </div>
                        )}
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
                        {/* Coach Note Banner - show immediately when expanded */}
                        {ex.notes && (
                          <div
                            className="p-3 border-l-4"
                            style={{
                              background: colors.purpleLight,
                              borderColor: colors.purple,
                            }}
                          >
                            <span className="text-sm font-bold" style={{ color: colors.purple }}>
                              Coach Note:{' '}
                            </span>
                            <span className="text-sm" style={{ color: colors.textSecondary }}>
                              {ex.notes}
                            </span>
                          </div>
                        )}

                        {/* Info/Notes/Demo Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowInfoFor(showInfo ? null : ex.id)}
                            className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all"
                            style={{
                              background: showInfo ? colors.purple : colors.bgTertiary,
                              color: showInfo ? '#fff' : colors.textSecondary,
                            }}
                          >
                            Info
                          </button>
                          <button
                            onClick={() => setNotesHistoryModal({ exerciseId: ex.exercises.id, exerciseName: ex.exercises.name })}
                            className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-center transition-all flex items-center justify-center gap-2"
                            style={{
                              background: colors.bgTertiary,
                              color: colors.textSecondary,
                            }}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Notes
                            {exerciseNotes[ex.exercises.id] && (
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: colors.purple }}
                              />
                            )}
                          </button>
                          {ex.exercises.demo_url && (
                            <button
                              onClick={() => setVideoModal({ url: ex.exercises.demo_url!, name: ex.exercises.name })}
                              className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold text-center transition-all flex items-center justify-center gap-2"
                              style={{
                                background: colors.bgTertiary,
                                color: colors.textSecondary,
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Demo
                            </button>
                          )}
                        </div>

                        {/* Exercise Info Panel */}
                        {showInfo && (
                          <div className="space-y-3 animate-expand-in">
                            {/* Exercise Purpose */}
                            {ex.exercises.purpose && (
                              <div
                                className="p-4 rounded-xl border-l-4"
                                style={{
                                  background: colors.bgTertiary,
                                  borderColor: colors.purple,
                                }}
                              >
                                <p
                                  className="text-xs font-bold uppercase tracking-wider mb-2"
                                  style={{ color: colors.purple }}
                                >
                                  Purpose
                                </p>
                                <p className="text-sm leading-relaxed" style={{ color: colors.textSecondary }}>
                                  {ex.exercises.purpose}
                                </p>
                              </div>
                            )}

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

                        {/* Set Rows */}
                        <div className="space-y-2">
                          {/* Headers - vary based on logging type */}
                          {(() => {
                            const logType = ex.exercises.logging_type || 'weight_reps'
                            const lastSession = getLastSessionSets(ex.exercises.id)
                            const hasPrevious = lastSession && lastSession.length > 0

                            // Grid template: fixed width for Set (48px), Previous (auto), flexible inputs, fixed status (48px)
                            const getGridTemplate = (hasTwo: boolean) => {
                              if (hasPrevious) {
                                return hasTwo
                                  ? '48px minmax(60px, 1fr) 1fr 1fr 48px'  // Set, Previous, Input1, Input2, Status
                                  : '48px minmax(60px, 1fr) 1fr 48px'      // Set, Previous, Input, Status
                              }
                              return hasTwo
                                ? '48px 1fr 1fr 48px'  // Set, Input1, Input2, Status
                                : '48px 1fr 48px'      // Set, Input, Status
                            }

                            const isSimpleType = logType === 'reps_only' || logType === 'duration' || logType === 'distance'
                            const gridTemplate = getGridTemplate(!isSimpleType)

                            const getHeaderLabels = () => {
                              if (logType === 'reps_only') return ['Reps']
                              if (logType === 'duration') return ['Duration']
                              if (logType === 'distance') return ['Distance']
                              if (logType === 'weight_duration') return ['Weight', 'Duration']
                              return ['Weight', 'Reps'] // default: weight_reps
                            }

                            const labels = getHeaderLabels()

                            return (
                              <div
                                className="grid gap-2 px-3 text-xs font-bold uppercase tracking-wider items-center"
                                style={{
                                  color: colors.textMuted,
                                  gridTemplateColumns: gridTemplate,
                                }}
                              >
                                <span>Set</span>
                                {hasPrevious && <span className="text-center">Previous</span>}
                                {labels.map((label, idx) => (
                                  <span key={idx} className="text-center">{label}</span>
                                ))}
                                <span></span>
                              </div>
                            )
                          })()}

                          {sets.map((set, i) => {
                            const saveKey = `${ex.id}-${i}`
                            const isSaving = savingIndicator[saveKey]
                            const logType = ex.exercises.logging_type || 'weight_reps'
                            const lastSession = getLastSessionSets(ex.exercises.id)
                            const hasPrevious = lastSession && lastSession.length > 0
                            const previousSet = lastSession?.[i]

                            // Calculate grid template to match header
                            const isSimpleType = logType === 'reps_only' || logType === 'duration' || logType === 'distance'
                            const getGridTemplate = (hasTwo: boolean) => {
                              if (hasPrevious) {
                                return hasTwo
                                  ? '48px minmax(60px, 1fr) 1fr 1fr 48px'
                                  : '48px minmax(60px, 1fr) 1fr 48px'
                              }
                              return hasTwo
                                ? '48px 1fr 1fr 48px'
                                : '48px 1fr 48px'
                            }
                            const gridTemplate = getGridTemplate(!isSimpleType)

                            // Format previous set display
                            const formatPreviousSet = () => {
                              if (!previousSet) return '-'
                              if (logType === 'reps_only') {
                                return `${previousSet.reps_completed || 0} reps`
                              } else if (logType === 'duration') {
                                return `${previousSet.reps_completed || 0}s`
                              } else if (logType === 'distance') {
                                return `${previousSet.reps_completed || 0} mi`
                              } else if (logType === 'weight_duration') {
                                return `${previousSet.weight || 0} × ${previousSet.reps_completed || 0}s`
                              }
                              // weight_reps default
                              return `${previousSet.weight || 0} × ${previousSet.reps_completed || 0}`
                            }

                            return (
                              <div key={i} className="space-y-1">
                                <div
                                  className="grid gap-2 items-center p-3 rounded-xl transition-all"
                                  style={{
                                    background: colors.bgTertiary,
                                    border: `1px solid transparent`,
                                    gridTemplateColumns: gridTemplate,
                                  }}
                                >
                                {/* Set Number / Check */}
                                <div
                                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
                                  style={{
                                    background: set.completed ? colors.green : colors.bgGlass,
                                    border: set.completed ? 'none' : `2px solid ${colors.border}`,
                                    color: set.completed ? '#fff' : colors.textMuted,
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

                                {/* Previous Set Data */}
                                {hasPrevious && (
                                  <div
                                    className="text-xs font-medium text-center"
                                    style={{ color: colors.textMuted }}
                                  >
                                    {formatPreviousSet()}
                                  </div>
                                )}

                                {/* Weight Input - only for weight_reps and weight_duration */}
                                {(logType === 'weight_reps' || logType === 'weight_duration') && (
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
                                      onChange={(e) => handleSetChange(ex.id, i, 'weight', e.target.value, ex)}
                                      placeholder="0"
                                      className="w-12 bg-transparent text-center font-bold focus:outline-none"
                                      style={{ color: colors.text }}
                                      readOnly={isViewingCompleted}
                                      disabled={isViewingCompleted}
                                    />
                                    <span className="text-xs" style={{ color: colors.textMuted }}>
                                      lbs
                                    </span>
                                  </div>
                                )}

                                {/* Reps Input - for weight_reps and reps_only */}
                                {(logType === 'weight_reps' || logType === 'reps_only') && (
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
                                      onChange={(e) => handleSetChange(ex.id, i, 'reps', e.target.value, ex)}
                                      placeholder="0"
                                      className="w-8 bg-transparent text-center font-bold focus:outline-none"
                                      style={{ color: colors.text }}
                                      readOnly={isViewingCompleted}
                                      disabled={isViewingCompleted}
                                    />
                                    <span className="text-xs" style={{ color: colors.textMuted }}>
                                      reps
                                    </span>
                                  </div>
                                )}

                                {/* Duration Input - for duration and weight_duration */}
                                {(logType === 'duration' || logType === 'weight_duration') && (
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
                                      onChange={(e) => handleSetChange(ex.id, i, 'reps', e.target.value, ex)}
                                      placeholder="0"
                                      className="w-10 bg-transparent text-center font-bold focus:outline-none"
                                      style={{ color: colors.text }}
                                      readOnly={isViewingCompleted}
                                      disabled={isViewingCompleted}
                                    />
                                    <span className="text-xs" style={{ color: colors.textMuted }}>
                                      sec
                                    </span>
                                  </div>
                                )}

                                {/* Distance Input - for distance */}
                                {logType === 'distance' && (
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
                                      value={set.reps}
                                      onChange={(e) => handleSetChange(ex.id, i, 'reps', e.target.value, ex)}
                                      placeholder="0"
                                      className="w-12 bg-transparent text-center font-bold focus:outline-none"
                                      style={{ color: colors.text }}
                                      readOnly={isViewingCompleted}
                                      disabled={isViewingCompleted}
                                    />
                                    <span className="text-xs" style={{ color: colors.textMuted }}>
                                      mi
                                    </span>
                                  </div>
                                )}

                                {/* Status Indicator */}
                                <div className="w-10 h-10 flex items-center justify-center">
                                  {isSaving ? (
                                    // Saving spinner
                                    <div
                                      className="w-5 h-5 border-2 rounded-full animate-spin"
                                      style={{
                                        borderColor: colors.border,
                                        borderTopColor: colors.purple,
                                      }}
                                    />
                                  ) : (set.isWeightPR || set.isVolumePR) ? (
                                    // PR trophy - no background, just emoji
                                    <span className="text-xl animate-float">🏆</span>
                                  ) : set.completed ? (
                                    // Saved checkmark
                                    <svg className="w-5 h-5" style={{ color: colors.green }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            )
                          })}

                          {/* Add Set Button - hide when viewing completed */}
                          {!isViewingCompleted && (
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
                          )}
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

        {/* Cardio Notes Section */}
        {workoutDay.cardio_notes && (
          <div className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-8 h-8 rounded-lg text-sm"
                style={{
                  background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                  boxShadow: '0 4px 14px rgba(249, 115, 22, 0.25)',
                }}
              >
                ⚡
              </div>
              <span
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: colors.textSecondary }}
              >
                Cardio
              </span>
            </div>

            {/* Cardio Card */}
            <div
              className="rounded-2xl border p-4"
              style={{
                background: colors.bgCard,
                borderColor: colors.border,
                boxShadow: colors.shadowSm,
              }}
            >
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: colors.text }}
              >
                {workoutDay.cardio_notes}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Action Button */}
      <div
        className="fixed bottom-0 left-0 right-0 p-4"
        style={{
          background: `linear-gradient(to top, ${colors.bg} 80%, transparent)`,
        }}
      >
        <div className="max-w-lg mx-auto">
          {isViewingCompleted ? (
            <Link
              href="/workouts/history"
              className="w-full py-5 rounded-2xl text-lg font-bold text-white transition-all flex items-center justify-center gap-2"
              style={{
                background: colors.purpleGradient,
                boxShadow: colors.shadowPurple,
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to History
            </Link>
          ) : (
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
          )}
        </div>
      </div>

      {/* Video Modal */}
      {videoModal && (
        <VideoModal
          url={videoModal.url}
          exerciseName={videoModal.name}
          onClose={() => setVideoModal(null)}
          colors={colors}
        />
      )}

      {/* Notes Modal */}
      {notesHistoryModal && (() => {
        const exerciseId = notesHistoryModal.exerciseId
        const history = exerciseHistoryMap.get(exerciseId) || []

        // Group history by date and get last 5 sessions
        const sessionsByDate = new Map<string, ExerciseHistoryEntry[]>()
        history.forEach(entry => {
          const date = new Date(entry.completed_at).toDateString()
          const existing = sessionsByDate.get(date) || []
          existing.push(entry)
          sessionsByDate.set(date, existing)
        })
        const recentSessions = Array.from(sessionsByDate.entries())
          .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
          .slice(0, 5)

        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={() => setNotesHistoryModal(null)}
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <div
              className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-2xl flex flex-col"
              style={{ background: colors.bgCardSolid }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
                <div>
                  <h3 className="font-bold" style={{ color: colors.text }}>
                    {notesHistoryModal.exerciseName}
                  </h3>
                  <p className="text-xs" style={{ color: colors.textMuted }}>
                    Notes
                  </p>
                </div>
                <button
                  onClick={() => setNotesHistoryModal(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: colors.bgTertiary }}
                >
                  <svg className="w-5 h-5" style={{ color: colors.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* My Notes Section */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
                    My Notes
                  </h4>
                  {editingNoteFor === exerciseId ? (
                    <div className="space-y-2">
                      <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add your notes about this exercise..."
                        className="w-full p-3 rounded-xl text-sm resize-none focus:outline-none focus:ring-2"
                        style={{
                          background: colors.bgTertiary,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingNoteFor(null)
                            setNoteInput('')
                          }}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold"
                          style={{ background: colors.bgTertiary, color: colors.textMuted }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveNote(exerciseId)}
                          disabled={savingNote}
                          className="flex-1 py-2 rounded-lg text-sm font-semibold text-white"
                          style={{ background: colors.purpleGradient }}
                        >
                          {savingNote ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="p-3 rounded-xl cursor-pointer transition-all"
                      style={{ background: colors.bgTertiary }}
                      onClick={() => startEditingNote(exerciseId)}
                    >
                      {exerciseNotes[exerciseId] ? (
                        <p className="text-sm" style={{ color: colors.text }}>
                          {exerciseNotes[exerciseId]}
                        </p>
                      ) : (
                        <p className="text-sm italic" style={{ color: colors.textMuted }}>
                          Tap to add notes...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* History Section */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: colors.textMuted }}>
                    Recent Sessions
                  </h4>
                  {recentSessions.length === 0 ? (
                    <p className="text-sm italic py-4 text-center" style={{ color: colors.textMuted }}>
                      No previous sessions
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {recentSessions.map(([dateStr, sets]) => {
                        const date = new Date(dateStr)
                        const formattedDate = date.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                        })
                        const sortedSets = [...sets].sort((a, b) => a.set_number - b.set_number)

                        return (
                          <div
                            key={dateStr}
                            className="p-3 rounded-xl"
                            style={{ background: colors.bgTertiary }}
                          >
                            <p className="text-xs font-semibold mb-2" style={{ color: colors.textSecondary }}>
                              {formattedDate}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {sortedSets.map((set, idx) => (
                                <div
                                  key={idx}
                                  className="px-2 py-1 rounded-lg text-xs font-medium"
                                  style={{ background: colors.bgCard, color: colors.text }}
                                >
                                  {set.weight ? `${set.weight}×${set.reps_completed}` : `${set.reps_completed} reps`}
                                </div>
                              ))}
                            </div>
                            {sortedSets.some(s => s.notes) && (
                              <p className="text-xs italic mt-2" style={{ color: colors.textMuted }}>
                                {sortedSets.find(s => s.notes)?.notes}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Workout Completion Feedback Modal */}
      {showFeedbackModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowFeedbackModal(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{ background: colors.bgCardSolid }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 p-5 border-b" style={{ borderColor: colors.border, background: colors.bgCardSolid }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: colors.greenLight }}
                >
                  <svg className="w-6 h-6" style={{ color: colors.green }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: colors.text }}>
                    Great workout!
                  </h3>
                  <p className="text-sm" style={{ color: colors.textMuted }}>
                    Quick feedback for your coach
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Difficulty Rating */}
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: colors.text }}>
                  How was the difficulty?
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {['Too Easy', 'Easy', 'Just Right', 'Hard', 'Too Hard'].map((label, i) => (
                    <button
                      key={i}
                      onClick={() => setFeedbackDifficulty(i + 1)}
                      className="py-2 px-1 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: feedbackDifficulty === i + 1 ? colors.purpleGradient : colors.bgTertiary,
                        color: feedbackDifficulty === i + 1 ? '#fff' : colors.textSecondary,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Level */}
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: colors.text }}>
                  Energy level during workout
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Low', 'Medium', 'High'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setFeedbackEnergy(option)}
                      className="py-3 rounded-xl font-medium transition-all"
                      style={{
                        background: feedbackEnergy === option ? colors.purpleGradient : colors.bgTertiary,
                        color: feedbackEnergy === option ? '#fff' : colors.textSecondary,
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feeling Rating */}
              <div>
                <label className="block text-sm font-semibold mb-3" style={{ color: colors.text }}>
                  How do you feel after?
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {['Terrible', 'Not Great', 'Okay', 'Good', 'Amazing'].map((label, i) => (
                    <button
                      key={i}
                      onClick={() => setFeedbackFeeling(i + 1)}
                      className="py-2 px-1 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: feedbackFeeling === i + 1 ? colors.purpleGradient : colors.bgTertiary,
                        color: feedbackFeeling === i + 1 ? '#fff' : colors.textSecondary,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: colors.text }}>
                  Notes for your coach <span style={{ color: colors.textMuted }}>(optional)</span>
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="Share how the workout went, any struggles, or wins..."
                  rows={3}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
                  style={{
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    color: colors.text,
                  }}
                />
              </div>

              {/* Cardio Completion - only show if cardio was prescribed */}
              {workoutDay.cardio_notes && (
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: colors.text }}>
                    Did you complete your cardio?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFeedbackCardioCompleted(true)}
                      className="py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                      style={{
                        background: feedbackCardioCompleted === true
                          ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                          : colors.bgTertiary,
                        color: feedbackCardioCompleted === true ? '#fff' : colors.textSecondary,
                      }}
                    >
                      <span>⚡</span> Yes
                    </button>
                    <button
                      onClick={() => setFeedbackCardioCompleted(false)}
                      className="py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                      style={{
                        background: feedbackCardioCompleted === false
                          ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                          : colors.bgTertiary,
                        color: feedbackCardioCompleted === false ? '#fff' : colors.textSecondary,
                      }}
                    >
                      Skipped
                    </button>
                  </div>
                  <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                    {workoutDay.cardio_notes.split('\n')[0].substring(0, 50)}
                    {workoutDay.cardio_notes.length > 50 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="sticky bottom-0 p-5 border-t flex gap-3" style={{ borderColor: colors.border, background: colors.bgCardSolid }}>
              <button
                onClick={() => handleSubmitFeedback(true)}
                disabled={savingFeedback}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: colors.bgTertiary, color: colors.textSecondary }}
              >
                Skip
              </button>
              <button
                onClick={() => handleSubmitFeedback(false)}
                disabled={savingFeedback}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: colors.purpleGradient }}
              >
                {savingFeedback ? 'Saving...' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm rounded-2xl p-6"
            style={{ background: colors.bgCard }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(239, 68, 68, 0.1)' }}
              >
                <svg className="w-8 h-8" style={{ color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: colors.text }}>
                Delete Workout?
              </h3>
              <p className="text-sm" style={{ color: colors.textMuted }}>
                This will permanently delete this workout session and all logged sets. This action cannot be undone.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: colors.bgTertiary, color: colors.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkout}
                disabled={deleting}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: '#ef4444' }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
