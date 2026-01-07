'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useBookings } from '@/hooks/useBookings'
import { useAvailability } from '@/hooks/useAvailability'
import { useColors } from '@/hooks/useColors'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import type { BookingWithDetails, AvailableSlot, BookingType } from '@/types/booking'

interface SessionPackageInfo {
  id: string
  totalSessions: number
  remainingSessions: number
  sessionDurationMinutes: number
  expiresAt: string | null
}

interface BookingStatsInfo {
  currentStreakWeeks: number
  longestStreakWeeks: number
  favoriteTimes: Array<{ day: number; time: string }> | null
}

interface CheckinUsageInfo {
  used: boolean
  resetDate: string
}

interface HybridSessionUsageInfo {
  used: number
  limit: number
  resetDate: string
}

type ClientType = 'online' | 'training' | 'hybrid'

interface ClientBookingsClientProps {
  userId: string
  userName: string
  coachId: string | null
  clientType: ClientType
  sessionPackage: SessionPackageInfo | null
  bookingStats: BookingStatsInfo | null
  checkinUsage: CheckinUsageInfo | null
  hybridSessionUsage: HybridSessionUsageInfo | null
}

// Helper functions
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.toDateString() === d2.toDateString()
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function isWithin12Hours(date: Date): boolean {
  const now = new Date()
  const diff = date.getTime() - now.getTime()
  return diff < 12 * 60 * 60 * 1000
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Extended slot with date info for multi-select
interface SlotWithDate extends AvailableSlot {
  date: string // ISO date string
}

export function ClientBookingsClient({
  userId,
  userName,
  coachId,
  clientType,
  sessionPackage,
  bookingStats,
  checkinUsage,
  hybridSessionUsage,
}: ClientBookingsClientProps) {
  const colors = useColors()

  // Default to 'checkin' for online clients, 'session' for training/hybrid
  const canBookSessions = clientType === 'training' || clientType === 'hybrid'
  const [bookingType, setBookingType] = useState<BookingType>(canBookSessions ? 'session' : 'checkin')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedSlots, setSelectedSlots] = useState<AvailableSlot[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [selectedBookingForAction, setSelectedBookingForAction] = useState<BookingWithDetails | null>(null)
  const [bookingInProgress, setBookingInProgress] = useState(false)

  // Quick book mode state
  const [isQuickBookMode, setIsQuickBookMode] = useState(false)
  const [quickBookWeekStart, setQuickBookWeekStart] = useState(() => getStartOfWeek(new Date()))
  const [quickBookSlots, setQuickBookSlots] = useState<SlotWithDate[]>([])
  const [slotsByDate, setSlotsByDate] = useState<Map<string, AvailableSlot[]>>(new Map())
  const [loadingWeekSlots, setLoadingWeekSlots] = useState(false)

  // Get upcoming bookings
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const threeMonthsFromNow = addMonths(today, 3)

  const { bookings, loading: bookingsLoading, createMultipleBookings, cancelBooking, rescheduleBooking, refetch } = useBookings({
    clientId: userId,
    from: today.toISOString(),
    to: threeMonthsFromNow.toISOString(),
  })

  const { getAvailableSlots } = useAvailability({
    coachId: coachId || undefined,
    type: bookingType,
  })

  // Filter upcoming confirmed bookings
  const upcomingBookings = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const filtered = bookings.filter(b => b.status === 'confirmed' && new Date(b.startsAt) >= now)
    return filtered.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [bookings])

  // Generate calendar months (current + next 2)
  const calendarMonths = useMemo(() => {
    const months = []
    for (let i = 0; i < 3; i++) {
      months.push(addMonths(new Date(today.getFullYear(), today.getMonth(), 1), i))
    }
    return months
  }, [])

  // Fetch available slots when date is selected
  const fetchSlotsForDate = useCallback(async (date: Date) => {
    if (!coachId) return
    setLoadingSlots(true)
    try {
      const dateStr = date.toISOString().split('T')[0]
      const duration = bookingType === 'session'
        ? sessionPackage?.sessionDurationMinutes || 60
        : 30
      const slots = await getAvailableSlots(dateStr, duration)

      // Mark favorite times
      const slotsWithFavorites = slots.map(slot => {
        const slotDate = new Date(slot.startsAt)
        const dayOfWeek = slotDate.getDay()
        const slotTime = slotDate.toTimeString().slice(0, 5)
        const isFavorite = bookingStats?.favoriteTimes?.some(
          fav => fav.day === dayOfWeek && fav.time === slotTime
        ) || false
        return { ...slot, isFavorite }
      })

      setAvailableSlots(slotsWithFavorites)
    } catch (error) {
      console.error('Error fetching slots:', error)
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [coachId, bookingType, sessionPackage, bookingStats, getAvailableSlots])

  useEffect(() => {
    if (selectedDate) {
      fetchSlotsForDate(selectedDate)
    }
  }, [selectedDate, fetchSlotsForDate])

  // Clear selections when switching booking type
  useEffect(() => {
    setSelectedSlots([])
    setSelectedDate(null)
    setAvailableSlots([])
    setQuickBookSlots([])
  }, [bookingType])

  // Generate week days for quick book mode
  const quickBookWeekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(quickBookWeekStart)
      date.setDate(date.getDate() + i)
      return date
    })
  }, [quickBookWeekStart])

  // Fetch availability slots for quick book week view
  useEffect(() => {
    if (!isQuickBookMode || !coachId) return

    const fetchWeekSlots = async () => {
      setLoadingWeekSlots(true)
      const newSlotsByDate = new Map<string, AvailableSlot[]>()
      const duration = bookingType === 'session'
        ? sessionPackage?.sessionDurationMinutes || 60
        : 30

      // Fetch slots for each day in the week
      await Promise.all(
        quickBookWeekDays.map(async (day) => {
          const dateStr = day.toISOString().split('T')[0]
          // Only fetch for today and future dates
          const todayDate = new Date()
          todayDate.setHours(0, 0, 0, 0)
          if (day >= todayDate) {
            const slots = await getAvailableSlots(dateStr, duration)
            // Mark favorite times
            const slotsWithFavorites = slots.map(slot => {
              const slotDate = new Date(slot.startsAt)
              const dayOfWeek = slotDate.getDay()
              const slotTime = slotDate.toTimeString().slice(0, 5)
              const isFavorite = bookingStats?.favoriteTimes?.some(
                fav => fav.day === dayOfWeek && fav.time === slotTime
              ) || false
              return { ...slot, isFavorite }
            })
            newSlotsByDate.set(day.toDateString(), slotsWithFavorites)
          }
        })
      )

      setSlotsByDate(newSlotsByDate)
      setLoadingWeekSlots(false)
    }

    fetchWeekSlots()
  }, [isQuickBookMode, quickBookWeekDays, coachId, bookingType, sessionPackage, bookingStats, getAvailableSlots])

  // Quick book week navigation
  const goToPreviousWeek = () => {
    const newStart = new Date(quickBookWeekStart)
    newStart.setDate(newStart.getDate() - 7)
    // Don't allow going before today's week
    const todayWeekStart = getStartOfWeek(new Date())
    if (newStart >= todayWeekStart) {
      setQuickBookWeekStart(newStart)
    }
  }

  const goToNextWeek = () => {
    const newStart = new Date(quickBookWeekStart)
    newStart.setDate(newStart.getDate() + 7)
    // Limit to 3 months out
    const maxDate = addMonths(new Date(), 3)
    if (newStart < maxDate) {
      setQuickBookWeekStart(newStart)
    }
  }

  const enterQuickBookMode = () => {
    setIsQuickBookMode(true)
    setQuickBookSlots([])
    setQuickBookWeekStart(getStartOfWeek(new Date()))
  }

  const exitQuickBookMode = () => {
    setIsQuickBookMode(false)
    setQuickBookSlots([])
  }

  // Handle quick book slot selection
  const handleQuickBookSlotSelect = (day: Date, slot: AvailableSlot) => {
    const dateStr = day.toISOString().split('T')[0]
    const slotWithDate: SlotWithDate = { ...slot, date: dateStr }

    setQuickBookSlots(prev => {
      const exists = prev.some(s => s.startsAt === slot.startsAt)
      if (exists) {
        return prev.filter(s => s.startsAt !== slot.startsAt)
      }
      // Check session limit
      const remainingSessions = getRemainingSessionsForBooking()
      if (bookingType === 'session' && prev.length >= remainingSessions) {
        if (clientType === 'hybrid') {
          alert(`You have reached your monthly session limit of ${hybridSessionUsage?.limit} sessions.`)
        } else {
          alert('You have reached your session limit. Please purchase more sessions.')
        }
        return prev
      }
      return [...prev, slotWithDate]
    })
  }

  const removeQuickBookSlot = (slot: SlotWithDate) => {
    setQuickBookSlots(prev => prev.filter(s => s.startsAt !== slot.startsAt))
  }

  // Handle quick book confirmation
  const handleQuickBookConfirm = async () => {
    if (!coachId || quickBookSlots.length === 0) return

    setBookingInProgress(true)
    try {
      const payloads = quickBookSlots.map(slot => ({
        clientId: userId,
        bookingType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        packageId: bookingType === 'session' ? sessionPackage?.id : undefined,
      }))

      await createMultipleBookings(payloads)
      setQuickBookSlots([])
      exitQuickBookMode()
      await refetch()
    } catch (error) {
      console.error('Error creating bookings:', error)
    } finally {
      setBookingInProgress(false)
    }
  }

  // Calculate remaining sessions based on client type
  const getRemainingSessionsForBooking = (): number => {
    if (clientType === 'hybrid' && hybridSessionUsage) {
      return hybridSessionUsage.limit - hybridSessionUsage.used
    }
    if (clientType === 'training' && sessionPackage) {
      return sessionPackage.remainingSessions
    }
    return 0
  }

  // Handle slot selection
  const handleSlotSelect = (slot: AvailableSlot) => {
    if (bookingType === 'checkin') {
      // Single select for check-ins
      setSelectedSlots([slot])
    } else {
      // Multi-select for sessions
      const isSelected = selectedSlots.some(s => s.startsAt === slot.startsAt)
      if (isSelected) {
        setSelectedSlots(prev => prev.filter(s => s.startsAt !== slot.startsAt))
      } else {
        // Check if they have enough sessions remaining
        const remainingSessions = getRemainingSessionsForBooking()
        if (selectedSlots.length >= remainingSessions) {
          if (clientType === 'hybrid') {
            alert(`You have reached your monthly session limit of ${hybridSessionUsage?.limit} sessions.`)
          } else {
            alert('You have reached your session limit. Please purchase more sessions.')
          }
          return
        }
        setSelectedSlots(prev => [...prev, slot])
      }
    }
  }

  // Check if a date is available (not past, not within 12 hours, coach has availability)
  const isDateAvailable = useCallback((date: Date): boolean => {
    const now = new Date()
    if (date < now) return false
    if (isWithin12Hours(date)) return false
    return true
  }, [])

  // Handle booking confirmation
  const handleConfirmBooking = async () => {
    if (!coachId || selectedSlots.length === 0) return

    setBookingInProgress(true)
    try {
      const payloads = selectedSlots.map(slot => ({
        clientId: userId,
        bookingType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        packageId: bookingType === 'session' ? sessionPackage?.id : undefined,
      }))

      await createMultipleBookings(payloads)
      setSelectedSlots([])
      setSelectedDate(null)
      setAvailableSlots([])
      setShowConfirmModal(false)
      await refetch()
    } catch (error) {
      console.error('Error creating booking:', error)
    } finally {
      setBookingInProgress(false)
    }
  }

  // Handle booking cancellation
  const handleCancelBooking = async () => {
    if (!selectedBookingForAction) return

    const success = await cancelBooking(selectedBookingForAction.id)
    if (success) {
      setShowCancelModal(false)
      setSelectedBookingForAction(null)
    }
  }

  // Handle reschedule
  const handleReschedule = async (newSlot: AvailableSlot) => {
    if (!selectedBookingForAction) return

    const result = await rescheduleBooking({
      bookingId: selectedBookingForAction.id,
      newStartsAt: newSlot.startsAt,
      newEndsAt: newSlot.endsAt,
    })

    if (result) {
      setShowRescheduleModal(false)
      setSelectedBookingForAction(null)
    }
  }

  // No coach assigned
  if (!coachId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: colors.bgGradient }}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: colors.bgCard }}>
            <svg className="w-8 h-8" style={{ color: colors.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: colors.text }}>No Active Package</h2>
          <p style={{ color: colors.textSecondary }}>You don&apos;t have an active session package yet. Contact your coach to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-8" style={{ background: colors.bgGradient }}>
      {/* Desktop Container */}
      <div className="max-w-4xl mx-auto px-4 lg:px-6 pt-6 pb-4">
        {/* Header */}
        <Link href="/dashboard" className="inline-flex items-center hover:opacity-80 mb-3 text-sm" style={{ color: colors.textSecondary }}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.text }}>Book Sessions</h1>
            <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>Schedule your training sessions and check-ins</p>
          </div>
          {canBookSessions && !isQuickBookMode && (
            <button
              onClick={enterQuickBookMode}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-2 px-4 rounded-xl transition-all text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Quick Book
            </button>
          )}
          {isQuickBookMode && (
            <button
              onClick={exitQuickBookMode}
              className="flex items-center gap-2 hover:opacity-80 font-medium py-2 px-4 rounded-xl transition-all text-sm"
              style={{ background: colors.bgCard, color: colors.text, border: `1px solid ${colors.border}` }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Exit Quick Book
            </button>
          )}
        </div>
      </div>

      {/* Compact Stats Bar */}
      <div className="max-w-4xl mx-auto px-4 lg:px-6 mb-4">
        <div className="rounded-xl p-3" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 lg:gap-x-8">
            {/* Sessions */}
            {canBookSessions && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                  {clientType === 'hybrid' ? 'Monthly' : 'Sessions'}:
                </span>
                {clientType === 'hybrid' && hybridSessionUsage ? (
                  <span className="font-semibold" style={{ color: colors.text }}>
                    {hybridSessionUsage.limit - hybridSessionUsage.used}/{hybridSessionUsage.limit}
                  </span>
                ) : sessionPackage ? (
                  <span className="font-semibold" style={{ color: colors.text }}>
                    {sessionPackage.remainingSessions}/{sessionPackage.totalSessions}
                  </span>
                ) : (
                  <span style={{ color: colors.textMuted }}>—</span>
                )}
              </div>
            )}

            {/* Expiration */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                {clientType === 'hybrid' ? 'Resets:' : 'Expires:'}
              </span>
              {clientType === 'hybrid' && hybridSessionUsage ? (
                <span className="font-semibold" style={{ color: colors.text }}>{hybridSessionUsage.resetDate}</span>
              ) : sessionPackage?.expiresAt ? (
                <span className="font-semibold" style={{ color: colors.text }}>
                  {new Date(sessionPackage.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              ) : (
                <span className="font-medium text-sm" style={{ color: colors.green }}>No expiry</span>
              )}
            </div>

            {/* Streak */}
            {canBookSessions && (
              <div className="flex items-center gap-1.5">
                <span style={{ color: colors.amber }}>🔥</span>
                <span className="font-semibold" style={{ color: colors.text }}>{bookingStats?.currentStreakWeeks || 0}</span>
                <span className="text-xs" style={{ color: colors.textMuted }}>weeks</span>
              </div>
            )}

            {/* Check-in */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: colors.textSecondary }}>Check-in:</span>
              {checkinUsage?.used ? (
                <span className="text-sm" style={{ color: colors.textMuted }}>Resets {checkinUsage.resetDate}</span>
              ) : (
                <span className="font-medium text-sm" style={{ color: colors.green }}>Available</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Type Toggle - Compact */}
      <div className="max-w-4xl mx-auto px-4 lg:px-6 mb-4">
        <Tabs defaultValue={canBookSessions ? 'session' : 'checkin'} onChange={(value) => setBookingType(value as BookingType)}>
          <TabsList className="w-full lg:w-auto lg:inline-flex">
            {canBookSessions && (
              <TabsTrigger value="session" className="flex-1 lg:flex-none lg:px-4">
                <span className="flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Training Session
                </span>
              </TabsTrigger>
            )}
            <TabsTrigger
              value="checkin"
              className="flex-1 lg:flex-none lg:px-4"
              disabled={checkinUsage?.used}
            >
              <span className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Virtual Check-in
              </span>
            </TabsTrigger>
          </TabsList>

          {canBookSessions && (
            <TabsContent value="session" className="mt-2">
              <p className="text-sm" style={{ color: colors.textSecondary }}>
                {clientType === 'hybrid' && hybridSessionUsage ? (
                  <>Select up to {hybridSessionUsage.limit - hybridSessionUsage.used} time slots for your training sessions this month.</>
                ) : sessionPackage ? (
                  <>Select up to {sessionPackage.remainingSessions} time slots for your training sessions.</>
                ) : (
                  <>Select time slots for your training sessions.</>
                )}
                {' '}Sessions are {sessionPackage?.sessionDurationMinutes || 60} min.
              </p>
            </TabsContent>
          )}

          <TabsContent value="checkin" className="mt-2">
            <p className="text-sm" style={{ color: colors.textSecondary }}>
              Book your monthly virtual check-in. Select a single 30-minute slot.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Book Week View */}
      {isQuickBookMode && (
        <div className="max-w-4xl mx-auto px-4 lg:px-6 mb-4">
          <div className="rounded-xl p-4 mb-4" style={{ background: colors.greenLight, border: `1px solid ${colors.green}30` }}>
            <p className="text-sm" style={{ color: colors.green }}>
              <strong>Quick Book Mode:</strong> Click on available time slots below to select multiple sessions across different days.
              {getRemainingSessionsForBooking() > 0 && (
                <span className="ml-1">You can book up to {getRemainingSessionsForBooking()} session{getRemainingSessionsForBooking() !== 1 ? 's' : ''}.</span>
              )}
            </p>
          </div>

          {/* Week Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={goToPreviousWeek}
              disabled={quickBookWeekStart <= getStartOfWeek(new Date())}
              className="p-2 rounded-lg hover:opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: colors.bgCard, color: colors.textSecondary }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold" style={{ color: colors.text }}>
              {formatDate(quickBookWeekDays[0])} - {formatDate(quickBookWeekDays[6])}
            </h2>
            <button
              onClick={goToNextWeek}
              className="p-2 rounded-lg hover:opacity-80 transition-colors"
              style={{ background: colors.bgCard, color: colors.textSecondary }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Week Grid */}
          {loadingWeekSlots ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8" style={{ color: colors.purple }} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
              {/* Week Header */}
              <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${colors.border}` }}>
                {quickBookWeekDays.map((day) => {
                  const isToday = isSameDay(day, new Date())
                  const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))
                  return (
                    <div
                      key={day.toISOString()}
                      className="p-3 text-center last:border-r-0"
                      style={{
                        borderRight: `1px solid ${colors.border}`,
                        background: isToday ? colors.purpleLight : isPast ? colors.bgTertiary : 'transparent'
                      }}
                    >
                      <div className="text-xs" style={{ color: colors.textMuted }}>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className="text-lg font-semibold mt-0.5" style={{ color: isToday ? colors.purple : isPast ? colors.textMuted : colors.text }}>
                        {day.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Week Body - Slots */}
              <div className="grid grid-cols-7 min-h-[300px]">
                {quickBookWeekDays.map((day) => {
                  const daySlots = slotsByDate.get(day.toDateString()) || []
                  const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))
                  const isToday = isSameDay(day, new Date())

                  // Get booked slot times to filter them out
                  const bookedSlotTimes = new Set(
                    upcomingBookings
                      .filter(b => isSameDay(new Date(b.startsAt), day))
                      .map(b => new Date(b.startsAt).getTime())
                  )
                  const availableSlots = daySlots.filter(
                    slot => !bookedSlotTimes.has(new Date(slot.startsAt).getTime())
                  )

                  return (
                    <div
                      key={day.toISOString()}
                      className="p-2 last:border-r-0"
                      style={{
                        borderRight: `1px solid ${colors.border}`,
                        background: isToday ? colors.purpleLight : isPast ? colors.bgTertiary : 'transparent'
                      }}
                    >
                      <div className="space-y-1 max-h-[280px] overflow-y-auto">
                        {/* Existing bookings */}
                        {upcomingBookings
                          .filter(b => isSameDay(new Date(b.startsAt), day))
                          .map(booking => (
                            <div
                              key={booking.id}
                              className="w-full p-1.5 rounded-lg text-xs"
                              style={{ background: `${colors.blue}20`, border: `1px solid ${colors.blue}50`, color: colors.blue }}
                            >
                              <div className="font-medium">{formatTime(booking.startsAt)}</div>
                              <div className="opacity-75 truncate">Booked</div>
                            </div>
                          ))}

                        {/* Available slots */}
                        {!isPast && availableSlots.map((slot) => {
                          const isSelected = quickBookSlots.some(s => s.startsAt === slot.startsAt)
                          return (
                            <button
                              key={slot.startsAt}
                              onClick={() => handleQuickBookSlotSelect(day, slot)}
                              className="w-full p-1.5 rounded-lg border text-left transition-all text-xs"
                              style={isSelected
                                ? { borderColor: colors.green, background: colors.greenLight, color: colors.green }
                                : { borderStyle: 'dashed', borderColor: colors.border, color: colors.textMuted }
                              }
                            >
                              <div className="font-medium flex items-center gap-1">
                                {formatTime(slot.startsAt)}
                                {slot.isFavorite && <span className="text-[8px]" style={{ color: colors.amber }}>★</span>}
                              </div>
                              <div className="opacity-75">{isSelected ? 'Selected' : 'Available'}</div>
                            </button>
                          )
                        })}

                        {/* Empty state */}
                        {!isPast && availableSlots.length === 0 && upcomingBookings.filter(b => isSameDay(new Date(b.startsAt), day)).length === 0 && (
                          <div className="text-center text-xs py-4" style={{ color: colors.textMuted }}>No slots</div>
                        )}
                        {isPast && (
                          <div className="text-center text-xs py-4" style={{ color: colors.textMuted }}>-</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected Slots Summary */}
          {quickBookSlots.length > 0 && (
            <div className="mt-4 p-4 rounded-xl" style={{ background: colors.greenLight, border: `1px solid ${colors.green}30` }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-2" style={{ color: colors.green }}>
                    {quickBookSlots.length} session{quickBookSlots.length !== 1 ? 's' : ''} selected
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {quickBookSlots
                      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                      .map((slot) => (
                        <span
                          key={slot.startsAt}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs"
                          style={{ background: `${colors.green}20`, color: colors.green }}
                        >
                          {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {formatTime(slot.startsAt)}
                          <button
                            type="button"
                            onClick={() => removeQuickBookSlot(slot)}
                            className="hover:opacity-70 ml-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                  </div>
                  {sessionPackage && (
                    <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
                      After booking: {sessionPackage.remainingSessions - quickBookSlots.length} sessions remaining
                    </p>
                  )}
                </div>
                <button
                  onClick={handleQuickBookConfirm}
                  disabled={bookingInProgress}
                  className="flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-xl transition-all"
                  style={{ background: colors.greenGradient }}
                >
                  {bookingInProgress ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Booking...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Book {quickBookSlots.length} Session{quickBookSlots.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content - Calendar with inline time slots on desktop */}
      {!isQuickBookMode && (
      <div className="max-w-4xl mx-auto px-4 lg:px-6">
        {/* Responsive layout: stacked on mobile, side-by-side on desktop */}
        <div style={{ display: 'flex', flexDirection: 'column' }} className="desktop-row">
          {/* Calendar Section */}
          <div className="calendar-section mb-6" style={{ flexShrink: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
                disabled={currentMonth <= calendarMonths[0]}
                className="p-1.5 rounded-lg hover:opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: colors.bgCard, color: colors.textSecondary }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-semibold" style={{ color: colors.text }}>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                disabled={currentMonth >= calendarMonths[2]}
                className="p-1.5 rounded-lg hover:opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: colors.bgCard, color: colors.textSecondary }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="rounded-xl p-2 md:p-3" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-[10px] md:text-xs font-medium py-1" style={{ color: colors.textMuted }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days - compact */}
              <div className="grid grid-cols-7 gap-0.5 md:gap-1">
                {(() => {
                  const year = currentMonth.getFullYear()
                  const month = currentMonth.getMonth()
                  const daysInMonth = getDaysInMonth(year, month)
                  const firstDay = getFirstDayOfMonth(year, month)
                  const cells = []

                  for (let i = 0; i < firstDay; i++) {
                    cells.push(<div key={`empty-${i}`} className="h-9" />)
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day)
                    const isPast = date < today
                    const isToday = isSameDay(date, today)
                    const isWithinNotice = isWithin12Hours(date)
                    const isSelected = selectedDate && isSameDay(date, selectedDate)
                    const hasSelectedSlots = selectedSlots.some(slot =>
                      isSameDay(new Date(slot.startsAt), date)
                    )
                    const hasBooking = upcomingBookings.some(b =>
                      isSameDay(new Date(b.startsAt), date)
                    )
                    const dayOfWeek = date.getDay()
                    const hasFavorite = bookingStats?.favoriteTimes?.some(fav => fav.day === dayOfWeek) || false
                    const isDisabled = isPast || (isToday && isWithinNotice)

                    const getButtonStyle = () => {
                      if (isDisabled) {
                        return { background: colors.bgTertiary, color: colors.textMuted, cursor: 'not-allowed' }
                      }
                      if (isSelected) {
                        return { background: colors.purpleDark, color: 'white', boxShadow: `0 0 0 2px ${colors.purple}` }
                      }
                      if (hasSelectedSlots) {
                        return { background: colors.purpleLight, color: colors.purple, boxShadow: `0 0 0 1px ${colors.purple}` }
                      }
                      if (hasBooking) {
                        return { background: colors.greenLight, color: colors.green }
                      }
                      return { background: colors.bgTertiary, color: colors.textSecondary }
                    }

                    cells.push(
                      <button
                        key={day}
                        onClick={() => !isDisabled && setSelectedDate(date)}
                        disabled={isDisabled}
                        className="h-9 rounded-md text-xs font-medium transition-all relative flex items-center justify-center hover:opacity-80"
                        style={getButtonStyle()}
                      >
                        {day}
                        {hasBooking && !isDisabled && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: colors.green }} />
                        )}
                        {hasFavorite && !isDisabled && !hasBooking && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: colors.amber }} />
                        )}
                        {isToday && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: colors.blue }} />
                        )}
                      </button>
                    )
                  }

                  return cells
                })()}
              </div>

              {/* Legend */}
              <div className="hidden md:flex items-center justify-center gap-2 mt-1.5 pt-1.5 text-[9px]" style={{ borderTop: `1px solid ${colors.border}`, color: colors.textMuted }}>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.amber }} />Fav</span>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.green }} />Booked</span>
                <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: colors.purple }} />Selected</span>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Time Slots & Upcoming */}
          <div className="sidebar-section space-y-3" style={{ flex: 1, minWidth: 0 }}>
            {/* Time Slots */}
            <div className="rounded-xl p-3" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
              {selectedDate ? (
                <>
                  <h3 className="font-medium text-sm mb-2" style={{ color: colors.text }}>{formatDate(selectedDate)}</h3>

                  {/* Show existing bookings for selected date */}
                  {(() => {
                    const dateBookings = upcomingBookings.filter(b => isSameDay(new Date(b.startsAt), selectedDate))
                    if (dateBookings.length > 0) {
                      return (
                        <div className="mb-3">
                          <p className="text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>Your Bookings</p>
                          <div className="space-y-1.5">
                            {dateBookings.map((booking) => (
                              <div
                                key={booking.id}
                                className="flex items-center justify-between p-2 rounded-lg"
                                style={{ background: colors.purpleLight, border: `1px solid ${colors.purple}40` }}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-6 h-6 rounded flex items-center justify-center"
                                    style={{ background: `${colors.purple}30`, color: colors.purple }}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={booking.bookingType === 'checkin' ? "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" : "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"} />
                                    </svg>
                                  </div>
                                  <div>
                                    <span className="text-xs font-medium" style={{ color: colors.purple }}>{formatTime(booking.startsAt)}</span>
                                    <span className="text-xs ml-1.5" style={{ color: colors.textSecondary }}>
                                      {booking.bookingType === 'checkin' ? 'Check-in' : 'Training'}
                                    </span>
                                  </div>
                                </div>
                                {!isWithin12Hours(new Date(booking.startsAt)) && (
                                  <button
                                    onClick={() => { setSelectedBookingForAction(booking); setShowCancelModal(true) }}
                                    className="p-1 rounded hover:opacity-70"
                                    style={{ color: colors.textMuted }}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Available slots */}
                  <p className="text-xs font-medium mb-1.5" style={{ color: colors.textSecondary }}>Available Slots</p>
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-4">
                      <svg className="animate-spin h-5 w-5" style={{ color: colors.purple }} viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <p className="text-xs text-center py-3" style={{ color: colors.textMuted }}>No available slots</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {availableSlots.map((slot, index) => {
                        const isSelected = selectedSlots.some(s => s.startsAt === slot.startsAt)
                        return (
                          <button
                            key={index}
                            onClick={() => handleSlotSelect(slot)}
                            className="py-1.5 px-2 rounded text-xs font-medium transition-all relative"
                            style={isSelected
                              ? { background: colors.purpleGradient, color: 'white' }
                              : { background: colors.bgTertiary, color: colors.textSecondary, border: `1px solid ${colors.border}` }
                            }
                          >
                            {formatTime(slot.startsAt)}
                            {slot.isFavorite && <span className="absolute top-0 right-0.5 text-[8px]" style={{ color: colors.amber }}>★</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {selectedSlots.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${colors.border}` }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium" style={{ color: colors.text }}>{selectedSlots.length} selected</span>
                        <div className="flex gap-1.5">
                          <Button size="sm" onClick={() => setShowConfirmModal(true)} disabled={bookingInProgress} className="text-xs px-2 py-1">
                            Confirm
                          </Button>
                          <button onClick={() => setSelectedSlots([])} className="text-xs" style={{ color: colors.textMuted }}>Clear</button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <svg className="w-8 h-8 mx-auto mb-1" style={{ color: colors.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-xs" style={{ color: colors.textMuted }}>Select a date</p>
                </div>
              )}
            </div>

            {/* Upcoming Bookings */}
            <div className="rounded-xl p-3" style={{ background: colors.bgCard, border: `1px solid ${colors.border}` }}>
              <h3 className="font-medium text-xs mb-2" style={{ color: colors.text }}>Upcoming</h3>
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-3">
                  <svg className="animate-spin h-4 w-4" style={{ color: colors.purple }} viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : upcomingBookings.length === 0 ? (
                <p className="text-xs text-center py-2" style={{ color: colors.textMuted }}>No upcoming bookings</p>
              ) : (
                <div className="space-y-1.5">
                  {upcomingBookings.slice(0, 4).map((booking) => {
                    const bookingDate = new Date(booking.startsAt)
                    const canCancel = !isWithin12Hours(bookingDate)
                    return (
                      <div
                        key={booking.id}
                        className="rounded p-1.5 flex items-center justify-between text-xs"
                        style={{ background: colors.bgTertiary }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                            style={{
                              background: booking.bookingType === 'checkin' ? colors.purpleLight : `${colors.blue}20`,
                              color: booking.bookingType === 'checkin' ? colors.purple : colors.blue
                            }}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={booking.bookingType === 'checkin' ? "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" : "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"} />
                            </svg>
                          </div>
                          <div className="min-w-0 truncate">
                            <span style={{ color: colors.text }}>{formatDate(bookingDate)}</span>
                            <span className="ml-1" style={{ color: colors.textMuted }}>{formatTime(booking.startsAt)}</span>
                          </div>
                        </div>
                        {canCancel && (
                          <button
                            onClick={() => { setSelectedBookingForAction(booking); setShowCancelModal(true) }}
                            className="p-0.5 hover:opacity-70 flex-shrink-0"
                            style={{ color: colors.textMuted }}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {upcomingBookings.length > 4 && (
                    <p className="text-[10px] text-center" style={{ color: colors.textMuted }}>+{upcomingBookings.length - 4} more</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* CSS for desktop side-by-side layout */}
      <style jsx>{`
        @media (min-width: 800px) {
          .desktop-row {
            flex-direction: row !important;
            gap: 1.5rem;
            align-items: flex-start;
          }
          .calendar-section {
            width: 320px;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      {/* Mobile Selected Slots Summary - Only show on mobile and not in quick book mode */}
      {!isQuickBookMode && selectedSlots.length > 0 && (
        <div className="min-[800px]:hidden fixed bottom-20 left-0 right-0 px-4 z-40">
          <div className="max-w-lg mx-auto bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-white font-semibold">
                  {selectedSlots.length} {bookingType === 'session' ? 'Session' : 'Check-in'}{selectedSlots.length > 1 ? 's' : ''} Selected
                </div>
                <div className="text-slate-400 text-sm">
                  {selectedSlots.map(slot => formatTime(slot.startsAt)).join(', ')}
                </div>
              </div>
              <Button
                onClick={() => setShowConfirmModal(true)}
                disabled={bookingInProgress}
              >
                Confirm
              </Button>
            </div>
            <button
              onClick={() => setSelectedSlots([])}
              className="text-slate-500 hover:text-slate-300 text-sm"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {/* Confirm Booking Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Booking"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            You are about to book {selectedSlots.length} {bookingType === 'session' ? 'session' : 'check-in'}{selectedSlots.length > 1 ? 's' : ''}:
          </p>

          <div className="space-y-2">
            {selectedSlots.map((slot, index) => (
              <div key={index} className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-white font-medium">
                  {formatFullDate(new Date(slot.startsAt))}
                </div>
                <div className="text-slate-400 text-sm">
                  {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                </div>
              </div>
            ))}
          </div>

          {bookingType === 'session' && canBookSessions && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <div className="text-purple-300 text-sm">
                {clientType === 'hybrid' && hybridSessionUsage ? (
                  <>This will use {selectedSlots.length} of your {hybridSessionUsage.limit - hybridSessionUsage.used} remaining monthly sessions.</>
                ) : sessionPackage ? (
                  <>This will use {selectedSlots.length} of your {sessionPackage.remainingSessions} remaining sessions.</>
                ) : null}
              </div>
            </div>
          )}

          <ModalFooter>
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmBooking} loading={bookingInProgress}>
              Confirm Booking
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Cancel Booking Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setSelectedBookingForAction(null)
        }}
        title="Manage Booking"
      >
        <div className="space-y-4">
          <p style={{ color: colors.textSecondary }}>
            What would you like to do with this booking?
          </p>

          {selectedBookingForAction && (
            <div className="rounded-lg p-3" style={{ background: colors.bgTertiary }}>
              <div className="font-medium" style={{ color: colors.text }}>
                {selectedBookingForAction.bookingType === 'checkin' ? 'Virtual Check-in' : 'Training Session'}
              </div>
              <div className="text-sm" style={{ color: colors.textMuted }}>
                {formatFullDate(new Date(selectedBookingForAction.startsAt))} at {formatTime(selectedBookingForAction.startsAt)}
              </div>
            </div>
          )}

          <div className="rounded-lg p-3" style={{ background: colors.amberLight, border: `1px solid ${colors.amber}40` }}>
            <div className="text-sm" style={{ color: colors.amber }}>
              Cancellations must be made at least 12 hours in advance.
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => {
              setShowCancelModal(false)
              setSelectedBookingForAction(null)
            }}>
              Keep Booking
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowCancelModal(false)
                setShowRescheduleModal(true)
              }}
            >
              Reschedule
            </Button>
            <Button variant="danger" onClick={handleCancelBooking}>
              Cancel
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* Reschedule Modal */}
      <Modal
        isOpen={showRescheduleModal}
        onClose={() => {
          setShowRescheduleModal(false)
          setSelectedBookingForAction(null)
        }}
        title="Reschedule Booking"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Select a new time for your {selectedBookingForAction?.bookingType === 'checkin' ? 'check-in' : 'session'}:
          </p>

          {selectedBookingForAction && (
            <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
              <div className="text-slate-400 text-xs mb-1">Current booking</div>
              <div className="text-white font-medium">
                {formatFullDate(new Date(selectedBookingForAction.startsAt))} at {formatTime(selectedBookingForAction.startsAt)}
              </div>
            </div>
          )}

          <p className="text-slate-400 text-sm">
            Select a date from the calendar above and choose a new time slot, then click &quot;Reschedule&quot; below.
          </p>

          <ModalFooter>
            <Button variant="secondary" onClick={() => {
              setShowRescheduleModal(false)
              setSelectedBookingForAction(null)
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedSlots.length > 0) {
                  handleReschedule(selectedSlots[0])
                }
              }}
              disabled={selectedSlots.length === 0}
            >
              Reschedule
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  )
}
