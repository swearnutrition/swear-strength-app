'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, SendMessagePayload } from '@/types/messaging'

interface UseMessagesReturn {
  messages: Message[]
  loading: boolean
  error: string | null
  sendMessage: (payload: SendMessagePayload) => Promise<{ message: Message | null; error: string | null }>
  deleteMessage: (messageId: string) => Promise<{ success: boolean; error: string | null }>
  markAsRead: (messageId: string) => Promise<{ success: boolean; error: string | null }>
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

  const sendMessage = async (payload: SendMessagePayload): Promise<{ message: Message | null; error: string | null }> => {
    if (!conversationId) {
      return { message: null, error: 'No conversation selected' }
    }

    try {
      const res = await fetch(`/api/messages/conversations/${conversationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errorMessage = data.error || `Failed to send message (${res.status})`
        return { message: null, error: errorMessage }
      }

      const data = await res.json()
      return { message: data.message, error: null }
    } catch (err) {
      console.error('Error sending message:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      return { message: null, error: errorMessage }
    }
  }

  const deleteMessage = async (messageId: string): Promise<{ success: boolean; error: string | null }> => {
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errorMessage = data.error || `Failed to delete message (${res.status})`
        return { success: false, error: errorMessage }
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error deleting message:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete message'
      return { success: false, error: errorMessage }
    }
  }

  const markAsRead = async (messageId: string): Promise<{ success: boolean; error: string | null }> => {
    try {
      const res = await fetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errorMessage = data.error || `Failed to mark as read (${res.status})`
        return { success: false, error: errorMessage }
      }

      return { success: true, error: null }
    } catch (err) {
      console.error('Error marking message as read:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as read'
      return { success: false, error: errorMessage }
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
