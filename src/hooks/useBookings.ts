'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Booking,
  BookingWithDetails,
  CreateBookingPayload,
  RescheduleBookingPayload,
  BookingStatus,
} from '@/types/booking'

interface UseBookingsOptions {
  clientId?: string
  status?: BookingStatus
  from?: string
  to?: string
}

interface UseBookingsReturn {
  bookings: BookingWithDetails[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createBooking: (payload: CreateBookingPayload) => Promise<Booking | null>
  createMultipleBookings: (payloads: CreateBookingPayload[]) => Promise<Booking[]>
  rescheduleBooking: (payload: RescheduleBookingPayload) => Promise<Booking | null>
  cancelBooking: (bookingId: string) => Promise<boolean>
  updateStatus: (bookingId: string, status: BookingStatus) => Promise<boolean>
}

export function useBookings(options: UseBookingsOptions = {}): UseBookingsReturn {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (options.clientId) params.set('clientId', options.clientId)
      if (options.status) params.set('status', options.status)
      if (options.from) params.set('from', options.from)
      if (options.to) params.set('to', options.to)

      const url = `/api/bookings${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch bookings')
      }

      const data = await res.json()
      setBookings(data.bookings || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [options.clientId, options.status, options.from, options.to])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('bookings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBookings, supabase])

  const createBooking = async (
    payload: CreateBookingPayload
  ): Promise<Booking | null> => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create booking')
      }

      await fetchBookings()
      return data.booking
    } catch (err) {
      console.error('Error creating booking:', err)
      alert(err instanceof Error ? err.message : 'Failed to create booking')
      return null
    }
  }

  const createMultipleBookings = async (
    payloads: CreateBookingPayload[]
  ): Promise<Booking[]> => {
    const results: Booking[] = []
    for (const payload of payloads) {
      const booking = await createBooking(payload)
      if (booking) results.push(booking)
    }
    return results
  }

  const rescheduleBooking = async (
    payload: RescheduleBookingPayload
  ): Promise<Booking | null> => {
    try {
      const res = await fetch(`/api/bookings/${payload.bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startsAt: payload.newStartsAt,
          endsAt: payload.newEndsAt,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule booking')
      }

      await fetchBookings()
      return data.booking
    } catch (err) {
      console.error('Error rescheduling booking:', err)
      alert(err instanceof Error ? err.message : 'Failed to reschedule booking')
      return null
    }
  }

  const cancelBooking = async (bookingId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel booking')
      }

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error cancelling booking:', err)
      alert(err instanceof Error ? err.message : 'Failed to cancel booking')
      return false
    }
  }

  const updateStatus = async (
    bookingId: string,
    status: BookingStatus
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error updating status:', err)
      alert(err instanceof Error ? err.message : 'Failed to update status')
      return false
    }
  }

  return {
    bookings,
    loading,
    error,
    refetch: fetchBookings,
    createBooking,
    createMultipleBookings,
    rescheduleBooking,
    cancelBooking,
    updateStatus,
  }
}
