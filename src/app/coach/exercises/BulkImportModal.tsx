'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MUSCLE_GROUPS,
  MOBILITY_FOCUS_AREAS,
  EQUIPMENT_OPTIONS,
} from '@/lib/constants/exercises'

interface ParsedExercise {
  name: string
  type: 'strength' | 'mobility'
  sets: number
  reps: string
  rpe?: number
  primary_muscle?: string
  secondary_muscles: string[]
  focus_area?: string
  equipment?: string
  purpose?: string
  cues?: string
  logging_type: string
  isValid: boolean
  errors: string[]
}

interface BulkImportModalProps {
  onClose: () => void
  onSave: () => void
}

const TEMPLATE_FORMAT = `Exercise Name
Type | Sets x Reps | RPE: 7
Primary: Muscle | Secondary: Muscle, Muscle
Equipment: Dumbbell
Purpose: Description here
Cues: Line 1 // Line 2 // Line 3

Another Exercise
Strength | 3x10 | RPE: 8
Primary: Chest | Secondary: Triceps
Equipment: Barbell
Purpose: Build pressing strength
Cues: Arch back // Retract scapula`

export function BulkImportModal({ onClose, onSave }: BulkImportModalProps) {
  const [rawText, setRawText] = useState('')
  const [parsedExercises, setParsedExercises] = useState<ParsedExercise[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTemplate, setShowTemplate] = useState(false)

  const supabase = createClient()

  // Normalize muscle/focus names to match database values
  const normalizeMuscle = (input: string): string | undefined => {
    const cleaned = input.toLowerCase().trim()
    const normalized = cleaned.replace(/\s+/g, '_').replace(/-/g, '_')

    // Direct match
    const found = MUSCLE_GROUPS.find(
      (m) => m.value === normalized || m.label.toLowerCase() === cleaned
    )
    if (found) return found.value

    // Partial/alias matching - map to valid database enum values
    const aliases: Record<string, string> = {
      'delts': 'shoulders',
      'shoulder': 'shoulders',
      'front_delts': 'shoulders', // DB doesn't have front_delts, map to shoulders
      'pecs': 'chest',
      'pec': 'chest',
      'back': 'back',
      'upper_back': 'back',
      'mid_back': 'mid_back',
      'lower_back': 'erectors',
      'spine': 'erectors',
      'trap': 'traps',
      'lat': 'lats',
      'glute': 'glutes',
      'quad': 'quads',
      'hamstring': 'hamstrings',
      'ham': 'hamstrings',
      'hams': 'hamstrings',
      'bi': 'biceps',
      'bis': 'biceps',
      'tri': 'triceps',
      'tris': 'triceps',
      'ab': 'abs',
      'abdominal': 'abs',
      'abdominals': 'abs',
      'oblique': 'obliques',
      'calf': 'calves',
      'forearm': 'forearms',
      'adductor': 'adductors',
      'inner_thigh': 'adductors',
      'hip_flexor': 'hip_flexors',
      'none': '', // Will be filtered out
    }

    if (normalized in aliases) {
      const mapped = aliases[normalized]
      return mapped || undefined // Return undefined for empty strings (like 'none')
    }

    // Check if input contains a muscle name
    for (const m of MUSCLE_GROUPS) {
      if (cleaned.includes(m.label.toLowerCase()) || normalized.includes(m.value)) {
        return m.value
      }
    }

    return undefined
  }

  const normalizeFocusArea = (input: string): string | undefined => {
    const cleaned = input.toLowerCase().trim()
    const normalized = cleaned.replace(/\s+/g, '_').replace(/-/g, '_')

    // Direct match
    const found = MOBILITY_FOCUS_AREAS.find(
      (f) => f.value === normalized || f.label.toLowerCase() === cleaned
    )
    if (found) return found.value

    // Partial/alias matching
    const aliases: Record<string, string> = {
      't_spine': 'thoracic_spine',
      'upper_back': 'thoracic_spine',
      'mid_back': 'thoracic_spine',
      'l_spine': 'lumbar_spine',
      'lower_back': 'lumbar_spine',
      'c_spine': 'cervical_spine',
      'neck': 'neck',
      'hip': 'hips',
      'hip_flexor': 'hip_flexors',
      'groin': 'groin',
      'inner_thigh': 'groin',
      'adductors': 'groin',
      'shoulder': 'shoulders',
      'scapula': 'scapular',
      'shoulder_blade': 'scapular',
      'shoulder_blades': 'scapular',
      'ankle': 'ankles',
      'wrist': 'wrists',
      'elbow': 'elbows',
      'foot': 'feet',
      'lat': 'lats',
      'pec': 'pecs',
      'chest': 'pecs',
      'hamstring': 'hamstrings',
      'ham': 'hamstrings',
      'quad': 'quads',
      'calf': 'calves',
    }

    if (aliases[normalized]) return aliases[normalized]

    // Check if input contains a focus area name
    for (const f of MOBILITY_FOCUS_AREAS) {
      if (cleaned.includes(f.label.toLowerCase()) || normalized.includes(f.value)) {
        return f.value
      }
    }

    return undefined
  }

  const normalizeEquipment = (input: string): string => {
    const cleaned = input.toLowerCase().trim()

    // Direct match
    const found = EQUIPMENT_OPTIONS.find((e) => e.toLowerCase() === cleaned)
    if (found) return found

    // Partial matches
    const aliases: Record<string, string> = {
      'db': 'Dumbbell',
      'dbs': 'Dumbbell',
      'dumbbells': 'Dumbbell',
      'bb': 'Barbell',
      'bar': 'Barbell',
      'kb': 'Kettlebell',
      'kettlebells': 'Kettlebell',
      'cable': 'Cable Machine',
      'cables': 'Cable Machine',
      'cable_machine': 'Cable Machine',
      'smith': 'Smith Machine',
      'band': 'Resistance Band',
      'bands': 'Resistance Band',
      'mini_band': 'Resistance Band',
      'mini band': 'Resistance Band',
      'trx': 'TRX/Suspension',
      'suspension': 'TRX/Suspension',
      'pull_up_bar': 'Pull-up Bar',
      'pullup_bar': 'Pull-up Bar',
      'chin_up_bar': 'Pull-up Bar',
      'rack': 'Squat Rack',
      'squat_rack': 'Squat Rack',
      'power_rack': 'Squat Rack',
      'leg_press': 'Leg Press',
      'leg_press_machine': 'Leg Press',
      'ab_wheel': 'Ab Wheel',
      'roller': 'Foam Roller',
      'foam_roller': 'Foam Roller',
      'mat': 'Yoga Mat',
      'yoga_mat': 'Yoga Mat',
      'pad': 'Yoga Mat',
      'medicine_ball': 'Medicine Ball',
      'med_ball': 'Medicine Ball',
      'bw': 'Bodyweight',
      'body_weight': 'Bodyweight',
      'none': 'None',
    }

    const normalized = cleaned.replace(/\s+/g, '_').replace(/-/g, '_')
    if (aliases[normalized]) return aliases[normalized]
    if (aliases[cleaned]) return aliases[cleaned]

    // Check for partial matches
    for (const e of EQUIPMENT_OPTIONS) {
      if (cleaned.includes(e.toLowerCase())) {
        return e
      }
    }

    // Return the original input if no match found
    return input.trim()
  }

  const parseExercises = () => {
    setError(null)
    const blocks = rawText.trim().split(/\n\s*\n/) // Split by blank lines
    const exercises: ParsedExercise[] = []

    for (const block of blocks) {
      if (!block.trim()) continue

      const lines = block.trim().split('\n').map((l) => l.trim())

      // Skip separator lines (---, ===, ___, etc.)
      if (lines.length === 1 && /^[-=_*]{2,}$/.test(lines[0])) {
        continue
      }

      const exercise: ParsedExercise = {
        name: '',
        type: 'strength',
        sets: 3,
        reps: '10',
        secondary_muscles: [],
        logging_type: 'weight_reps',
        isValid: true,
        errors: [],
      }

      // Line 1: Exercise name (skip if it looks like a separator)
      let nameLineIndex = 0
      if (/^[-=_*]{2,}$/.test(lines[0])) {
        nameLineIndex = 1 // Skip separator and use next line as name
      }

      exercise.name = lines[nameLineIndex] || ''
      if (!exercise.name || /^[-=_*]{2,}$/.test(exercise.name)) {
        exercise.errors.push('Missing exercise name')
        exercise.isValid = false
      }

      // Parse remaining lines (start after the name line)
      for (let i = nameLineIndex + 1; i < lines.length; i++) {
        const line = lines[i]

        // Skip any separator lines within the block
        if (/^[-=_*]{2,}$/.test(line)) continue

        // Type | Sets x Reps | RPE: X
        if (line.match(/^(strength|mobility|cardio)/i) || line.match(/\d+x\d+/i) || line.match(/\d+\s*sets?/i)) {
          const parts = line.split('|').map((p) => p.trim())

          for (const part of parts) {
            // Type
            if (part.match(/^strength$/i)) {
              exercise.type = 'strength'
              exercise.logging_type = 'weight_reps'
            } else if (part.match(/^mobility$/i)) {
              exercise.type = 'mobility'
              exercise.logging_type = 'duration'
            } else if (part.match(/^cardio$/i)) {
              exercise.type = 'strength' // Store as strength but with distance logging
              exercise.logging_type = 'distance'
            }

            // Sets x Reps (e.g., "3x10", "2-3 sets x 10 reps")
            const setsRepsMatch = part.match(/(\d+)(?:-(\d+))?\s*(?:sets?)?\s*x\s*(\d+\S*)/i)
            if (setsRepsMatch) {
              exercise.sets = parseInt(setsRepsMatch[2] || setsRepsMatch[1])
              exercise.reps = setsRepsMatch[3]
            }

            // Just reps with duration (e.g., "30s", "60s each side")
            const durationMatch = part.match(/^(\d+s\S*)$/i)
            if (durationMatch) {
              exercise.reps = durationMatch[1]
              exercise.logging_type = 'duration'
            }

            // RPE
            const rpeMatch = part.match(/RPE:?\s*(\d+)/i)
            if (rpeMatch) {
              exercise.rpe = parseInt(rpeMatch[1])
            }
          }
        }

        // Primary: X | Secondary: Y, Z
        if (line.match(/^primary:/i) || line.match(/^focus:/i)) {
          const parts = line.split('|').map((p) => p.trim())

          for (const part of parts) {
            // Primary muscle
            const primaryMatch = part.match(/^primary:\s*(.+)/i)
            if (primaryMatch) {
              const muscle = normalizeMuscle(primaryMatch[1])
              if (muscle) {
                exercise.primary_muscle = muscle
              } else {
                exercise.errors.push(`Unknown primary muscle: ${primaryMatch[1]}`)
              }
            }

            // Focus area (for mobility)
            const focusMatch = part.match(/^focus:\s*(.+)/i)
            if (focusMatch) {
              exercise.type = 'mobility'
              exercise.logging_type = 'duration'
              const focus = normalizeFocusArea(focusMatch[1])
              if (focus) {
                exercise.focus_area = focus
              } else {
                exercise.errors.push(`Unknown focus area: ${focusMatch[1]}`)
              }
            }

            // Secondary muscles
            const secondaryMatch = part.match(/^secondary:\s*(.+)/i)
            if (secondaryMatch) {
              const muscles = secondaryMatch[1].split(',').map((m) => m.trim())
              for (const m of muscles) {
                const normalized = normalizeMuscle(m)
                if (normalized) {
                  exercise.secondary_muscles.push(normalized)
                }
              }
            }
          }
        }

        // Equipment: X
        const equipmentMatch = line.match(/^equipment:\s*(.+)/i)
        if (equipmentMatch) {
          exercise.equipment = normalizeEquipment(equipmentMatch[1])
        }

        // Purpose: X
        const purposeMatch = line.match(/^purpose:\s*(.+)/i)
        if (purposeMatch) {
          exercise.purpose = purposeMatch[1]
        }

        // Cues: X // Y // Z
        const cuesMatch = line.match(/^cues:\s*(.+)/i)
        if (cuesMatch) {
          // Convert // separators to newlines for storage
          exercise.cues = cuesMatch[1].split('//').map((c) => c.trim()).join('\n')
        }
      }

      exercises.push(exercise)
    }

    setParsedExercises(exercises)
    setShowPreview(true)
  }

  const handleSave = async () => {
    const validExercises = parsedExercises.filter((e) => e.isValid)
    if (validExercises.length === 0) {
      setError('No valid exercises to import')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Get all existing exercises to check for duplicates
      const { data: existingExercises } = await supabase
        .from('exercises')
        .select('id, name')

      // Create a map of lowercase names to IDs for matching
      const existingMap = new Map<string, string>()
      existingExercises?.forEach((ex) => {
        existingMap.set(ex.name.toLowerCase().trim(), ex.id)
      })

      const toInsert: typeof validExercises = []
      const toUpdate: { id: string; data: Record<string, unknown> }[] = []

      for (const e of validExercises) {
        const exerciseData = {
          name: e.name,
          type: e.type,
          primary_muscle: e.primary_muscle || null,
          secondary_muscles: e.secondary_muscles.filter(Boolean),
          focus_area: e.focus_area || null,
          equipment: e.equipment || null,
          purpose: e.purpose || null,
          cues: e.cues || null,
          logging_type: e.logging_type,
          default_sets: e.sets,
          default_reps: String(e.reps),
        }

        const existingId = existingMap.get(e.name.toLowerCase().trim())
        if (existingId) {
          // Update existing - don't overwrite video_url or video_thumbnail
          toUpdate.push({ id: existingId, data: exerciseData })
        } else {
          toInsert.push(e)
        }
      }

      // Insert new exercises
      if (toInsert.length > 0) {
        const inserts = toInsert.map((e) => ({
          name: e.name,
          type: e.type,
          primary_muscle: e.primary_muscle || null,
          secondary_muscles: e.secondary_muscles.filter(Boolean),
          focus_area: e.focus_area || null,
          equipment: e.equipment || null,
          purpose: e.purpose || null,
          cues: e.cues || null,
          logging_type: e.logging_type,
          default_sets: e.sets,
          default_reps: String(e.reps),
        }))

        const { error: insertError } = await supabase.from('exercises').insert(inserts)
        if (insertError) {
          console.error('Insert error:', insertError)
          throw new Error(insertError.message || JSON.stringify(insertError))
        }
      }

      // Update existing exercises (preserves video_url and video_thumbnail)
      // Batch updates in parallel chunks of 10 for speed
      if (toUpdate.length > 0) {
        const chunkSize = 10
        for (let i = 0; i < toUpdate.length; i += chunkSize) {
          const chunk = toUpdate.slice(i, i + chunkSize)
          await Promise.all(
            chunk.map(({ id, data }) =>
              supabase
                .from('exercises')
                .update(data)
                .eq('id', id)
                .then(({ error }) => {
                  if (error) console.error('Update error:', error)
                })
            )
          )
        }
      }

      onSave()
    } catch (err) {
      console.error('Error saving exercises:', err)
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to save exercises: ${message}`)
    } finally {
      setSaving(false)
    }
  }

  const removeExercise = (index: number) => {
    setParsedExercises((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {showPreview ? 'Review Parsed Exercises' : 'Paste Exercise Data'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {!showPreview ? (
            <div className="p-6 space-y-4">
              {/* Template Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTemplate(!showTemplate)}
                  className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showTemplate ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  View Template Format
                </button>

                {showTemplate && (
                  <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <pre className="text-sm text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap">
                      {TEMPLATE_FORMAT}
                    </pre>
                    <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <p>Separate exercises with a <strong>blank line</strong>. Separate multiple cues with <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">//</code>.</p>
                      <p>Type must be: <strong>Strength</strong>, <strong>Mobility</strong>, or <strong>Cardio</strong></p>
                      <p>For <strong>Mobility</strong> exercises, use <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">Focus: Area</code> instead of Primary/Secondary.</p>
                      <p>Equipment options: {EQUIPMENT_OPTIONS.slice(0, 8).join(', ')}, Other</p>
                      <p>Optional: <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">RPE: 6-10</code> for default RPE</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Text Area */}
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={16}
                placeholder={`Y-T-W Pulls
Strength | 2-3 sets x 10 reps each position | RPE: 7
Primary: Rear Delts | Secondary: Lower Traps, Rhomboids
Equipment: Dumbbell
Purpose: Targets multiple upper back muscles for balanced shoulder development
Cues: Hinge forward or on bench // Make each letter shape // Squeeze shoulder blades // Light weight only

Bench Press
Strength | 3x8 | RPE: 8
Primary: Chest | Secondary: Triceps, Shoulders
Equipment: Barbell
Purpose: Build pressing strength and chest mass
Cues: Arch back // Retract scapula // Drive through feet`}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none font-mono text-sm"
              />

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <p className="text-sm text-slate-600 dark:text-slate-400">
                Found <strong>{parsedExercises.length}</strong> exercise{parsedExercises.length !== 1 ? 's' : ''}.
                {parsedExercises.filter((e) => !e.isValid).length > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    {' '}({parsedExercises.filter((e) => !e.isValid).length} with warnings)
                  </span>
                )}
              </p>

              <div className="space-y-3">
                {parsedExercises.map((exercise, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl border ${
                      exercise.isValid
                        ? 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                        : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">{exercise.name}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            exercise.type === 'strength'
                              ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                              : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {exercise.type}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                          <span>{exercise.sets} sets × {exercise.reps}</span>
                          {exercise.rpe && <span>RPE {exercise.rpe}</span>}
                          {exercise.primary_muscle && (
                            <span>Primary: {MUSCLE_GROUPS.find((m) => m.value === exercise.primary_muscle)?.label}</span>
                          )}
                          {exercise.focus_area && (
                            <span>Focus: {MOBILITY_FOCUS_AREAS.find((f) => f.value === exercise.focus_area)?.label}</span>
                          )}
                          {exercise.equipment && <span>{exercise.equipment}</span>}
                        </div>

                        {exercise.purpose && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{exercise.purpose}</p>
                        )}

                        {exercise.errors.length > 0 && (
                          <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            {exercise.errors.map((err, i) => (
                              <p key={i}>Warning: {err}</p>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => removeExercise(index)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div>
            {showPreview && (
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Edit
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!showPreview ? (
              <>
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  disabled={!rawText}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={parseExercises}
                  disabled={!rawText.trim()}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Parse Exercises
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || parsedExercises.filter((e) => e.isValid).length === 0}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Importing...' : `Import ${parsedExercises.filter((e) => e.isValid).length} Exercise${parsedExercises.filter((e) => e.isValid).length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
