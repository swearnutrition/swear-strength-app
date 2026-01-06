'use client'

import { useState, useEffect, useCallback } from 'react'

export interface MessageTemplate {
  id: string
  name: string
  content: string
  created_at: string
  updated_at: string
}

interface UseMessageTemplatesReturn {
  templates: MessageTemplate[]
  loading: boolean
  error: string | null
  createTemplate: (name: string, content: string) => Promise<MessageTemplate | null>
  updateTemplate: (id: string, updates: { name?: string; content?: string }) => Promise<boolean>
  deleteTemplate: (id: string) => Promise<boolean>
  refetch: () => Promise<void>
}

export function useMessageTemplates(): UseMessageTemplatesReturn {
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/message-templates')
      if (!res.ok) {
        throw new Error('Failed to fetch templates')
      }
      const data = await res.json()
      setTemplates(data.templates || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching templates:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const createTemplate = async (name: string, content: string): Promise<MessageTemplate | null> => {
    try {
      const res = await fetch('/api/message-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create template')
      }

      const data = await res.json()
      await fetchTemplates()
      return data.template
    } catch (err) {
      console.error('Error creating template:', err)
      return null
    }
  }

  const updateTemplate = async (id: string, updates: { name?: string; content?: string }): Promise<boolean> => {
    try {
      const res = await fetch(`/api/message-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (res.ok) {
        await fetchTemplates()
      }
      return res.ok
    } catch (err) {
      console.error('Error updating template:', err)
      return false
    }
  }

  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/message-templates/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchTemplates()
      }
      return res.ok
    } catch (err) {
      console.error('Error deleting template:', err)
      return false
    }
  }

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch: fetchTemplates,
  }
}
