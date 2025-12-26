'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MUSCLE_GROUPS, MOBILITY_FOCUS_AREAS, LOGGING_TYPES } from '@/lib/constants/exercises'
import { ExerciseModal } from './ExerciseModal'
import { BulkImportModal } from './BulkImportModal'
import { PlaylistImportModal } from './PlaylistImportModal'

type ExerciseType = 'strength' | 'mobility'

interface Exercise {
  id: string
  name: string
  type: ExerciseType
  primary_muscle: string | null
  secondary_muscles: string[]
  focus_area: string | null
  purpose: string | null
  equipment: string | null
  logging_type: string
  video_url: string | null
  video_thumbnail: string | null
  cues: string | null
  default_sets: number
  default_reps: string
  created_at: string
}

export default function ExerciseLibraryPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ExerciseType>('strength')
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [playlistImportOpen, setPlaylistImportOpen] = useState(false)

  const supabase = createClient()

  const fetchExercises = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('type', activeTab)
      .order('name')

    if (error) {
      console.error('Error fetching exercises:', error)
    } else {
      setExercises(data || [])
    }
    setLoading(false)
  }, [supabase, activeTab])

  useEffect(() => {
    fetchExercises()
  }, [fetchExercises])

  const filterOptions = activeTab === 'strength' ? MUSCLE_GROUPS : MOBILITY_FOCUS_AREAS

  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter =
      !selectedFilter ||
      (activeTab === 'strength'
        ? ex.primary_muscle === selectedFilter
        : ex.focus_area === selectedFilter)
    return matchesSearch && matchesFilter
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) return

    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (error) {
      console.error('Error deleting exercise:', error)
    } else {
      fetchExercises()
    }
  }

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingExercise(null)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingExercise(null)
  }

  const handleModalSave = () => {
    fetchExercises()
    handleModalClose()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Exercise Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaylistImportOpen(true)}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            YouTube
          </button>
          <button
            onClick={() => setBulkImportOpen(true)}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Bulk Import
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Exercise
          </button>
        </div>
      </div>
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setActiveTab('strength')
              setSelectedFilter(null)
            }}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'strength'
                ? 'bg-purple-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            Strength
          </button>
          <button
            onClick={() => {
              setActiveTab('mobility')
              setSelectedFilter(null)
            }}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'mobility'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            Mobility
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-slate-400 dark:text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          />
        </div>

        {/* Filter Pills - Horizontal Scroll */}
        <div className="relative mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedFilter(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedFilter === null
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
              }`}
            >
              All
            </button>
            {filterOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedFilter(option.value)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  selectedFilter === option.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* Fade indicator on right */}
          <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent pointer-events-none" />
        </div>

        {/* Exercise Count */}
        <p className="text-slate-500 text-sm mb-4">
          {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
        </p>

        {/* Exercise Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400">No exercises found</p>
            <button
              onClick={handleAdd}
              className="mt-4 text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium"
            >
              Add your first exercise
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredExercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                type={activeTab}
                onEdit={() => handleEdit(exercise)}
                onDelete={() => handleDelete(exercise.id)}
              />
            ))}
          </div>
        )}

      {/* Modal */}
      {modalOpen && (
        <ExerciseModal
          exercise={editingExercise}
          type={activeTab}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      {/* Bulk Import Modal */}
      {bulkImportOpen && (
        <BulkImportModal
          onClose={() => setBulkImportOpen(false)}
          onSave={() => {
            setBulkImportOpen(false)
            fetchExercises()
          }}
        />
      )}

      {/* YouTube Import Modal */}
      {playlistImportOpen && (
        <PlaylistImportModal
          onClose={() => setPlaylistImportOpen(false)}
          onSave={() => {
            setPlaylistImportOpen(false)
            fetchExercises()
          }}
        />
      )}
    </div>
  )
}

function ExerciseCard({
  exercise,
  type,
  onEdit,
  onDelete,
}: {
  exercise: Exercise
  type: ExerciseType
  onEdit: () => void
  onDelete: () => void
}) {
  const filterLabel =
    type === 'strength'
      ? MUSCLE_GROUPS.find((m) => m.value === exercise.primary_muscle)?.label
      : MOBILITY_FOCUS_AREAS.find((f) => f.value === exercise.focus_area)?.label

  const loggingLabel = LOGGING_TYPES.find((l) => l.value === exercise.logging_type)?.label

  const hasWarning = !exercise.primary_muscle && type === 'strength' || !exercise.focus_area && type === 'mobility'

  return (
    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm">
      <div className="flex items-start gap-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg bg-slate-100 dark:bg-slate-800 flex-shrink-0 overflow-hidden">
          {exercise.video_thumbnail ? (
            <img
              src={exercise.video_thumbnail}
              alt={exercise.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                {hasWarning && (
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Missing required info">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{exercise.name}</h3>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {filterLabel && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-medium">
                    {filterLabel}
                  </span>
                )}
                {loggingLabel && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs">
                    {loggingLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {exercise.video_url && (
                <a
                  href={exercise.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  title="View Video"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </a>
              )}
              <button
                onClick={onEdit}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={onDelete}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Purpose */}
          {exercise.purpose && (
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 line-clamp-2">{exercise.purpose}</p>
          )}

          {/* Equipment */}
          {exercise.equipment && (
            <p className="text-slate-500 text-xs mt-2">
              <span className="text-slate-400 dark:text-slate-600">Equipment:</span> {exercise.equipment}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
