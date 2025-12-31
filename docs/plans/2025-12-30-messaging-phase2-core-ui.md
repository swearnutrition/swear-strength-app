# Messaging System Phase 2: Core Messaging UI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build React hooks and UI components for the direct messaging feature between coach and clients.

**Architecture:** React hooks for data fetching and real-time updates, reusable components with Tailwind CSS styling following existing patterns.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase real-time

---

## Task 1: Create Message Types

**Files:**
- Create: `src/types/messaging.ts`

**Step 1: Write the types file**

```typescript
// Message and conversation types for the messaging system

export interface Message {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  senderRole: 'coach' | 'client'
  content: string | null
  contentType: 'text' | 'image' | 'gif' | 'video'
  mediaUrl: string | null
  isDeleted: boolean
  readAt: string | null
  createdAt: string
}

export interface Conversation {
  id: string
  clientId: string
  clientName: string
  clientAvatar: string | null
  lastMessageAt: string
  lastMessage: {
    content: string | null
    contentType: string
    senderId: string
    createdAt: string
  } | null
  unreadCount: number
}

export interface SendMessagePayload {
  content?: string
  contentType: 'text' | 'image' | 'gif' | 'video'
  mediaUrl?: string
}
```

**Step 2: Commit**

```bash
git add src/types/messaging.ts
git commit -m "feat: add messaging type definitions"
```

---

## Task 2: Create useConversations Hook

**Files:**
- Create: `src/hooks/useConversations.ts`

**Step 1: Write the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Conversation } from '@/types/messaging'

