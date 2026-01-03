'use client'

import { useState, useRef, useEffect } from 'react'
import { GifPicker } from '@/components/GifPicker'
import { MediaUploader } from '@/components/MediaUploader'
import type { SendMessagePayload } from '@/types/messaging'

interface MessageInputProps {
  conversationId: string
  onSend: (payload: SendMessagePayload) => Promise<void>
  onSchedule?: (payload: SendMessagePayload) => void
  disabled?: boolean
}

export function MessageInput({ conversationId, onSend, onSchedule, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSend = async () => {
    if (!message.trim() || sending || disabled) return

    setSending(true)
    try {
      await onSend({ content: message.trim(), contentType: 'text' })
      setMessage('')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleGifSelect = async (gifUrl: string) => {
    setSending(true)
    try {
      await onSend({ contentType: 'gif', mediaUrl: gifUrl })
    } finally {
      setSending(false)
    }
  }

  const handleMediaUpload = async (url: string, type: 'image' | 'video') => {
    setSending(true)
    try {
      await onSend({ contentType: type, mediaUrl: url })
    } finally {
      setSending(false)
    }
  }

  const handleMediaError = (error: string) => {
    // Could show a toast notification here
    console.error('Media upload error:', error)
  }

  return (
    <div className="border-t border-slate-800 p-4">
      <div className="flex items-end gap-2">
        {/* Media upload button */}
        <MediaUploader
          conversationId={conversationId}
          onUploadComplete={handleMediaUpload}
          onError={handleMediaError}
        />

        {/* GIF button */}
        <div className="relative">
          <button
            onClick={() => setShowGifPicker(!showGifPicker)}
            disabled={disabled || sending}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            title="Send GIF"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.5 9H13v6h-1.5V9zM9 9H6c-.6 0-1 .5-1 1v4c0 .5.4 1 1 1h3c.6 0 1-.5 1-1v-2H8.5v1.5h-2v-3H10V10c0-.5-.4-1-1-1zm10 1.5V9h-4.5v6H16v-2h2v-1.5h-2v-1h3z"/>
            </svg>
          </button>
          <GifPicker
            isOpen={showGifPicker}
            onClose={() => setShowGifPicker(false)}
            onSelect={handleGifSelect}
          />
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled || sending}
            rows={1}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all disabled:opacity-50"
          />
        </div>

        {/* Schedule button (only if onSchedule provided) */}
        {onSchedule && (
          <button
            onClick={() => {
              if (message.trim()) {
                onSchedule({ content: message.trim(), contentType: 'text' })
                setMessage('')
              }
            }}
            disabled={!message.trim() || disabled || sending}
            className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Schedule message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled || sending}
          className="p-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
