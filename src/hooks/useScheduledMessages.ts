'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ScheduledMessage,
  CreateScheduledMessagePayload,
  UpdateScheduledMessagePayload,
} from '@/types/scheduled-message'

interface UseScheduledMessagesReturn {
  messages: ScheduledMessage[]
  loading: boolean
  error: string | null
  createScheduledMessage: (payload: CreateScheduledMessagePayload) => Promise<{ message: ScheduledMessage | null; error: string | null }>
  updateScheduledMessage: (id: string, payload: UpdateScheduledMessagePayload) => Promise<{ success: boolean; error: string | null }>
  cancelScheduledMessage: (id: string) => Promise<{ success: boolean; error: string | null }>
  sendNow: (id: string) => Promise<{ success: boolean; error: string | null }>
  refresh: () => Promise<void>
}

export function useScheduledMessages(status?: string): UseScheduledMessagesReturn {
  const [messages, setMessages] = useState<ScheduledMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const url = status
        ? `/api/scheduled-messages?status=${status}`
        : '/api/scheduled-messages'

      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch scheduled messages')
      }

      setMessages(data.messages)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const createScheduledMessage = async (
    payload: CreateScheduledMessagePayload
  ): Promise<{ message: ScheduledMessage | null; error: string | null }> => {
    try {
      const response = await fetch('/api/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        return { message: null, error: data.error || 'Failed to create scheduled message' }
      }

      // Add to local state
      setMessages(prev => [...prev, data.message].sort(
        (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      ))

      return { message: data.message, error: null }
    } catch (err) {
      return { message: null, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  const updateScheduledMessage = async (
    id: string,
    payload: UpdateScheduledMessagePayload
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      const response = await fetch(`/api/scheduled-messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to update scheduled message' }
      }

      // Update local state
      setMessages(prev =>
        prev.map(m => m.id === id ? data.message : m).sort(
          (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
        )
      )

      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  const cancelScheduledMessage = async (
    id: string
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      const response = await fetch(`/api/scheduled-messages/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to cancel scheduled message' }
      }

      // Update local state (change status to cancelled)
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, status: 'cancelled' as const } : m)
      )

      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  const sendNow = async (
    id: string
  ): Promise<{ success: boolean; error: string | null }> => {
    try {
      const response = await fetch(`/api/scheduled-messages/${id}/send-now`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to send message' }
      }

      // Update local state (change status to sent)
      setMessages(prev =>
        prev.map(m => m.id === id ? { ...m, status: 'sent' as const, sentAt: new Date().toISOString() } : m)
      )

      return { success: true, error: null }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  return {
    messages,
    loading,
    error,
    createScheduledMessage,
    updateScheduledMessage,
    cancelScheduledMessage,
    sendNow,
    refresh: fetchMessages,
  }
}

// Hook for sending mass DMs immediately
export function useMassDM() {
  const [sending, setSending] = useState(false)

  const sendMassDM = async (
    recipientIds: string[],
    content: string,
    contentType?: string,
    mediaUrl?: string
  ): Promise<{ success: boolean; sent: number; failed: number; error: string | null }> => {
    setSending(true)
    try {
      const response = await fetch('/api/mass-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientIds, content, contentType, mediaUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, sent: 0, failed: recipientIds.length, error: data.error || 'Failed to send mass DM' }
      }

      return {
        success: data.success,
        sent: data.sent,
        failed: data.failed,
        error: null,
      }
    } catch (err) {
      return {
        success: false,
        sent: 0,
        failed: recipientIds.length,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    } finally {
      setSending(false)
    }
  }

  return { sendMassDM, sending }
}
