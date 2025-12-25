'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MUSCLE_GROUPS,
  MOBILITY_FOCUS_AREAS,
  LOGGING_TYPES,
  EQUIPMENT_OPTIONS,
} from '@/lib/constants/exercises'

interface Exercise {
  id: string
  name: string
  type: 'strength' | 'mobility'
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
}

interface ExerciseModalProps {
  exercise: Exercise | null
  type: 'strength' | 'mobility'
  onClose: () => void
  onSave: () => void
}

// Extract YouTube video ID from various URL formats
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Get YouTube thumbnail URL from video ID
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}

export function ExerciseModal({ exercise, type, onClose, onSave }: ExerciseModalProps) {
  const isEditing = !!exercise
  const supabase = createClient()

  const [formData, setFormData] = useState({
    name: exercise?.name || '',
    type: type,
    primary_muscle: exercise?.primary_muscle || '',
    secondary_muscles: exercise?.secondary_muscles || [],
    focus_area: exercise?.focus_area || '',
    purpose: exercise?.purpose || '',
    equipment: exercise?.equipment || '',
    logging_type: exercise?.logging_type || (type === 'strength' ? 'weight_reps' : 'duration'),
    video_url: exercise?.video_url || '',
    video_thumbnail: exercise?.video_thumbnail || '',
    cues: exercise?.cues || '',
    default_sets: exercise?.default_sets || 3,
    default_reps: exercise?.default_reps || (type === 'strength' ? '10' : '30s'),
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showYouTubeImport, setShowYouTubeImport] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [importingYouTube, setImportingYouTube] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        primary_muscle: formData.primary_muscle || null,
        secondary_muscles: formData.secondary_muscles,
        focus_area: formData.focus_area || null,
        purpose: formData.purpose || null,
        equipment: formData.equipment || null,
        logging_type: formData.logging_type,
        video_url: formData.video_url || null,
        video_thumbnail: formData.video_thumbnail || null,
        cues: formData.cues || null,
        default_sets: formData.default_sets,
        default_reps: formData.default_reps,
      }

      if (isEditing && exercise) {
        const { error } = await supabase
          .from('exercises')
          .update(payload)
          .eq('id', exercise.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from('exercises').insert(payload)
        if (error) throw error
      }

      onSave()
    } catch (err) {
      console.error('Error saving exercise:', err)
      setError('Failed to save exercise. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleSecondaryMuscle = (muscle: string) => {
    setFormData((prev) => ({
      ...prev,
      secondary_muscles: prev.secondary_muscles.includes(muscle)
        ? prev.secondary_muscles.filter((m) => m !== muscle)
        : [...prev.secondary_muscles, muscle],
    }))
  }

  const handleYouTubeImport = async () => {
    const videoId = extractYouTubeVideoId(youtubeUrl)
    if (!videoId) {
      setError('Invalid YouTube URL. Please paste a valid YouTube link.')
      return
    }

    setImportingYouTube(true)
    setError(null)

    try {
      // Fetch video title using oEmbed API (no API key required)
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      )

      let title = ''
      if (response.ok) {
        const data = await response.json()
        title = data.title || ''
      }

      // Update form data with YouTube info
      setFormData((prev) => ({
        ...prev,
        name: prev.name || title,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        video_thumbnail: getYouTubeThumbnail(videoId),
      }))

      setShowYouTubeImport(false)
      setYoutubeUrl('')
    } catch (err) {
      console.error('Error fetching YouTube data:', err)
      // Still set the URL and thumbnail even if title fetch fails
      setFormData((prev) => ({
        ...prev,
        video_url: `https://www.youtube.com/watch?v=${videoId}`,
        video_thumbnail: getYouTubeThumbnail(videoId),
      }))
      setShowYouTubeImport(false)
      setYoutubeUrl('')
    } finally {
      setImportingYouTube(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {isEditing ? 'Edit Exercise' : `Add ${type === 'strength' ? 'Strength' : 'Mobility'} Exercise`}
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
                Exercise Name <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Barbell Bench Press"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Type-specific fields */}
            {type === 'strength' ? (
              <>
                {/* Primary Muscle */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Primary Muscle Group
                  </label>
                  <select
                    value={formData.primary_muscle}
                    onChange={(e) => setFormData({ ...formData, primary_muscle: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  >
                    <option value="">Select muscle group...</option>
                    {MUSCLE_GROUPS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Secondary Muscles */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Secondary Muscles
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MUSCLE_GROUPS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => toggleSecondaryMuscle(m.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          formData.secondary_muscles.includes(m.value)
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              /* Focus Area for Mobility */
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Focus Area
                </label>
                <select
                  value={formData.focus_area}
                  onChange={(e) => setFormData({ ...formData, focus_area: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                >
                  <option value="">Select focus area...</option>
                  {MOBILITY_FOCUS_AREAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Logging Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Logging Type
              </label>
              <select
                value={formData.logging_type}
                onChange={(e) => setFormData({ ...formData, logging_type: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              >
                {LOGGING_TYPES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Sets & Reps */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Default Sets
                </label>
                <input
                  type="number"
                  value={formData.default_sets}
                  onChange={(e) => setFormData({ ...formData, default_sets: parseInt(e.target.value) || 3 })}
                  min="1"
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Default Reps/Duration
                </label>
                <input
                  type="text"
                  value={formData.default_reps}
                  onChange={(e) => setFormData({ ...formData, default_reps: e.target.value })}
                  placeholder="e.g., 10, 8-12, 30s"
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Equipment
              </label>
              <select
                value={formData.equipment}
                onChange={(e) => setFormData({ ...formData, equipment: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              >
                <option value="">Select equipment...</option>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <option key={eq} value={eq}>
                    {eq}
                  </option>
                ))}
              </select>
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Purpose / Description
              </label>
              <textarea
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                rows={2}
                placeholder="What does this exercise target? Why would you use it?"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
              />
            </div>

            {/* Coaching Cues */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Coaching Cues
              </label>
              <textarea
                value={formData.cues}
                onChange={(e) => setFormData({ ...formData, cues: e.target.value })}
                rows={4}
                placeholder="One cue per line...&#10;Keep your chest up&#10;Drive through your heels&#10;Squeeze at the top"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none font-mono text-sm"
              />
            </div>

            {/* Video Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Demo Video
                </label>
                {!showYouTubeImport && !formData.video_url && (
                  <button
                    type="button"
                    onClick={() => setShowYouTubeImport(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    Import from YouTube
                  </button>
                )}
              </div>

              {/* YouTube Import Panel */}
              {showYouTubeImport && (
                <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">Import from YouTube</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="Paste YouTube URL..."
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleYouTubeImport()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleYouTubeImport}
                      disabled={importingYouTube || !youtubeUrl}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importingYouTube ? 'Importing...' : 'Import'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowYouTubeImport(false)
                        setYoutubeUrl('')
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Paste a YouTube link to auto-fill the video and thumbnail
                  </p>
                </div>
              )}

              {/* Video Preview or Manual URL Input */}
              {formData.video_url ? (
                <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  {formData.video_thumbnail && (
                    <div className="relative w-32 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-slate-700">
                      <img
                        src={formData.video_thumbnail}
                        alt="Video thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                      {formData.video_url}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <a
                        href={formData.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-500 font-medium"
                      >
                        Preview video
                      </a>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            video_url: '',
                            video_thumbnail: '',
                          }))
                          setShowYouTubeImport(true)
                        }}
                        className="text-xs text-red-500 hover:text-red-400 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : !showYouTubeImport && (
                <input
                  type="url"
                  value={formData.video_url}
                  onChange={(e) => {
                    const url = e.target.value
                    const videoId = extractYouTubeVideoId(url)
                    setFormData({
                      ...formData,
                      video_url: url,
                      video_thumbnail: videoId ? getYouTubeThumbnail(videoId) : '',
                    })
                  }}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
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
              className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Exercise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
