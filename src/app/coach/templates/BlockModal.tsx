'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ExerciseBlock, ExerciseBlockItem, Exercise } from '../programs/[id]/types'

interface BlockModalProps {
  block: (ExerciseBlock & { exercise_block_items?: ExerciseBlockItem[] }) | null
  onClose: () => void
  onSave: () => void
}

export function BlockModal({ block, onClose, onSave }: BlockModalProps) {
  const isEditing = !!block
  const supabase = createClient()

  const [name, setName] = useState(block?.name || '')
  const [description, setDescription] = useState(block?.description || '')
  const [items, setItems] = useState<ExerciseBlockItem[]>(block?.exercise_block_items || [])
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available strength exercises
  const fetchExercises = useCallback(async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, equipment, muscle_groups, type, primary_muscle, focus_area, video_url')
      .eq('type', 'strength')
      .order('name')

    if (data) setAvailableExercises(data)
  }, [supabase])

  useEffect(() => {
    fetchExercises()
  }, [fetchExercises])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let blockId = block?.id

      if (isEditing && block) {
        // Update existing block
        const { error } = await supabase
          .from('exercise_blocks')
          .update({ name: name.trim(), description: description.trim() || null })
          .eq('id', block.id)

        if (error) throw error

        // Delete existing items and re-insert
        await supabase
          .from('exercise_block_items')
          .delete()
          .eq('block_id', block.id)
      } else {
        // Create new block
        const { data, error } = await supabase
          .from('exercise_blocks')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            created_by: user.id,
          })
          .select()
          .single()

        if (error) throw error
        blockId = data.id
      }

      // Insert items
      if (items.length > 0 && blockId) {
        const itemInserts = items.map((item, index) => ({
          block_id: blockId,
          exercise_id: item.exercise_id,
          label: item.label || null,
          sets: item.sets || null,
          reps: item.reps || null,
          weight: item.weight || null,
          weight_unit: item.weight_unit || null,
          rest_seconds: item.rest_seconds || null,
          rpe: item.rpe || null,
          notes: item.notes || null,
          sort_order: index,
        }))

        const { error } = await supabase
          .from('exercise_block_items')
          .insert(itemInserts)

        if (error) throw error
      }

      onSave()
    } catch (err) {
      console.error('Error saving block:', err)
      setError('Failed to save block. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addExercise = (exercise: Exercise) => {
    setItems((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        block_id: block?.id || '',
        exercise_id: exercise.id,
        exercise: exercise,
        label: null,
        sets: '3',
        reps: '10',
        weight: null,
        weight_unit: null,
        rest_seconds: null,
        rpe: null,
        notes: null,
        sort_order: prev.length,
      },
    ])
    setShowExercisePicker(false)
    setExerciseSearch('')
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ExerciseBlockItem, value: string | number | null) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= items.length) return

    setItems((prev) => {
      const newItems = [...prev]
      const temp = newItems[index]
      newItems[index] = newItems[newIndex]
      newItems[newIndex] = temp
      return newItems
    })
  }

  const filteredExercises = availableExercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
      !items.some((item) => item.exercise_id === ex.id)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isEditing ? 'Edit' : 'New'} Exercise Block
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
                Block Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Leg Day Superset, Push Circuit"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional description..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
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

              {items.length === 0 ? (
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
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start gap-3">
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === items.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Exercise details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-2">
                            {item.exercise?.name || 'Unknown Exercise'}
                          </h4>
                          <div className="grid grid-cols-5 gap-2">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Label</label>
                              <input
                                type="text"
                                value={item.label || ''}
                                onChange={(e) => updateItem(index, 'label', e.target.value || null)}
                                placeholder="A1"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Sets</label>
                              <input
                                type="text"
                                value={item.sets || ''}
                                onChange={(e) => updateItem(index, 'sets', e.target.value)}
                                placeholder="3"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Reps</label>
                              <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => updateItem(index, 'reps', e.target.value)}
                                placeholder="10"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">RPE</label>
                              <input
                                type="text"
                                value={item.rpe || ''}
                                onChange={(e) => updateItem(index, 'rpe', e.target.value ? Number(e.target.value) : null)}
                                placeholder="8"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Rest</label>
                              <input
                                type="text"
                                value={item.rest_seconds || ''}
                                onChange={(e) => updateItem(index, 'rest_seconds', e.target.value ? Number(e.target.value) : null)}
                                placeholder="90"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
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
              disabled={saving || !name.trim()}
              className="px-6 py-2 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Block'}
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
                  placeholder="Search strength exercises..."
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredExercises.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">No strength exercises found</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredExercises.slice(0, 20).map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => addExercise(exercise)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-purple-500/50 transition-all text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 dark:text-white text-sm">{exercise.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{exercise.equipment || 'Bodyweight'}</p>
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
