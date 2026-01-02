'use client'

import { useState, useEffect } from 'react'

interface Gif {
  id: string
  url: string
  preview: string
}

interface GifPickerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (gifUrl: string) => void
}

export function GifPicker({ isOpen, onClose, onSelect }: GifPickerProps) {
  const [search, setSearch] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [loading, setLoading] = useState(false)

  const apiKey = process.env.NEXT_PUBLIC_GIPHY_API_KEY

  // Search GIFs using Giphy
  const searchGifs = async (query: string) => {
    if (!query.trim() || !apiKey) {
      setGifs([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=12&rating=pg`
      )
      const data = await res.json()
      setGifs(
        data.data.map((g: { id: string; images: { original: { url: string }; fixed_width_small: { url: string } } }) => ({
          id: g.id,
          url: g.images.original.url,
          preview: g.images.fixed_width_small.url,
        }))
      )
    } catch (error) {
      console.error('Failed to search GIFs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load trending GIFs on open
  const loadTrending = async () => {
    if (!apiKey) {
      setGifs([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=12&rating=pg`
      )
      const data = await res.json()
      setGifs(
        data.data.map((g: { id: string; images: { original: { url: string }; fixed_width_small: { url: string } } }) => ({
          id: g.id,
          url: g.images.original.url,
          preview: g.images.fixed_width_small.url,
        }))
      )
    } catch (error) {
      console.error('Failed to load trending GIFs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (!isOpen) return

    if (!search.trim()) {
      loadTrending()
      return
    }

    const timer = setTimeout(() => {
      searchGifs(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search, isOpen])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setGifs([])
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
      {/* Search input */}
      <div className="p-3 border-b border-slate-700">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search GIFs..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          autoFocus
        />
      </div>

      {/* GIF grid */}
      <div className="p-2 max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : !apiKey ? (
          <p className="text-center text-slate-500 py-8 text-sm">
            GIF search not configured.<br />
            <span className="text-xs">Add NEXT_PUBLIC_GIPHY_API_KEY to .env.local</span>
          </p>
        ) : gifs.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => {
                  onSelect(gif.url)
                  onClose()
                }}
                className="aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500 transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.preview}
                  alt="GIF"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8 text-sm">
            {search ? 'No GIFs found' : 'Search for GIFs'}
          </p>
        )}
      </div>

      {/* Giphy attribution */}
      <div className="px-3 py-2 border-t border-slate-700 text-center">
        <span className="text-xs text-slate-500">Powered by GIPHY</span>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