interface UseConversationsReturn {
  conversations: Conversation[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useConversations(): UseConversationsReturn {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/conversations')
      if (!res.ok) {
        throw new Error('Failed to fetch conversations')
      }
      const data = await res.json()
      setConversations(data.conversations || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching conversations:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations()

    // Subscribe to new messages for real-time updates
    const channel = supabase
      .channel('conversations_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch conversations when any message changes
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchConversations, supabase])

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useConversations.ts
git commit -m "feat: add useConversations hook with real-time updates"
```

---

## Task 3: Create useMessages Hook

**Files:**
- Create: `src/hooks/useMessages.ts`

**Step 1: Write the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, SendMessagePayload } from '@/types/messaging'

interface UseMessagesReturn {
  messages: Message[]
  loading: boolean
  error: string | null
  sendMessage: (payload: SendMessagePayload) => Promise<Message | null>
  deleteMessage: (messageId: string) => Promise<boolean>
  markAsRead: (messageId: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useMessages(conversationId: string | null): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([])
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/messages/conversations/${conversationId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch messages')
      }
      const data = await res.json()
      setMessages(data.messages || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    fetchMessages()

    if (!conversationId) return

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Add new message to the list
          const newMsg = payload.new as {
            id: string
            sender_id: string
            content: string | null
            content_type: 'text' | 'image' | 'gif' | 'video'
            media_url: string | null
            is_deleted: boolean
            read_at: string | null
            created_at: string
          }

          // Fetch the full message with sender info
          fetchMessages()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Refetch to get updated message (deleted or read status)
          fetchMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, fetchMessages, supabase])

  const sendMessage = async (payload: SendMessagePayload): Promise<Message | null> => {
    if (!conversationId) return null

    try {
      const res = await fetch(`/api/messages/conversations/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to send message')
      }

      const data = await res.json()
      return data.message
    } catch (err) {
      console.error('Error sending message:', err)
      return null
    }
  }

  const deleteMessage = async (messageId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
      })
      return res.ok
    } catch (err) {
      console.error('Error deleting message:', err)
      return false
    }
  }

  const markAsRead = async (messageId: string): Promise<void> => {
    try {
      await fetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH',
      })
    } catch (err) {
      console.error('Error marking message as read:', err)
    }
  }

  return {
    messages,
    loading,
    error,
    sendMessage,
    deleteMessage,
    markAsRead,
    refetch: fetchMessages,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useMessages.ts
git commit -m "feat: add useMessages hook with send, delete, and mark-read"
```

---

## Task 4: Create GifPicker Component

**Files:**
- Create: `src/components/GifPicker.tsx`

**Step 1: Write the component**

Extract the GIF picker logic from RivalryDetailClient into a reusable component.

```typescript
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

  // Search GIFs using Giphy
  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      setGifs([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'dc6zaTOxFJmzC'}&q=${encodeURIComponent(query)}&limit=12&rating=pg`
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
    setLoading(true)
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${process.env.NEXT_PUBLIC_GIPHY_API_KEY || 'dc6zaTOxFJmzC'}&limit=12&rating=pg`
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
```

**Step 2: Commit**

```bash
git add src/components/GifPicker.tsx
git commit -m "feat: add reusable GifPicker component"
```

---

## Task 5: Create MediaUploader Component

**Files:**
- Create: `src/components/MediaUploader.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import imageCompression from 'browser-image-compression'

interface MediaUploaderProps {
  conversationId: string
  onUploadComplete: (url: string, type: 'image' | 'video') => void
  onError: (error: string) => void
}

export function MediaUploader({ conversationId, onUploadComplete, onError }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setProgress(0)

    try {
      let processedFile = file
      let contentType: 'image' | 'video' = 'image'

      // Check file type
      if (file.type.startsWith('video/')) {
        contentType = 'video'
        // Check video duration
        const duration = await getVideoDuration(file)
        if (duration > 30) {
          throw new Error('Video must be 30 seconds or less')
        }
        // For now, upload video as-is (ffmpeg.wasm compression can be added later)
        processedFile = file
      } else if (file.type.startsWith('image/')) {
        contentType = 'image'
        // Convert HEIC/DNG to JPEG and compress
        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
          const heic2any = (await import('heic2any')).default
          const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 })
          processedFile = new File(
            [converted as Blob],
            file.name.replace(/\.heic$/i, '.jpg'),
            { type: 'image/jpeg' }
          )
        }

        // Compress image
        setProgress(20)
        processedFile = await imageCompression(processedFile, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          onProgress: (p) => setProgress(20 + p * 0.6),
        })
      } else {
        throw new Error('Unsupported file type')
      }

      setProgress(80)

      // Upload to Supabase Storage
      const fileExt = processedFile.name.split('.').pop() || 'jpg'
      const fileName = `${conversationId}/${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(fileName, processedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('messages')
        .getPublicUrl(fileName)

      setProgress(100)
      onUploadComplete(publicUrl, contentType)
    } catch (err) {
      console.error('Upload error:', err)
      onError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      video.onerror = () => reject(new Error('Could not read video'))
      video.src = URL.createObjectURL(file)
    })
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.heic"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
        title="Upload image or video"
      >
        {uploading ? (
          <div className="relative w-5 h-5">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Progress indicator */}
      {uploading && progress > 0 && (
        <div className="absolute -top-1 -right-1 w-4 h-4">
          <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 24 24">
            <circle
              className="text-slate-700"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="4"
              stroke="currentColor"
            />
            <circle
              className="text-purple-500"
              cx="12"
              cy="12"
              r="10"
              fill="none"
              strokeWidth="4"
              stroke="currentColor"
              strokeDasharray={`${progress * 0.628} 62.8`}
            />
          </svg>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/MediaUploader.tsx
git commit -m "feat: add MediaUploader component with compression"
```

---

## Task 6: Create MessageBubble Component

