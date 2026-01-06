'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  SessionPackage,
  CreateSessionPackagePayload,
  AdjustSessionPackagePayload,
} from '@/types/booking'

interface UseSessionPackagesReturn {
  packages: SessionPackage[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createPackage: (payload: CreateSessionPackagePayload) => Promise<SessionPackage | null>
  adjustPackage: (payload: AdjustSessionPackagePayload) => Promise<SessionPackage | null>
}

export function useSessionPackages(clientId?: string): UseSessionPackagesReturn {
  const [packages, setPackages] = useState<SessionPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true)
      const url = clientId
        ? `/api/session-packages?clientId=${clientId}`
        : '/api/session-packages'
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch packages')
      }

      const data = await res.json()
      setPackages(data.packages || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching packages:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchPackages()
  }, [fetchPackages])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('session_packages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_packages',
        },
        () => {
          fetchPackages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPackages, supabase])

  const createPackage = async (
    payload: CreateSessionPackagePayload
  ): Promise<SessionPackage | null> => {
    try {
      const res = await fetch('/api/session-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create package')
      }

      await fetchPackages()
      return data.package
    } catch (err) {
      console.error('Error creating package:', err)
      alert(err instanceof Error ? err.message : 'Failed to create package')
      return null
    }
  }

  const adjustPackage = async (
    payload: AdjustSessionPackagePayload
  ): Promise<SessionPackage | null> => {
    try {
      const res = await fetch(`/api/session-packages/${payload.packageId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment: payload.adjustment,
          reason: payload.reason,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to adjust package')
      }

      await fetchPackages()
      return data.package
    } catch (err) {
      console.error('Error adjusting package:', err)
      alert(err instanceof Error ? err.message : 'Failed to adjust package')
      return null
    }
  }

  return {
    packages,
    loading,
    error,
    refetch: fetchPackages,
    createPackage,
    adjustPackage,
  }
}
