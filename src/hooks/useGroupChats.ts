import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GroupChat } from '@/types/group-chat'

export function useGroupChats() {
  const [groupChats, setGroupChats] = useState<GroupChat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGroupChats = useCallback(async () => {
    try {
      const res = await fetch('/api/group-chats')
      if (!res.ok) {
        throw new Error('Failed to fetch group chats')
      }
      const data = await res.json()
      setGroupChats(data.groupChats || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching group chats:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroupChats()
  }, [fetchGroupChats])

  // Subscribe to real-time updates
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('group_chats_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_messages',
        },
        () => {
          // Refetch when new messages arrive
          fetchGroupChats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchGroupChats])

  const createGroupChat = async (name: string, description: string | undefined, memberIds: string[]) => {
    try {
      const res = await fetch('/api/group-chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, memberIds }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create group chat')
      }

      const data = await res.json()
      setGroupChats(prev => [data.groupChat, ...prev])
      return data.groupChat
    } catch (err) {
      console.error('Error creating group chat:', err)
      throw err
    }
  }

  return {
    groupChats,
    loading,
    error,
    refresh: fetchGroupChats,
    createGroupChat,
  }
}