**Files:**
- Create: `src/components/messaging/MessageBubble.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import type { Message } from '@/types/messaging'

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
  showAvatar: boolean
  onDelete?: (messageId: string) => void
}

export function MessageBubble({ message, isOwnMessage, showAvatar, onDelete }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false)

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (message.isDeleted) {
    return (
      <div className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
        {showAvatar && !isOwnMessage && (
          <Avatar name={message.senderName} src={message.senderAvatar} size="sm" />
        )}
        {!showAvatar && !isOwnMessage && <div className="w-8" />}
        <div className="px-4 py-2 rounded-2xl bg-slate-800/50 text-slate-500 italic text-sm">
          Message deleted
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-end gap-2 group ${isOwnMessage ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Avatar */}
      {showAvatar && !isOwnMessage && (
        <Avatar name={message.senderName} src={message.senderAvatar} size="sm" />
      )}
      {!showAvatar && !isOwnMessage && <div className="w-8" />}

      {/* Message content */}
      <div className="max-w-[70%] relative">
        <div
          className={`
            rounded-2xl overflow-hidden
            ${isOwnMessage
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
              : 'bg-slate-800 text-white'
            }
            ${message.contentType === 'text' ? 'px-4 py-2' : 'p-1'}
          `}
        >
          {message.contentType === 'text' && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {message.contentType === 'image' && message.mediaUrl && (
            <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.mediaUrl}
                alt="Image"
                className="max-w-full rounded-xl max-h-64 object-contain"
                loading="lazy"
              />
            </a>
          )}

          {message.contentType === 'gif' && message.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.mediaUrl}
              alt="GIF"
              className="max-w-full rounded-xl max-h-64"
              loading="lazy"
            />
          )}

          {message.contentType === 'video' && message.mediaUrl && (
            <video
              src={message.mediaUrl}
              controls
              className="max-w-full rounded-xl max-h-64"
              preload="metadata"
            />
          )}
        </div>

        {/* Time and read status */}
        <div className={`flex items-center gap-1 mt-1 text-xs text-slate-500 ${isOwnMessage ? 'justify-end' : ''}`}>
          <span>{formatTime(message.createdAt)}</span>
          {isOwnMessage && message.readAt && (
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Delete menu */}
        {isOwnMessage && onDelete && showMenu && (
          <button
            onClick={() => onDelete(message.id)}
            className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete message"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/messaging/MessageBubble.tsx
git commit -m "feat: add MessageBubble component with media support"
```

---

## Task 7: Create MessageThread Component

**Files:**
- Create: `src/components/messaging/MessageThread.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@/types/messaging'

interface MessageThreadProps {
  messages: Message[]
  currentUserId: string
  onDeleteMessage?: (messageId: string) => void
  onMarkAsRead?: (messageId: string) => void
  isCoach: boolean
}

export function MessageThread({
  messages,
  currentUserId,
  onDeleteMessage,
  onMarkAsRead,
  isCoach,
}: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when they become visible (coach only sees client messages as read)
  useEffect(() => {
    if (!onMarkAsRead || !isCoach) return

    const unreadMessages = messages.filter(
      (m) => m.senderId !== currentUserId && !m.readAt && !m.isDeleted
    )

    unreadMessages.forEach((m) => {
      onMarkAsRead(m.id)
    })
  }, [messages, currentUserId, onMarkAsRead, isCoach])

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let currentDate = ''

  messages.forEach((message) => {
    const messageDate = new Date(message.createdAt).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })

    if (messageDate !== currentDate) {
      currentDate = messageDate
      groupedMessages.push({ date: messageDate, messages: [message] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message)
    }
  })

  // Check if should show avatar (first message from sender in a sequence)
  const shouldShowAvatar = (messages: Message[], index: number) => {
    if (index === 0) return true
    return messages[index].senderId !== messages[index - 1].senderId
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>No messages yet</p>
          <p className="text-sm mt-1">Start the conversation!</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-slate-800 px-3 py-1 rounded-full text-xs text-slate-400">
              {group.date}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {group.messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.senderId === currentUserId}
                showAvatar={shouldShowAvatar(group.messages, index)}
                onDelete={onDeleteMessage}
              />
            ))}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/messaging/MessageThread.tsx
git commit -m "feat: add MessageThread component with date grouping"
```

---

## Task 8: Create MessageInput Component

**Files:**
- Create: `src/components/messaging/MessageInput.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState, useRef, useEffect } from 'react'
import { GifPicker } from '@/components/GifPicker'
import { MediaUploader } from '@/components/MediaUploader'
import type { SendMessagePayload } from '@/types/messaging'

interface MessageInputProps {
  conversationId: string
  onSend: (payload: SendMessagePayload) => Promise<void>
  disabled?: boolean
}

export function MessageInput({ conversationId, onSend, disabled }: MessageInputProps) {
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
```

**Step 2: Commit**

```bash
git add src/components/messaging/MessageInput.tsx
git commit -m "feat: add MessageInput component with GIF and media support"
```

---

## Task 9: Create ConversationList Component

