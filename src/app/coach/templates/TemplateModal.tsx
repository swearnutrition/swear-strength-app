'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type TemplateType = 'warmup' | 'cooldown'

interface RoutineTemplate {
  id: string
  name: string
  type: TemplateType
  description: string | null
  duration_minutes: number | null
  is_archived: boolean
  created_at: string
}

interface Exercise {
  id: string
  name: string
  type: string
  video_thumbnail: string | null
}

interface TemplateExercise {
  id?: string
  exercise_id: string
  exercise?: Exercise
  sets: string
  reps: string
  notes: string
  sort_order: number
}

interface TemplateModalProps {
  template: RoutineTemplate | null
  type: TemplateType
  onClose: () => void
  onSave: () => void
}

export function TemplateModal({ template, type, onClose, onSave }: TemplateModalProps) {
  const isEditing = !!template
  const supabase = createClient()

  const [formData, setFormData] = useState({
    name: template?.name || '',
    description: template?.description || '',
    duration_minutes: template?.duration_minutes || null,
  })

  const [exercises, setExercises] = useState<TemplateExercise[]>([])
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available mobility exercises for warmup/cooldown
  const fetchAvailableExercises = useCallback(async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, type, video_thumbnail')
      .eq('type', 'mobility')
      .order('name')

    if (!error && data) {
      setAvailableExercises(data)
    }
  }, [supabase])

  // Fetch template exercises if editing
  const fetchTemplateExercises = useCallback(async () => {
    if (!template) return

    const { data, error } = await supabase
      .from('routine_template_exercises')
      .select(`
        id,
        exercise_id,
        sets,
        reps,
        notes,
        sort_order,
        exercises (id, name, type, video_thumbnail)
      `)
      .eq('template_id', template.id)
      .order('sort_order')

    if (!error && data) {
      setExercises(
        data.map((item) => ({
          id: item.id,
          exercise_id: item.exercise_id,
          exercise: item.exercises as unknown as Exercise,
          sets: item.sets || '',
          reps: item.reps || '',
          notes: item.notes || '',
          sort_order: item.sort_order,
        }))
      )
    }
  }, [supabase, template])

  useEffect(() => {
    fetchAvailableExercises()
    if (isEditing) {
      fetchTemplateExercises()
    }
  }, [fetchAvailableExercises, fetchTemplateExercises, isEditing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let templateId = template?.id

      if (isEditing && template) {
        // Update existing template
        const { error } = await supabase
          .from('routine_templates')
          .update({
            name: formData.name,
            description: formData.description || null,
            duration_minutes: formData.duration_minutes,
          })
          .eq('id', template.id)

        if (error) throw error

        // Delete existing exercises
        await supabase
          .from('routine_template_exercises')
          .delete()
          .eq('template_id', template.id)
      } else {
        // Create new template
        const { data, error } = await supabase
          .from('routine_templates')
          .insert({
            name: formData.name,
            type: type,
            description: formData.description || null,
            duration_minutes: formData.duration_minutes,
            created_by: user.id,
          })
          .select()
          .single()

        if (error) throw error
        templateId = data.id
      }

      // Insert exercises
      if (exercises.length > 0 && templateId) {
        const exerciseInserts = exercises.map((ex, index) => ({
          template_id: templateId,
          exercise_id: ex.exercise_id,
          sets: ex.sets || null,
          reps: ex.reps || null,
          notes: ex.notes || null,
          sort_order: index,
        }))

        const { error } = await supabase
          .from('routine_template_exercises')
          .insert(exerciseInserts)

        if (error) throw error
      }

      onSave()
    } catch (err) {
      console.error('Error saving template:', err)
      setError('Failed to save template. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addExercise = (exercise: Exercise) => {
    setExercises((prev) => [
      ...prev,
      {
        exercise_id: exercise.id,
        exercise: exercise,
        sets: '1',
        reps: '30s',
        notes: '',
        sort_order: prev.length,
      },
    ])
    setShowExercisePicker(false)
    setExerciseSearch('')
  }

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  const updateExercise = (index: number, field: keyof TemplateExercise, value: string) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    )
  }

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= exercises.length) return

    setExercises((prev) => {
      const newExercises = [...prev]
      const temp = newExercises[index]
      newExercises[index] = newExercises[newIndex]
      newExercises[newIndex] = temp
      return newExercises
    })
  }

  const filteredExercises = availableExercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
      !exercises.some((te) => te.exercise_id === ex.id)
  )

  const isWarmup = type === 'warmup'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isWarmup
                ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
            }`}>
              {isWarmup ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isEditing ? 'Edit' : 'New'} {isWarmup ? 'Warmup' : 'Cooldown'} Template
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Template Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder={`e.g., ${isWarmup ? 'Lower Body Warmup' : 'Full Body Stretch'}`}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Optional description of when to use this template..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Estimated Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.duration_minutes || ''}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value ? parseInt(e.target.value) : null })}
                min="1"
                placeholder="e.g., 10"
                className="w-32 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Exercises */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Exercises
                </label>
                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Exercise
                </button>
              </div>

              {exercises.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No exercises added yet</p>
                  <button
                    type="button"
                    onClick={() => setShowExercisePicker(true)}
                    className="mt-2 text-purple-600 dark:text-purple-400 text-sm font-medium hover:text-purple-500"
                  >
                    Add your first exercise
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {exercises.map((ex, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start gap-3">
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveExercise(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveExercise(index, 'down')}
                            disabled={index === exercises.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Exercise thumbnail */}
                        <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                          {ex.exercise?.video_thumbnail ? (
                            <img
                              src={ex.exercise.video_thumbnail}
                              alt={ex.exercise?.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Exercise details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-2">
                            {ex.exercise?.name || 'Unknown Exercise'}
                          </h4>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Sets</label>
                              <input
                                type="text"
                                value={ex.sets}
                                onChange={(e) => updateExercise(index, 'sets', e.target.value)}
                                placeholder="1"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Reps/Duration</label>
                              <input
                                type="text"
                                value={ex.reps}
                                onChange={(e) => updateExercise(index, 'reps', e.target.value)}
                                placeholder="30s"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Notes</label>
                              <input
                                type="text"
                                value={ex.notes}
                                onChange={(e) => updateExercise(index, 'notes', e.target.value)}
                                placeholder="Optional"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeExercise(index)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name}
              className={`px-6 py-2 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isWarmup
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400'
              }`}
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>

        {/* Exercise Picker Modal */}
        {showExercisePicker && (
          <div className="absolute inset-0 bg-white dark:bg-slate-900 z-10 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Add Exercise</h3>
              <button
                onClick={() => {
                  setShowExercisePicker(false)
                  setExerciseSearch('')
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  placeholder="Search mobility exercises..."
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredExercises.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">No mobility exercises found</p>
                  <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                    Add mobility exercises to your library first
                  </p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredExercises.map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => addExercise(exercise)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-purple-500/50 transition-all text-left"
                    >
                      <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                        {exercise.video_thumbnail ? (
                          <img
                            src={exercise.video_thumbnail}
                            alt={exercise.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 dark:text-white text-sm">{exercise.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{exercise.type}</p>
                      </div>
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
