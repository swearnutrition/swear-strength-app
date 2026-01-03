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
        // Use maybeSingle() instead of single() to avoid throwing when no conversation exists
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select(`messages(id, sender_id, read_at, is_deleted)`)
          .eq('client_id', userId)
          .maybeSingle()

        if (convError) {
          console.error('Error fetching conversation for unread count:', convError)
        } else if (conversation?.messages) {
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