**Files:**
- Create: `src/components/messaging/ConversationList.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { Avatar } from '@/components/ui/Avatar'
import type { Conversation } from '@/types/messaging'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (conversationId: string) => void
  loading?: boolean
}

export function ConversationList({ conversations, selectedId, onSelect, loading }: ConversationListProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getMessagePreview = (conversation: Conversation) => {
    if (!conversation.lastMessage) return 'No messages yet'

    const { contentType, content } = conversation.lastMessage

    switch (contentType) {
      case 'image':
        return '📷 Photo'
      case 'video':
        return '🎥 Video'
      case 'gif':
        return 'GIF'
      default:
        return content || 'Message'
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded w-24" />
              <div className="h-3 bg-slate-800 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 p-8">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">No conversations yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
            selectedId === conversation.id
              ? 'bg-purple-500/10 border-l-2 border-purple-500'
              : 'hover:bg-slate-800/50 border-l-2 border-transparent'
          }`}
        >
          <div className="relative">
            <Avatar name={conversation.clientName} src={conversation.clientAvatar} size="lg" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`font-medium truncate ${
                conversation.unreadCount > 0 ? 'text-white' : 'text-slate-300'
              }`}>
                {conversation.clientName}
              </span>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ''}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className={`text-sm truncate ${
                conversation.unreadCount > 0 ? 'text-slate-300' : 'text-slate-500'
              }`}>
                {getMessagePreview(conversation)}
              </p>
              {conversation.unreadCount > 0 && (
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-purple-500 text-white text-xs font-bold rounded-full">
                  {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/messaging/ConversationList.tsx
git commit -m "feat: add ConversationList component"
```

---

## Task 10: Create Coach Messages Page

**Files:**
- Create: `src/app/coach/messages/page.tsx`

**Step 1: Write the page**

```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachMessagesClient } from './CoachMessagesClient'

export const metadata = {
  title: 'Messages | Swear Strength',
}

export default async function CoachMessagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name, avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    redirect('/dashboard')
  }

  return <CoachMessagesClient userId={user.id} userName={profile.name || 'Coach'} />
}
```

**Step 2: Create the client component**

Create file: `src/app/coach/messages/CoachMessagesClient.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { ConversationList } from '@/components/messaging/ConversationList'
import { MessageThread } from '@/components/messaging/MessageThread'
import { MessageInput } from '@/components/messaging/MessageInput'
import { Avatar } from '@/components/ui/Avatar'
import type { SendMessagePayload } from '@/types/messaging'

interface CoachMessagesClientProps {
  userId: string
  userName: string
}

export function CoachMessagesClient({ userId, userName }: CoachMessagesClientProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const { conversations, loading: conversationsLoading } = useConversations()
  const { messages, loading: messagesLoading, sendMessage, deleteMessage, markAsRead } = useMessages(selectedConversationId)

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  const handleSendMessage = async (payload: SendMessagePayload) => {
    await sendMessage(payload)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversations sidebar */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-semibold text-white">Messages</h1>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          loading={conversationsLoading}
        />
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-800">
              <Avatar
                name={selectedConversation.clientName}
                src={selectedConversation.clientAvatar}
                size="md"
              />
              <div>
                <h2 className="font-semibold text-white">{selectedConversation.clientName}</h2>
              </div>
            </div>

            {/* Messages */}
            {messagesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <MessageThread
                messages={messages}
                currentUserId={userId}
                onDeleteMessage={deleteMessage}
                onMarkAsRead={markAsRead}
                isCoach={true}
              />
            )}

            {/* Input */}
            <MessageInput
              conversationId={selectedConversation.id}
              onSend={handleSendMessage}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose a client to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/coach/messages/page.tsx src/app/coach/messages/CoachMessagesClient.tsx
git commit -m "feat: add coach messages page"
```

---

## Task 11: Create Client Messages Page

**Files:**
- Create: `src/app/(client)/messages/page.tsx`
- Create: `src/app/(client)/messages/ClientMessagesClient.tsx`

**Step 1: Write the server page**

```typescript
// src/app/(client)/messages/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientMessagesClient } from './ClientMessagesClient'

export const metadata = {
  title: 'Messages | Swear Strength',
}

export default async function ClientMessagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name, avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'client') {
    redirect('/coach')
  }

  // Get the client's conversation
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/messages/my-conversation`, {
    headers: {
      cookie: (await import('next/headers')).cookies().toString(),
    },
  })

  let conversationId: string | null = null
  if (res.ok) {
    const data = await res.json()
    conversationId = data.conversation?.id || null
  }

  return (
    <ClientMessagesClient
      userId={user.id}
      userName={profile?.name || 'Client'}
      conversationId={conversationId}
    />
  )
}
```

