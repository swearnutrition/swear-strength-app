'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  AvailabilityTemplate,
  AvailabilityOverride,
  AvailableSlot,
  AvailabilityType,
  CreateAvailabilityTemplatePayload,
  CreateAvailabilityOverridePayload,
} from '@/types/booking'

interface UseAvailabilityOptions {
  coachId?: string
  type?: AvailabilityType
}

interface UseAvailabilityReturn {
  templates: AvailabilityTemplate[]
  overrides: AvailabilityOverride[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTemplate: (payload: CreateAvailabilityTemplatePayload) => Promise<AvailabilityTemplate | null>
  createOverride: (payload: CreateAvailabilityOverridePayload) => Promise<AvailabilityOverride | null>
  deleteTemplate: (templateId: string) => Promise<boolean>
  deleteOverride: (overrideId: string) => Promise<boolean>
  getAvailableSlots: (date: string, durationMinutes?: number) => Promise<AvailableSlot[]>
}

export function useAvailability(
  options: UseAvailabilityOptions = {}
): UseAvailabilityReturn {
  const [templates, setTemplates] = useState<AvailabilityTemplate[]>([])
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (options.coachId) params.set('coachId', options.coachId)
      if (options.type) params.set('type', options.type)

      const url = `/api/availability${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch availability')
      }

      const data = await res.json()
      setTemplates(data.templates || [])
      setOverrides(data.overrides || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching availability:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [options.coachId, options.type])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  // Real-time subscriptions
  useEffect(() => {
    const templatesChannel = supabase
      .channel('availability_templates_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_availability_templates',
        },
        () => fetchAvailability()
      )
      .subscribe()

    const overridesChannel = supabase
      .channel('availability_overrides_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_availability_overrides',
        },
        () => fetchAvailability()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(templatesChannel)
      supabase.removeChannel(overridesChannel)
    }
  }, [fetchAvailability, supabase])

  const createTemplate = async (
    payload: CreateAvailabilityTemplatePayload
  ): Promise<AvailabilityTemplate | null> => {
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create template')
      }

      await fetchAvailability()
      return data.template
    } catch (err) {
      console.error('Error creating template:', err)
      alert(err instanceof Error ? err.message : 'Failed to create template')
      return null
    }
  }

  const createOverride = async (
    payload: CreateAvailabilityOverridePayload
  ): Promise<AvailabilityOverride | null> => {
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          overrideDate: payload.overrideDate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create override')
      }

      await fetchAvailability()
      return data.override
    } catch (err) {
      console.error('Error creating override:', err)
      alert(err instanceof Error ? err.message : 'Failed to create override')
      return null
    }
  }

  const deleteTemplate = async (templateId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('coach_availability_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      await fetchAvailability()
      return true
    } catch (err) {
      console.error('Error deleting template:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete template')
      return false
    }
  }

  const deleteOverride = async (overrideId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('coach_availability_overrides')
        .delete()
        .eq('id', overrideId)

      if (error) throw error

      await fetchAvailability()
      return true
    } catch (err) {
      console.error('Error deleting override:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete override')
      return false
    }
  }

  const getAvailableSlots = async (
    date: string,
    durationMinutes = 60
  ): Promise<AvailableSlot[]> => {
    try {
      const params = new URLSearchParams({
        coachId: options.coachId || '',
        date,
        type: options.type || 'session',
        duration: durationMinutes.toString(),
      })

      const res = await fetch(`/api/availability/slots?${params}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch slots')
      }

      const data = await res.json()
      return data.slots || []
    } catch (err) {
      console.error('Error fetching slots:', err)
      return []
    }
  }

  return {
    templates,
    overrides,
    loading,
    error,
    refetch: fetchAvailability,
    createTemplate,
    createOverride,
    deleteTemplate,
    deleteOverride,
    getAvailableSlots,
  }
}
