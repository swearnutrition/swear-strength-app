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
  archiveAnnouncement: (id: string, archived: boolean) => Promise<boolean>
  markAsRead: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useAnnouncements(isCoach: boolean, showArchived: boolean = false): UseAnnouncementsReturn {
  const [announcements, setAnnouncements] = useState<Announcement[] | ClientAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchAnnouncements = useCallback(async () => {
    try {
      const url = showArchived ? '/api/announcements?archived=true' : '/api/announcements'
      const res = await fetch(url)
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
  }, [showArchived])

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

      const data = await res.json()
      console.log('Create announcement response:', res.status, data)

      if (!res.ok) {
        console.error('Failed to create announcement:', data.error || 'Unknown error')
        alert(`Failed to create announcement: ${data.error || 'Unknown error'}`)
        return null
      }

      await fetchAnnouncements()
      return data.announcement
    } catch (err) {
      console.error('Error creating announcement:', err)
      alert(`Error creating announcement: ${err}`)
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

  const archiveAnnouncement = async (id: string, archived: boolean): Promise<boolean> => {
    if (!isCoach) return false

    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      })
      if (res.ok) {
        await fetchAnnouncements()
      }
      return res.ok
    } catch (err) {
      console.error('Error archiving announcement:', err)
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
    archiveAnnouncement,
    markAsRead,
    refetch: fetchAnnouncements,
  }
}