**Step 2: Write the client component**

```typescript
// src/app/(client)/messages/ClientMessagesClient.tsx
'use client'

import { useMessages } from '@/hooks/useMessages'
import { MessageThread } from '@/components/messaging/MessageThread'
import { MessageInput } from '@/components/messaging/MessageInput'
import type { SendMessagePayload } from '@/types/messaging'

interface ClientMessagesClientProps {
  userId: string
  userName: string
  conversationId: string | null
}

export function ClientMessagesClient({ userId, userName, conversationId }: ClientMessagesClientProps) {
  const { messages, loading, sendMessage, deleteMessage } = useMessages(conversationId)

  const handleSendMessage = async (payload: SendMessagePayload) => {
    await sendMessage(payload)
  }

  if (!conversationId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium">No conversation yet</p>
          <p className="text-sm mt-1">Your coach will start a conversation with you soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <h1 className="text-lg font-semibold text-white">Messages</h1>
        <p className="text-sm text-slate-400">Chat with your coach</p>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <MessageThread
            messages={messages}
            currentUserId={userId}
            onDeleteMessage={deleteMessage}
            isCoach={false}
          />
        )}

        {/* Input */}
        <MessageInput
          conversationId={conversationId}
          onSend={handleSendMessage}
        />
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(client\)/messages/page.tsx src/app/\(client\)/messages/ClientMessagesClient.tsx
git commit -m "feat: add client messages page"
```

---

## Task 12: Add Messages to Coach Sidebar Navigation

**Files:**
- Modify: `src/app/coach/CoachSidebar.tsx`

**Step 1: Add Messages nav item to the Overview section**

Find the navigation array and add Messages after Dashboard in the Overview section:

```typescript
// In the navigation array, Overview section items array, add after Dashboard:
{
  name: 'Messages',
  href: '/coach/messages',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
},
```

**Step 2: Commit**

```bash
git add src/app/coach/CoachSidebar.tsx
git commit -m "feat: add Messages link to coach sidebar navigation"
```

---

## Task 13: Install Required Dependencies

**Step 1: Install browser-image-compression and heic2any**

```bash
npm install browser-image-compression heic2any
```

**Step 2: Add type declarations if needed**

If TypeScript complains about heic2any, create a declaration file:

Create file: `src/types/heic2any.d.ts`

```typescript
declare module 'heic2any' {
  interface Options {
    blob: Blob
    toType?: string
    quality?: number
  }

  function heic2any(options: Options): Promise<Blob | Blob[]>

  export default heic2any
}
```

**Step 3: Commit**

```bash
git add package.json package-lock.json src/types/heic2any.d.ts
git commit -m "feat: add image compression dependencies"
```

---

## Task 14: Create index exports for messaging components

**Files:**
- Create: `src/components/messaging/index.ts`

**Step 1: Write the index file**

```typescript
export { MessageBubble } from './MessageBubble'
export { MessageThread } from './MessageThread'
export { MessageInput } from './MessageInput'
export { ConversationList } from './ConversationList'
```

**Step 2: Commit**

```bash
git add src/components/messaging/index.ts
git commit -m "feat: add messaging components index export"
```

---

## Summary

Phase 2 creates the complete messaging UI:

| Component | Purpose |
|-----------|---------|
| `src/types/messaging.ts` | Type definitions |
| `useConversations` | Hook for conversation list with real-time |
| `useMessages` | Hook for messages with send/delete/read |
| `GifPicker` | Reusable GIF search component |
| `MediaUploader` | Image/video upload with compression |
| `MessageBubble` | Single message display |
| `MessageThread` | Message list with date grouping |
| `MessageInput` | Text/GIF/media input |
| `ConversationList` | Conversation sidebar |
| Coach Messages Page | Full messaging UI for coach |
| Client Messages Page | Messaging UI for clients |

**Next Phase:** Phase 3 will add announcements UI and push notifications.
