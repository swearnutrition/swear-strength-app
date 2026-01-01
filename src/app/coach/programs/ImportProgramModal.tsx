'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseProgram, getUniqueExerciseNames, type ParsedProgram } from '@/lib/importParser'
import { matchExercises, type ExerciseMatch, type Exercise } from '@/lib/exerciseMatcher'

interface ImportProgramModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (programId: string) => void
}

const FORMAT_GUIDE = `PROGRAM: Program Name
TYPE: strength
INDEFINITE: yes
DESCRIPTION: Brief description of the program.

[WEEK 1]

[DAY 1] Day Name
[WARMUP]
A1. Exercise | 1x10 | Note: Optional note
A2. Exercise | 1x8 per side

[STRENGTH]
A1. Exercise | 3x10 | Rest: 60s | RPE: 6 | Note: Optional
A2. Exercise | 3x12 | Rest: 60s | RPE: 6
B1. Exercise | 3x10 per side | Rest: 45s

[COOLDOWN]
A1. Stretch | 1x30s per side
A2. Stretch | 1x45s

[DAY 2] Another Day
[WARMUP]
...
[STRENGTH]
...
[COOLDOWN]
...

[DAY 3] Rest Day
[REST]
Light walking or mobility work as desired.`

export function ImportProgramModal({ isOpen, onClose, onSuccess }: ImportProgramModalProps) {
  const [tab, setTab] = useState<'paste' | 'guide'>('paste')
  const [inputText, setInputText] = useState('')
  const [parsed, setParsed] = useState<ParsedProgram | null>(null)
  const [exerciseMatches, setExerciseMatches] = useState<ExerciseMatch[]>([])
  const [dbExercises, setDbExercises] = useState<Exercise[]>([])
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<'input' | 'review'>('input')
  const supabase = createClient()

  // Load exercises on mount
  useEffect(() => {
    if (isOpen) {
      loadExercises()
    }
  }, [isOpen])

  const loadExercises = async () => {
    const { data } = await supabase.from('exercises').select('*').order('name')
    if (data) setDbExercises(data)
  }

  const handleParse = () => {
    const result = parseProgram(inputText)
    setParsed(result)

    if (result.errors.length === 0 || result.weeks.length > 0) {
      const uniqueNames = getUniqueExerciseNames(result)
      const matches = matchExercises(uniqueNames, dbExercises)
      setExerciseMatches(matches)
      setStep('review')
    }
  }

  const handleMatchResolution = (index: number, update: Partial<ExerciseMatch>) => {
    setExerciseMatches(prev =>
      prev.map((m, i) => (i === index ? { ...m, ...update } : m))
    )
  }

  const handleCreateExercise = async (index: number, name: string, type: 'strength' | 'mobility' | 'cardio') => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data, error } = await supabase
      .from('exercises')
      .insert({ name, type, created_by: userData.user.id })
      .select()
      .single()

    if (data && !error) {
      setDbExercises(prev => [...prev, data])
      handleMatchResolution(index, {
        status: 'matched',
        matchedExercise: data,
        resolution: 'use_match',
        selectedExerciseId: data.id,
      })
    }
  }

  const handleImport = async () => {
    if (!parsed) return
    setImporting(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not logged in')

      // Build exercise name to ID map, auto-creating unresolved exercises
      const exerciseIdMap = new Map<string, string>()
      for (const match of exerciseMatches) {
        if (match.selectedExerciseId) {
          exerciseIdMap.set(match.parsedName, match.selectedExerciseId)
        } else if (!match.resolution || match.status === 'unmatched') {
          // Auto-create unresolved exercises
          const { data, error } = await supabase
            .from('exercises')
            .insert({
              name: match.parsedName,
              type: parsed.type,
              created_by: userData.user.id
            })
            .select()
            .single()

          if (data && !error) {
            exerciseIdMap.set(match.parsedName, data.id)
          } else {
            console.error(`Failed to create exercise: ${match.parsedName}`, error)
          }
        }
      }

      // Create program
      const { data: program, error: programError } = await supabase
        .from('programs')
        .insert({
          name: parsed.name,
          type: parsed.type,
          description: parsed.description,
          is_indefinite: parsed.is_indefinite,
          created_by: userData.user.id,
        })
        .select()
        .single()

      if (programError || !program) throw programError || new Error('Failed to create program')

      // Create weeks and days
      for (const week of parsed.weeks) {
        for (const weekNum of week.weekNumbers) {
          const { data: weekData, error: weekError } = await supabase
            .from('program_weeks')
            .insert({
              program_id: program.id,
              week_number: weekNum,
            })
            .select()
            .single()

          if (weekError || !weekData) throw weekError || new Error('Failed to create week')

          // Create days for this week
          for (const day of week.days) {
            const { data: dayData, error: dayError } = await supabase
              .from('workout_days')
              .insert({
                week_id: weekData.id,
                day_number: day.dayNumber,
                name: day.name,
                is_rest_day: day.isRestDay,
                rest_day_notes: day.restDayNotes,
              })
              .select()
              .single()

            if (dayError || !dayData) throw dayError || new Error('Failed to create day')

            // Create exercises for this day
            for (let i = 0; i < day.exercises.length; i++) {
              const ex = day.exercises[i]
              const exerciseId = exerciseIdMap.get(ex.name)

              if (!exerciseId) {
                console.warn(`No exercise ID for: ${ex.name}`)
                continue
              }

              await supabase.from('workout_exercises').insert({
                day_id: dayData.id,
                exercise_id: exerciseId,
                section: ex.section,
                label: ex.label,
                sets: ex.sets,
                reps: ex.reps,
                rest_seconds: ex.restSeconds,
                rpe: ex.rpe,
                notes: ex.notes,
                sort_order: i,
              })
            }
          }
        }
      }

      onSuccess(program.id)
    } catch (err) {
      console.error('Import error:', err)
      alert('Failed to import program: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setStep('input')
    setInputText('')
    setParsed(null)
    setExerciseMatches([])
    onClose()
  }

  if (!isOpen) return null

  const canImport = parsed && parsed.errors.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Import Program</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'input' ? (
          <>
            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-2">
              <button
                onClick={() => setTab('paste')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'paste'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                Paste Program
              </button>
              <button
                onClick={() => setTab('guide')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'guide'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                Format Guide
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {tab === 'paste' ? (
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your program text here..."
                  className="w-full h-96 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-800 rounded-lg p-4 overflow-auto">
                    <pre className="text-sm text-slate-300 whitespace-pre-wrap">{FORMAT_GUIDE}</pre>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white mb-2">Program Types & Options</h4>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">strength</code> - Standard strength programs</li>
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">mobility</code> - Mobility/flexibility programs</li>
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">cardio</code> - Cardio programs</li>
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">INDEFINITE: yes</code> - Repeating program</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white mb-2">Exercise Format</h4>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                        <li>Sets/Reps: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">3x10</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">3x8-10</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">3x10 per side</code></li>
                        <li>Duration: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">30s</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">1min</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">2min</code></li>
                        <li>Rest: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Rest: 60s</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Rest: 90s</code></li>
                        <li>RPE: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">RPE: 7</code> (1-10 scale)</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white mb-2">Section Markers</h4>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[WARMUP]</code> - Warmup exercises</li>
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[STRENGTH]</code> - Main workout</li>
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[COOLDOWN]</code> - Cooldown/stretching</li>
                        <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[REST]</code> - Rest day notes</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white mb-2">Week/Day Format</h4>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                        <li>Single week: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[WEEK 1]</code></li>
                        <li>Week range: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[WEEKS 1-2]</code></li>
                        <li>Days: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">[DAY 1] Name</code></li>
                        <li>Supersets: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">A1.</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">A2.</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">B1.</code>, etc.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!inputText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Parse Program
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Review Step */}
            <div className="overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(85vh - 140px)' }}>
              {/* Program Summary */}
              {parsed && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{parsed.name}</h3>
                  <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <span className="bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">
                      {parsed.type}
                    </span>
                    {parsed.is_indefinite && (
                      <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                        Indefinite
                      </span>
                    )}
                    <span>{parsed.weeks.length} week template{parsed.weeks.length !== 1 ? 's' : ''}</span>
                    <span>
                      {parsed.weeks.reduce((sum, w) => sum + w.days.length, 0)} days
                    </span>
                    <span>{exerciseMatches.length} unique exercises</span>
                  </div>
                  {parsed.description && (
                    <p className="mt-2 text-sm text-slate-500">{parsed.description}</p>
                  )}
                </div>
              )}

              {/* Parse Errors */}
              {parsed && parsed.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4">
                  <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">Parse Errors</h4>
                  <ul className="space-y-1 text-sm text-red-600 dark:text-red-400">
                    {parsed.errors.map((err, i) => (
                      <li key={i}>Line {err.line}: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Exercise Matches */}
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white mb-3">Exercise Matching</h4>
                <div className="space-y-2">
                  {exerciseMatches.map((match, index) => (
                    <ExerciseMatchRow
                      key={match.parsedName}
                      match={match}
                      dbExercises={dbExercises}
                      programType={parsed?.type || 'strength'}
                      onResolve={(update) => handleMatchResolution(index, update)}
                      onCreateNew={(name, type) => handleCreateExercise(index, name, type)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between flex-shrink-0">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!canImport || importing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importing...' : 'Import Program'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ExerciseMatchRow({
  match,
  dbExercises,
  programType,
  onResolve,
  onCreateNew,
}: {
  match: ExerciseMatch
  dbExercises: Exercise[]
  programType: 'strength' | 'mobility' | 'cardio'
  onResolve: (update: Partial<ExerciseMatch>) => void
  onCreateNew: (name: string, type: 'strength' | 'mobility' | 'cardio') => void
}) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState(match.parsedName)
  const [newType, setNewType] = useState(programType)

  const filteredExercises = dbExercises.filter(ex =>
    ex.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusColors = {
    matched: 'bg-green-100 dark:bg-green-500/20 border-green-200 dark:border-green-500/30',
    fuzzy: 'bg-yellow-100 dark:bg-yellow-500/20 border-yellow-200 dark:border-yellow-500/30',
    unmatched: 'bg-red-100 dark:bg-red-500/20 border-red-200 dark:border-red-500/30',
  }

  const statusIcons = {
    matched: '✓',
    fuzzy: '~',
    unmatched: '?',
  }

  const isResolved = match.resolution === 'use_match' || match.resolution === 'pick_existing' || match.resolution === 'create_new'

  return (
    <div className={`border rounded-lg p-3 ${isResolved ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30' : statusColors[match.status]}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
            isResolved
              ? 'bg-green-200 dark:bg-green-500/30 text-green-700 dark:text-green-400'
              : match.status === 'matched'
              ? 'bg-green-200 dark:bg-green-500/30 text-green-700 dark:text-green-400'
              : match.status === 'fuzzy'
              ? 'bg-yellow-200 dark:bg-yellow-500/30 text-yellow-700 dark:text-yellow-400'
              : 'bg-red-200 dark:bg-red-500/30 text-red-700 dark:text-red-400'
          }`}>
            {isResolved ? '✓' : statusIcons[match.status]}
          </span>
          <span className="font-medium text-slate-900 dark:text-white truncate">{match.parsedName}</span>
          {match.matchedExercise && match.parsedName.toLowerCase() !== match.matchedExercise.name.toLowerCase() && (
            <span className="text-slate-400">→ {match.matchedExercise.name}</span>
          )}
        </div>

        {!isResolved && match.status === 'unmatched' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="px-3 py-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-slate-300 dark:hover:border-slate-600"
              >
                Pick existing
              </button>
              {showDropdown && (
                <div className="absolute right-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-transparent text-sm focus:outline-none"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-auto">
                    {filteredExercises.slice(0, 20).map(ex => (
                      <button
                        key={ex.id}
                        onClick={() => {
                          onResolve({
                            status: 'matched',
                            matchedExercise: ex,
                            resolution: 'pick_existing',
                            selectedExerciseId: ex.id,
                          })
                          setShowDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {ex.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-500"
            >
              Create new
            </button>
          </div>
        )}

        {match.status === 'fuzzy' && !isResolved && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => onResolve({ resolution: 'use_match', selectedExerciseId: match.matchedExercise?.id })}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-500"
            >
              Accept match
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Create new instead
            </button>
          </div>
        )}
      </div>

      {showCreateForm && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1">Exercise Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'strength' | 'mobility' | 'cardio')}
              className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="strength">Strength</option>
              <option value="mobility">Mobility</option>
              <option value="cardio">Cardio</option>
            </select>
          </div>
          <button
            onClick={() => {
              onCreateNew(newName, newType)
              setShowCreateForm(false)
            }}
            className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-500"
          >
            Create
          </button>
          <button
            onClick={() => setShowCreateForm(false)}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
