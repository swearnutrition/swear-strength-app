# Messaging System Phase 3: Announcements & Push Notifications

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build announcements UI for coach and clients, add push notification support, and integrate unread badges into navigation.

**Architecture:** React components for announcements, Web Push API for notifications, nav badge components for unread counts.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Web Push API, web-push npm package

---

## Task 1: Create Announcement Types

**Files:**
- Modify: `src/types/messaging.ts`

**Step 1: Add announcement types to the existing file**

Add to the end of the file:

```typescript
// Announcement types

export interface Announcement {
  id: string
  title: string
  content: string
  isPinned: boolean
  sendPush: boolean
  targetType: 'all' | 'selected'
  createdAt: string
  readCount: number
  totalCount: number
}

export interface ClientAnnouncement {
  id: string
  recipientId: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  readAt: string | null
}

export interface CreateAnnouncementPayload {
  title: string
  content: string
  isPinned?: boolean
  sendPush?: boolean
  targetType: 'all' | 'selected'
  selectedClientIds?: string[]
}
```

**Step 2: Commit**

```bash
git add src/types/messaging.ts
git commit -m "feat: add announcement type definitions"
```

---

## Task 2: Create useAnnouncements Hook

**Files:**
- Create: `src/hooks/useAnnouncements.ts`

**Step 1: Write the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Announcement, ClientAnnouncement, CreateAnnouncementPayload } from '@/types/messaging'

interface UseAnnouncementsReturn {
  announcements: Announcement[] | ClientAnnouncement[]
  loading: boolean
  error: string | null
  createAnnouncement: (payload: CreateAnnouncementPayload) => Promise<Announcement | null>
  deleteAnnouncement: (id: string) => Promise<boolean>
  markAsRead: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useAnnouncements(isCoach: boolean): UseAnnouncementsReturn {
  const [announcements, setAnnouncements] = useState<Announcement[] | ClientAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch('/api/announcements')
      if (!res.ok) {
        throw new Error('Failed to fetch announcements')
      }
      const data = await res.json()
      setAnnouncements(data.announcements || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching announcements:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnnouncements()

    // Subscribe to new announcements (for clients)
    const channel = supabase
      .channel('announcements_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcement_recipients',
        },
        () => {
          fetchAnnouncements()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'announcements',
        },
        () => {
          fetchAnnouncements()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchAnnouncements, supabase])

  const createAnnouncement = async (payload: CreateAnnouncementPayload): Promise<Announcement | null> => {
    if (!isCoach) return null

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error('Failed to create announcement')
      }

      const data = await res.json()
      await fetchAnnouncements()
      return data.announcement
    } catch (err) {
      console.error('Error creating announcement:', err)
      return null
    }
  }

  const deleteAnnouncement = async (id: string): Promise<boolean> => {
    if (!isCoach) return false

    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await fetchAnnouncements()
      }
      return res.ok
    } catch (err) {
      console.error('Error deleting announcement:', err)
      return false
    }
  }

  const markAsRead = async (id: string): Promise<void> => {
    try {
      await fetch(`/api/announcements/${id}/read`, {
        method: 'PATCH',
      })
      await fetchAnnouncements()
    } catch (err) {
      console.error('Error marking announcement as read:', err)
    }
  }

  return {
    announcements,
    loading,
    error,
    createAnnouncement,
    deleteAnnouncement,
    markAsRead,
    refetch: fetchAnnouncements,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useAnnouncements.ts
git commit -m "feat: add useAnnouncements hook"
```

---

## Task 3: Create useUnreadCounts Hook

**Files:**
- Create: `src/hooks/useUnreadCounts.ts`

**Step 1: Write the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UnreadCounts {
  messages: number
  announcements: number
  total: number
}

interface UseUnreadCountsReturn {
  counts: UnreadCounts
  loading: boolean
  refetch: () => Promise<void>
}

export function useUnreadCounts(userId: string, isCoach: boolean): UseUnreadCountsReturn {
  const [counts, setCounts] = useState<UnreadCounts>({ messages: 0, announcements: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchCounts = useCallback(async () => {
    try {
      let messageCount = 0
      let announcementCount = 0

      if (isCoach) {
        // Coach: count unread messages from clients
        const { data: conversations } = await supabase
          .from('conversations')
          .select(`
            client_id,
            messages(id, sender_id, read_at, is_deleted)
          `)

        if (conversations) {
          conversations.forEach((conv) => {
            const messages = conv.messages || []
            messageCount += messages.filter(
              (m: { sender_id: string; read_at: string | null; is_deleted: boolean }) =>
                m.sender_id === conv.client_id && !m.read_at && !m.is_deleted
            ).length
          })
        }
      } else {
        // Client: count unread messages from coach
        const { data: conversation } = await supabase
          .from('conversations')
          .select(`messages(id, sender_id, read_at, is_deleted)`)
          .eq('client_id', userId)
          .single()

        if (conversation?.messages) {
          messageCount = conversation.messages.filter(
            (m: { sender_id: string; read_at: string | null; is_deleted: boolean }) =>
              m.sender_id !== userId && !m.read_at && !m.is_deleted
          ).length
        }

        // Client: count unread announcements
        const { count } = await supabase
          .from('announcement_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', userId)
          .is('read_at', null)

        announcementCount = count || 0
      }

      setCounts({
        messages: messageCount,
        announcements: announcementCount,
        total: messageCount + announcementCount,
      })
    } catch (err) {
      console.error('Error fetching unread counts:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, isCoach, supabase])

  useEffect(() => {
    fetchCounts()

    // Subscribe to changes
    const channel = supabase
      .channel(`unread_counts_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => fetchCounts()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'announcement_recipients',
        },
        () => fetchCounts()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchCounts, supabase, userId])

  return {
    counts,
    loading,
    refetch: fetchCounts,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useUnreadCounts.ts
git commit -m "feat: add useUnreadCounts hook for nav badges"
```

---

## Task 4: Create AnnouncementCard Component

**Files:**
- Create: `src/components/announcements/AnnouncementCard.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState } from 'react'
import type { Announcement, ClientAnnouncement } from '@/types/messaging'

