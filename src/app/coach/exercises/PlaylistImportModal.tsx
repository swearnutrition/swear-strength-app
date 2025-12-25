'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MUSCLE_GROUPS, MOBILITY_FOCUS_AREAS } from '@/lib/constants/exercises'

const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY

interface PlaylistVideo {
  id: string
  videoId: string
  title: string
  thumbnail: string
  selected: boolean
  type: 'strength' | 'mobility'
  primary_muscle?: string
  focus_area?: string
}

interface PlaylistImportModalProps {
  onClose: () => void
  onSave: () => void
}

// Extract playlist ID from various YouTube playlist URL formats
function extractPlaylistId(url: string): string | null {
  const patterns = [
    /[?&]list=([a-zA-Z0-9_-]+)/,
    /playlist\?list=([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

// Extract video ID from URL
function extractVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  )
  return match ? match[1] : null
}

export function PlaylistImportModal({ onClose, onSave }: PlaylistImportModalProps) {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [videos, setVideos] = useState<PlaylistVideo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [defaultType, setDefaultType] = useState<'strength' | 'mobility'>('strength')

  const supabase = createClient()

  const fetchPlaylist = async () => {
    const playlistId = extractPlaylistId(playlistUrl)
    if (!playlistId) {
      setError('Invalid YouTube playlist URL. Please paste a valid playlist link.')
      return
    }

    if (!YOUTUBE_API_KEY) {
      setError(
        'YouTube API key not configured. Please add NEXT_PUBLIC_YOUTUBE_API_KEY to your .env.local file. You can still paste individual video URLs below.'
      )
      return
    }

    setLoading(true)
    setError(null)
    setVideos([])

    try {
      const allVideos: PlaylistVideo[] = []
      let nextPageToken: string | undefined

      // Fetch all pages of the playlist
      do {
        const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
        url.searchParams.set('part', 'snippet')
        url.searchParams.set('playlistId', playlistId)
        url.searchParams.set('maxResults', '50')
        url.searchParams.set('key', YOUTUBE_API_KEY)
        if (nextPageToken) {
          url.searchParams.set('pageToken', nextPageToken)
        }

        const response = await fetch(url.toString())

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'Failed to fetch playlist')
        }

        const data = await response.json()

        for (const item of data.items) {
          const videoId = item.snippet?.resourceId?.videoId
          if (!videoId) continue

          allVideos.push({
            id: videoId,
            videoId: videoId,
            title: item.snippet.title || `Video ${videoId}`,
            thumbnail: item.snippet.thumbnails?.medium?.url ||
                       item.snippet.thumbnails?.default?.url ||
                       `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            selected: true,
            type: defaultType,
          })
        }

        nextPageToken = data.nextPageToken
      } while (nextPageToken)

      if (allVideos.length === 0) {
        setError('No videos found in this playlist.')
      } else {
        setVideos(allVideos)
        setPlaylistUrl('')
      }
    } catch (err) {
      console.error('Error fetching playlist:', err)
      setError(
        err instanceof Error
          ? `Error: ${err.message}`
          : 'Could not fetch playlist. Check your API key and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleMultipleUrls = async (urlText: string) => {
    const urls = urlText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0)

    if (urls.length === 0) return

    setLoading(true)
    setError(null)

    const newVideos: PlaylistVideo[] = []

    for (const url of urls) {
      const videoId = extractVideoId(url)
      if (!videoId) continue

      try {
        // Fetch video title via oEmbed
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        )

        let title = `Video ${videoId}`
        if (response.ok) {
          const data = await response.json()
          title = data.title || title
        }

        newVideos.push({
          id: videoId,
          videoId: videoId,
          title: title,
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          selected: true,
          type: defaultType,
        })
      } catch (err) {
        // Still add the video even if we can't get the title
        newVideos.push({
          id: videoId,
          videoId: videoId,
          title: `Video ${videoId}`,
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          selected: true,
          type: defaultType,
        })
      }
    }

    setVideos((prev) => [...prev, ...newVideos])
    setLoading(false)
  }

  const toggleVideo = (id: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, selected: !v.selected } : v))
    )
  }

  const toggleAll = (selected: boolean) => {
    setVideos((prev) => prev.map((v) => ({ ...v, selected })))
  }

  const updateVideoType = (id: string, type: 'strength' | 'mobility') => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, type, primary_muscle: undefined, focus_area: undefined } : v
      )
    )
  }

  const updateVideoMuscle = (id: string, muscle: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, primary_muscle: muscle } : v))
    )
  }

  const updateVideoFocus = (id: string, focus: string) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, focus_area: focus } : v))
    )
  }

  const removeVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id))
  }

  const handleSave = async () => {
    const selectedVideos = videos.filter((v) => v.selected)
    if (selectedVideos.length === 0) {
      setError('No videos selected')
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

      const toInsert: typeof selectedVideos = []
      const toUpdate: { id: string; data: Record<string, unknown> }[] = []

      for (const v of selectedVideos) {
        const videoData = {
          video_url: `https://www.youtube.com/watch?v=${v.videoId}`,
          video_thumbnail: v.thumbnail,
        }

        const fullData = {
          name: v.title,
          type: v.type,
          primary_muscle: v.type === 'strength' ? v.primary_muscle || null : null,
          focus_area: v.type === 'mobility' ? v.focus_area || null : null,
          secondary_muscles: [],
          video_url: `https://www.youtube.com/watch?v=${v.videoId}`,
          video_thumbnail: v.thumbnail,
          logging_type: v.type === 'strength' ? 'weight_reps' : 'duration',
          default_sets: 3,
          default_reps: v.type === 'strength' ? '10' : '30s',
        }

        const existingId = existingMap.get(v.title.toLowerCase().trim())
        if (existingId) {
          // Update existing - only add video URL and thumbnail, preserve other data
          toUpdate.push({ id: existingId, data: videoData })
        } else {
          toInsert.push(v)
        }
      }

      // Insert new exercises
      if (toInsert.length > 0) {
        const inserts = toInsert.map((v) => ({
          name: v.title,
          type: v.type,
          primary_muscle: v.type === 'strength' ? v.primary_muscle || null : null,
          focus_area: v.type === 'mobility' ? v.focus_area || null : null,
          secondary_muscles: [],
          video_url: `https://www.youtube.com/watch?v=${v.videoId}`,
          video_thumbnail: v.thumbnail,
          logging_type: v.type === 'strength' ? 'weight_reps' : 'duration',
          default_sets: 3,
          default_reps: v.type === 'strength' ? '10' : '30s',
        }))

        const { error: insertError } = await supabase.from('exercises').insert(inserts)
        if (insertError) throw insertError
      }

      // Update existing exercises with video info
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
      setError('Failed to save exercises. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = videos.filter((v) => v.selected).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Import from YouTube
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 text-amber-700 dark:text-amber-400 text-sm">
                {error}
              </div>
            )}

            {/* URL Input */}
            {videos.length === 0 && (
              <div className="space-y-6">
                {/* Playlist URL Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Import from Playlist
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={playlistUrl}
                      onChange={(e) => setPlaylistUrl(e.target.value)}
                      placeholder="https://www.youtube.com/playlist?list=..."
                      className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          fetchPlaylist()
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={fetchPlaylist}
                      disabled={loading || !playlistUrl}
                      className="px-5 py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Fetch Playlist
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {YOUTUBE_API_KEY
                      ? 'Paste a YouTube playlist URL to import all videos at once'
                      : 'Add NEXT_PUBLIC_YOUTUBE_API_KEY to .env.local for playlist support'}
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-white dark:bg-slate-900 text-slate-500">or paste individual URLs</span>
                  </div>
                </div>

                {/* Individual URLs Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Paste YouTube Video URLs (one per line)
                  </label>
                  <textarea
                    rows={5}
                    placeholder={`https://www.youtube.com/watch?v=abc123
https://youtu.be/def456
https://www.youtube.com/watch?v=ghi789`}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none font-mono text-sm"
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        handleMultipleUrls(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.metaKey) {
                        const target = e.target as HTMLTextAreaElement
                        if (target.value.trim()) {
                          handleMultipleUrls(target.value)
                          target.value = ''
                        }
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Press Cmd+Enter or click outside to fetch videos
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Default type:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDefaultType('strength')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        defaultType === 'strength'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Strength
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultType('mobility')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        defaultType === 'mobility'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Mobility
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
                <span className="ml-3 text-slate-600 dark:text-slate-400">Fetching videos...</span>
              </div>
            )}

            {/* Video List */}
            {videos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedCount} of {videos.length} videos selected
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAll(true)}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-500 font-medium"
                    >
                      Select all
                    </button>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={() => toggleAll(false)}
                      className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>

                {/* Add more videos input */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <input
                    type="text"
                    placeholder="Paste another YouTube URL and press Enter..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const target = e.target as HTMLInputElement
                        if (target.value.trim()) {
                          handleMultipleUrls(target.value)
                          target.value = ''
                        }
                      }
                    }}
                  />
                </div>

                <div className="space-y-3">
                  {videos.map((video) => (
                    <div
                      key={video.id}
                      className={`p-4 rounded-xl border transition-all ${
                        video.selected
                          ? 'bg-white dark:bg-slate-800/50 border-purple-200 dark:border-purple-500/30'
                          : 'bg-slate-50 dark:bg-slate-800/20 border-slate-200 dark:border-slate-700 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => toggleVideo(video.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 mt-1 transition-all ${
                            video.selected
                              ? 'bg-purple-600 border-purple-600 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {video.selected && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {/* Thumbnail */}
                        <div className="relative w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200 dark:bg-slate-700">
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm line-clamp-1">
                            {video.title}
                          </h4>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {/* Type selector */}
                            <select
                              value={video.type}
                              onChange={(e) =>
                                updateVideoType(video.id, e.target.value as 'strength' | 'mobility')
                              }
                              className="text-xs bg-slate-100 dark:bg-slate-700 border-0 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="strength">Strength</option>
                              <option value="mobility">Mobility</option>
                            </select>

                            {/* Muscle/Focus selector */}
                            {video.type === 'strength' ? (
                              <select
                                value={video.primary_muscle || ''}
                                onChange={(e) => updateVideoMuscle(video.id, e.target.value)}
                                className="text-xs bg-slate-100 dark:bg-slate-700 border-0 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select muscle...</option>
                                {MUSCLE_GROUPS.map((m) => (
                                  <option key={m.value} value={m.value}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <select
                                value={video.focus_area || ''}
                                onChange={(e) => updateVideoFocus(video.id, e.target.value)}
                                className="text-xs bg-slate-100 dark:bg-slate-700 border-0 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select focus...</option>
                                {MOBILITY_FOCUS_AREAS.map((f) => (
                                  <option key={f.value} value={f.value}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => removeVideo(video.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div>
            {videos.length > 0 && (
              <button
                type="button"
                onClick={() => setVideos([])}
                className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            {videos.length > 0 && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || selectedCount === 0}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? 'Importing...'
                  : `Import ${selectedCount} Exercise${selectedCount !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
