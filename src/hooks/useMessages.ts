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
