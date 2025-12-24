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
    setSearchQuery('')
    setSelectedMuscle(null)
    setSelectedFocus(null)
    onClose()
  }

  const handleClose = () => {
    setSelected(new Set())
    setSearchQuery('')
    setSelectedMuscle(null)
    setSelectedFocus(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Browse Exercises" size="xl">
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
          onClick={handleClose}
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
