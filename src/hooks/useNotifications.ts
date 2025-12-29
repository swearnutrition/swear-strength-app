'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Notification {
  id: string
  type: 'nudge' | 'new_program' | 'new_habit' | 'rivalry_invite' | 'rivalry_comment' | 'rivalry_reaction' | 'rivalry_gif' | 'schedule_reminder' | 'system'
  title: string
  message: string | null
  rivalryId: string | null
  programId: string | null
  habitId: string | null
  read: boolean
  data: Record<string, unknown>
  createdAt: string
}

interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useNotifications(userId: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('client_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching notifications:', error)
      return
    }

    setNotifications(
      (data || []).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        rivalryId: n.rivalry_id,
        programId: n.program_id,
        habitId: n.habit_id,
        read: n.read,
        data: n.data || {},
        createdAt: n.created_at,
      }))
    )
    setLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    fetchNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n = payload.new as {
            id: string
            type: Notification['type']
            title: string
            message: string | null
            rivalry_id: string | null
            program_id: string | null
            habit_id: string | null
            read: boolean
            data: Record<string, unknown>
            created_at: string
          }
          setNotifications((prev) => [
            {
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              rivalryId: n.rivalry_id,
              programId: n.program_id,
              habitId: n.habit_id,
              read: n.read,
              data: n.data || {},
              createdAt: n.created_at,
            },
            ...prev,
          ])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchNotifications, supabase, userId])

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('client_notifications')
      .update({ read: true })
      .eq('id', id)

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      )
    }
  }

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('client_notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('client_notifications')
      .delete()
      .eq('id', id)

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  }
}
