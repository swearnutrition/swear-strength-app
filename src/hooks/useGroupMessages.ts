import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GroupMessage, SendGroupMessagePayload } from '@/types/group-chat'

export function useGroupMessages(groupChatId: string | null) {
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    if (!groupChatId) {
      setMessages([])
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/group-chats/${groupChatId}/messages`)
      if (!res.ok) {
        throw new Error('Failed to fetch messages')
      }
      const data = await res.json()
      setMessages(data.messages || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching group messages:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [groupChatId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Subscribe to real-time updates
  useEffect(() => {
    if (!groupChatId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`group_messages_${groupChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_chat_id=eq.${groupChatId}`,
        },
        async (payload) => {
          // Fetch the new message with sender info
          const { data: newMsg } = await supabase
            .from('group_messages')
            .select(`
              id,
              sender_id,
              content,
              content_type,
              media_url,
              is_deleted,
              created_at,
              sender:profiles!group_messages_sender_id_fkey(name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()

          if (newMsg) {
            const sender = Array.isArray(newMsg.sender) ? newMsg.sender[0] : newMsg.sender
            const processedMsg: GroupMessage = {
              id: newMsg.id,
              groupChatId: groupChatId,
              senderId: newMsg.sender_id,
              senderName: sender?.name || 'Unknown',
              senderAvatar: sender?.avatar_url,
              content: newMsg.is_deleted ? null : newMsg.content,
              contentType: newMsg.content_type,
              mediaUrl: newMsg.is_deleted ? null : newMsg.media_url,
              isDeleted: newMsg.is_deleted,
              createdAt: newMsg.created_at,
            }

            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === processedMsg.id)) return prev
              return [...prev, processedMsg]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'group_messages',
          filter: `group_chat_id=eq.${groupChatId}`,
        },
        (payload) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === payload.new.id
                ? {
                    ...m,
                    content: payload.new.is_deleted ? null : payload.new.content,
                    isDeleted: payload.new.is_deleted,
                  }
                : m
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [groupChatId])

  const sendMessage = async (payload: SendGroupMessagePayload) => {
    if (!groupChatId) return

    try {
      const res = await fetch(`/api/group-chats/${groupChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      // Message will be added via real-time subscription
    } catch (err) {
      console.error('Error sending group message:', err)
      throw err
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      const res = await fetch(`/api/group-chats/${groupChatId}/messages/${messageId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete message')
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === messageId ? { ...m, content: null, isDeleted: true } : m
        )
      )
    } catch (err) {
      console.error('Error deleting message:', err)
      throw err
    }
  }

  return {
    messages,
    loading,
    error,
    sendMessage,
    deleteMessage,
    refresh: fetchMessages,
  }
}