interface AnnouncementCardProps {
  announcement: Announcement | ClientAnnouncement
  isCoach: boolean
  onDelete?: (id: string) => void
  onMarkAsRead?: (id: string) => void
}

export function AnnouncementCard({ announcement, isCoach, onDelete, onMarkAsRead }: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isRead = 'readAt' in announcement ? !!announcement.readAt : true
  const isPinned = announcement.isPinned

  const handleClick = () => {
    setExpanded(!expanded)
    if (!isRead && onMarkAsRead && 'readAt' in announcement) {
      onMarkAsRead(announcement.id)
    }
  }

  return (
    <div
      className={`
        rounded-xl border transition-all cursor-pointer
        ${isPinned ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-800 bg-slate-900/50'}
        ${!isRead ? 'ring-2 ring-purple-500/30' : ''}
        hover:bg-slate-800/50
      `}
      onClick={handleClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPinned && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                Pinned
              </span>
            )}
            {!isRead && (
              <span className="w-2 h-2 bg-purple-500 rounded-full" />
            )}
          </div>
          <div className="text-xs text-slate-500">
            {formatDate(announcement.createdAt)} at {formatTime(announcement.createdAt)}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold mt-2">{announcement.title}</h3>

        {/* Content preview or full */}
        <p className={`text-slate-400 text-sm mt-2 ${expanded ? '' : 'line-clamp-2'}`}>
          {announcement.content}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
          {isCoach && 'readCount' in announcement && (
            <span className="text-xs text-slate-500">
              {announcement.readCount}/{announcement.totalCount} read
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {expanded && (
              <span className="text-xs text-slate-500">Click to collapse</span>
            )}

            {isCoach && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(announcement.id)
                }}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Delete announcement"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/announcements/AnnouncementCard.tsx
git commit -m "feat: add AnnouncementCard component"
```

---

## Task 5: Create AnnouncementComposer Component

**Files:**
- Create: `src/components/announcements/AnnouncementComposer.tsx`

**Step 1: Write the component**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { CreateAnnouncementPayload } from '@/types/messaging'

interface Client {
  id: string
  name: string
  avatar_url: string | null
}

interface AnnouncementComposerProps {
  onSubmit: (payload: CreateAnnouncementPayload) => Promise<void>
  onCancel: () => void
}

export function AnnouncementComposer({ onSubmit, onCancel }: AnnouncementComposerProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [sendPush, setSendPush] = useState(true)
  const [targetType, setTargetType] = useState<'all' | 'selected'>('all')
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)

  // Fetch clients when targeting selected
  useEffect(() => {
    if (targetType === 'selected') {
      setLoadingClients(true)
      fetch('/api/coach/clients')
        .then((res) => res.json())
        .then((data) => {
          setClients(data.clients || [])
        })
        .catch(console.error)
        .finally(() => setLoadingClients(false))
    }
  }, [targetType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setLoading(true)
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        isPinned,
        sendPush,
        targetType,
        selectedClientIds: targetType === 'selected' ? selectedClientIds : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const isValid = title.trim() && content.trim() && (targetType === 'all' || selectedClientIds.length > 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Announcement title..."
        required
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Message</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your announcement..."
          rows={4}
          required
          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
        />
      </div>

      {/* Target selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Send to</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setTargetType('all')}
            className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
              targetType === 'all'
                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            All Clients
          </button>
          <button
            type="button"
            onClick={() => setTargetType('selected')}
            className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
              targetType === 'selected'
                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            Select Clients
          </button>
        </div>
      </div>

      {/* Client selection */}
      {targetType === 'selected' && (
        <div className="space-y-2">
          {loadingClients ? (
            <div className="text-center py-4 text-slate-500">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-4 text-slate-500">No clients found</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-700 rounded-lg p-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => toggleClient(client.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                    selectedClientIds.includes(client.id)
                      ? 'bg-purple-500/20 text-white'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                    {client.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="flex-1 text-left">{client.name}</span>
                  {selectedClientIds.includes(client.id) && (
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            {selectedClientIds.length} client{selectedClientIds.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}

      {/* Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
          />
          <span className="text-sm text-slate-300">Pin to top</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendPush}
            onChange={(e) => setSendPush(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
          />
          <span className="text-sm text-slate-300">Send push notification</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || loading} loading={loading}>
          Send Announcement
        </Button>
      </div>
    </form>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/announcements/AnnouncementComposer.tsx
git commit -m "feat: add AnnouncementComposer component"
```

---

## Task 6: Create Coach Announcements Page

**Files:**
- Create: `src/app/coach/announcements/page.tsx`
- Create: `src/app/coach/announcements/CoachAnnouncementsClient.tsx`

**Step 1: Write the server page**

```typescript
// src/app/coach/announcements/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachAnnouncementsClient } from './CoachAnnouncementsClient'

export const metadata = {
  title: 'Announcements | Swear Strength',
}

export default async function CoachAnnouncementsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    redirect('/dashboard')
  }

  return <CoachAnnouncementsClient />
}
```

**Step 2: Write the client component**

```typescript
// src/app/coach/announcements/CoachAnnouncementsClient.tsx
'use client'

import { useState } from 'react'
import { useAnnouncements } from '@/hooks/useAnnouncements'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import { AnnouncementComposer } from '@/components/announcements/AnnouncementComposer'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Announcement, CreateAnnouncementPayload } from '@/types/messaging'

export function CoachAnnouncementsClient() {
  const [showComposer, setShowComposer] = useState(false)
  const { announcements, loading, createAnnouncement, deleteAnnouncement } = useAnnouncements(true)

  const handleCreate = async (payload: CreateAnnouncementPayload) => {
    const result = await createAnnouncement(payload)
    if (result) {
      setShowComposer(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      await deleteAnnouncement(id)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Announcements</h1>
          <p className="text-slate-400 mt-1">Broadcast messages to your clients</p>
        </div>
        <Button onClick={() => setShowComposer(true)}>
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Announcement
        </Button>
      </div>

      {/* Announcements list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (announcements as Announcement[]).length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-lg font-medium">No announcements yet</p>
          <p className="text-sm mt-1">Create your first announcement to notify all clients</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(announcements as Announcement[]).map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              isCoach={true}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Composer modal */}
      <Modal isOpen={showComposer} onClose={() => setShowComposer(false)} title="New Announcement" size="lg">
        <AnnouncementComposer onSubmit={handleCreate} onCancel={() => setShowComposer(false)} />
      </Modal>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/coach/announcements/page.tsx src/app/coach/announcements/CoachAnnouncementsClient.tsx
git commit -m "feat: add coach announcements page"
```

---

## Task 7: Create Client Announcements Page

**Files:**
- Create: `src/app/(client)/announcements/page.tsx`
- Create: `src/app/(client)/announcements/ClientAnnouncementsClient.tsx`

**Step 1: Write the server page**

```typescript
// src/app/(client)/announcements/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientAnnouncementsClient } from './ClientAnnouncementsClient'

export const metadata = {
  title: 'Announcements | Swear Strength',
}

export default async function ClientAnnouncementsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'client') {
    redirect('/coach')
  }

  return <ClientAnnouncementsClient />
}
```

**Step 2: Write the client component**

```typescript
// src/app/(client)/announcements/ClientAnnouncementsClient.tsx
'use client'

import { useAnnouncements } from '@/hooks/useAnnouncements'
import { AnnouncementCard } from '@/components/announcements/AnnouncementCard'
import type { ClientAnnouncement } from '@/types/messaging'

export function ClientAnnouncementsClient() {
  const { announcements, loading, markAsRead } = useAnnouncements(false)

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Announcements</h1>
        <p className="text-slate-400 mt-1">Updates from your coach</p>
      </div>

      {/* Announcements list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (announcements as ClientAnnouncement[]).length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <p className="text-lg font-medium">No announcements</p>
          <p className="text-sm mt-1">Your coach hasn't posted any announcements yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(announcements as ClientAnnouncement[]).map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              announcement={announcement}
              isCoach={false}
              onMarkAsRead={markAsRead}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(client\)/announcements/page.tsx src/app/\(client\)/announcements/ClientAnnouncementsClient.tsx
git commit -m "feat: add client announcements page"
```

---

## Task 8: Create UnreadBadge Component

**Files:**
- Create: `src/components/UnreadBadge.tsx`

**Step 1: Write the component**

```typescript
'use client'

interface UnreadBadgeProps {
  count: number
  size?: 'sm' | 'md'
}

export function UnreadBadge({ count, size = 'md' }: UnreadBadgeProps) {
  if (count <= 0) return null

  const sizeClasses = size === 'sm'
    ? 'w-4 h-4 text-[10px]'
    : 'w-5 h-5 text-xs'

  return (
    <span
      className={`
        ${sizeClasses}
        flex items-center justify-center
        bg-purple-500 text-white font-bold rounded-full
        animate-in zoom-in duration-200
      `}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/UnreadBadge.tsx
git commit -m "feat: add UnreadBadge component"
```

---

## Task 9: Add Announcements to Coach Sidebar

**Files:**
- Modify: `src/app/coach/CoachSidebar.tsx`

**Step 1: Add Announcements nav item after Messages in the Overview section**

Find the navigation array and add after Messages:

```typescript
{
  name: 'Announcements',
  href: '/coach/announcements',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
},
```

**Step 2: Commit**

```bash
git add src/app/coach/CoachSidebar.tsx
git commit -m "feat: add Announcements link to coach sidebar"
```

---

## Task 10: Create Push Notification Service

**Files:**
- Create: `src/lib/push-notifications.ts`

**Step 1: Write the push notification utilities**

```typescript
// Client-side push notification utilities

export async function subscribeToPushNotifications(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      // Get VAPID public key from server
      const res = await fetch('/api/push/vapid-key')
      if (!res.ok) {
        throw new Error('Failed to get VAPID key')
      }
      const { publicKey } = await res.json()

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })
    }

    // Save subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    })

    return subscription
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error)
    return null
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (subscription) {
      // Unsubscribe on server
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })

      await subscription.unsubscribe()
    }

    return true
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error)
    return false
  }
}

export async function checkPushPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (!('Notification' in window)) {
    return 'denied'
  }
  return Notification.permission
}

export async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
```

**Step 2: Commit**

```bash
git add src/lib/push-notifications.ts
git commit -m "feat: add push notification client utilities"
```

---

## Task 11: Create Push Notification API Routes

**Files:**
- Create: `src/app/api/push/vapid-key/route.ts`
- Create: `src/app/api/push/subscribe/route.ts`
- Create: `src/app/api/push/unsubscribe/route.ts`

**Step 1: Install web-push**

```bash
npm install web-push
npm install --save-dev @types/web-push
```

**Step 2: Write VAPID key route**

```typescript
// src/app/api/push/vapid-key/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY

  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID key not configured' }, { status: 500 })
  }

  return NextResponse.json({ publicKey })
}
```

**Step 3: Write subscribe route**

```typescript
// src/app/api/push/subscribe/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const subscription = await request.json()

  if (!subscription.endpoint || !subscription.keys) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  // Save subscription
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    }, {
      onConflict: 'user_id,endpoint',
    })

  if (error) {
    console.error('Error saving push subscription:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 4: Write unsubscribe route**

```typescript
// src/app/api/push/unsubscribe/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { endpoint } = await request.json()

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) {
    console.error('Error removing push subscription:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 5: Commit**

```bash
git add package.json package-lock.json src/app/api/push/vapid-key/route.ts src/app/api/push/subscribe/route.ts src/app/api/push/unsubscribe/route.ts
git commit -m "feat: add push notification API routes"
```

---

## Task 12: Create Service Worker for Push Notifications

**Files:**
- Create: `public/sw.js`

**Step 1: Write the service worker**

```javascript
// Service Worker for Push Notifications

self.addEventListener('push', function(event) {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || 'New notification',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
    },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Swear Strength', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  if (event.action === 'close') return

  const url = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})
```

**Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: add service worker for push notifications"
```

---

## Task 13: Create index exports for announcement components

**Files:**
- Create: `src/components/announcements/index.ts`

**Step 1: Write the index file**

```typescript
export { AnnouncementCard } from './AnnouncementCard'
export { AnnouncementComposer } from './AnnouncementComposer'
```

**Step 2: Commit**

```bash
git add src/components/announcements/index.ts
git commit -m "feat: add announcements components index export"
```

---

## Task 14: Add Environment Variables Documentation

**Files:**
- Create or update: `.env.example`

**Step 1: Add push notification env vars**

Add these lines to `.env.example`:

```bash
# Push Notifications (generate with: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your-email@example.com
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add push notification environment variables"
```

---

## Summary

Phase 3 creates the announcements system and push notifications:

| Component | Purpose |
|-----------|---------|
| Announcement types | Type definitions |
| `useAnnouncements` | Hook for CRUD and real-time |
| `useUnreadCounts` | Hook for nav badges |
| `AnnouncementCard` | Display announcement |
| `AnnouncementComposer` | Create new announcement |
| Coach Announcements Page | Manage announcements |
| Client Announcements Page | View announcements |
| `UnreadBadge` | Nav badge component |
| Push notification utilities | Client-side push |
| Push API routes | Subscribe/unsubscribe |
| Service worker | Handle push events |

**After Phase 3:**
- Apply database migrations
- Generate VAPID keys: `npx web-push generate-vapid-keys`
- Add VAPID keys to environment
- Test end-to-end messaging and announcements
