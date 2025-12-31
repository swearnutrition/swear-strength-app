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
