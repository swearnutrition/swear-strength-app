'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useBookings } from '@/hooks/useBookings'
import { useAvailability } from '@/hooks/useAvailability'
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

interface ClientBookingsClientProps {
  userId: string
  userName: string
  coachId: string | null
  sessionPackage: SessionPackageInfo | null
  bookingStats: BookingStatsInfo | null
  checkinUsage: CheckinUsageInfo | null
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

export function ClientBookingsClient({
  userId,
  userName,
  coachId,
  sessionPackage,
  bookingStats,
  checkinUsage,
}: ClientBookingsClientProps) {
  const [bookingType, setBookingType] = useState<BookingType>('session')
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
    return bookings
      .filter(b => b.status === 'confirmed' && new Date(b.startsAt) >= today)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
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
  }, [bookingType])

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
        if (sessionPackage && selectedSlots.length >= sessionPackage.remainingSessions) {
          alert('You have reached your session limit. Please purchase more sessions.')
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Active Package</h2>
          <p className="text-slate-400">You don&apos;t have an active session package yet. Contact your coach to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <Link href="/dashboard" className="inline-flex items-center text-slate-400 hover:text-white mb-4">
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <h1 className="text-2xl font-bold text-white">Book Sessions</h1>
        <p className="text-slate-400 mt-1">Schedule your training sessions and check-ins</p>
      </div>

      {/* Package Status Header */}
      <div className="px-4 mb-6">
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Sessions Remaining */}
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs font-medium mb-1">Sessions</div>
              {sessionPackage ? (
                <div className="text-white font-bold text-lg">
                  {sessionPackage.remainingSessions} <span className="text-slate-500 font-normal text-sm">of {sessionPackage.totalSessions}</span>
                </div>
              ) : (
                <div className="text-slate-500">No package</div>
              )}
            </div>

            {/* Expiration Date */}
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs font-medium mb-1">Expires</div>
              {sessionPackage?.expiresAt ? (
                <div className="text-white font-bold text-lg">
                  {new Date(sessionPackage.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              ) : (
                <div className="text-green-400 font-medium">No expiry</div>
              )}
            </div>

            {/* Booking Streak */}
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs font-medium mb-1">Streak</div>
              <div className="flex items-center gap-1">
                <span className="text-amber-400 text-lg">🔥</span>
                <span className="text-white font-bold text-lg">
                  {bookingStats?.currentStreakWeeks || 0}
                </span>
                <span className="text-slate-500 text-sm">weeks</span>
              </div>
            </div>

            {/* Check-in Availability */}
            <div className="bg-slate-800/50 rounded-xl p-3">
              <div className="text-slate-400 text-xs font-medium mb-1">Check-in</div>
              {checkinUsage ? (
                checkinUsage.used ? (
                  <div className="text-slate-500 text-sm">
                    Resets {checkinUsage.resetDate}
                  </div>
                ) : (
                  <div className="text-green-400 font-medium">1 available</div>
                )
              ) : (
                <div className="text-green-400 font-medium">1 available</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Booking Type Toggle */}
      <div className="px-4 mb-6">
        <Tabs defaultValue="session" onChange={(value) => setBookingType(value as BookingType)}>
          <TabsList className="w-full">
            <TabsTrigger value="session" className="flex-1">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                In-Person Session
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="checkin"
              className="flex-1"
              disabled={checkinUsage?.used}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Virtual Check-in
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="session" className="mt-4">
            <p className="text-slate-400 text-sm">
              Select {sessionPackage ? `up to ${sessionPackage.remainingSessions} time slots` : 'time slots'} for your training sessions.
              Sessions are {sessionPackage?.sessionDurationMinutes || 60} minutes.
            </p>
          </TabsContent>

          <TabsContent value="checkin" className="mt-4">
            <p className="text-slate-400 text-sm">
              Book your monthly virtual check-in. Select a single 30-minute slot.
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Calendar View */}
      <div className="px-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, -1))}
            disabled={currentMonth <= calendarMonths[0]}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-white">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
            disabled={currentMonth >= calendarMonths[2]}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const year = currentMonth.getFullYear()
              const month = currentMonth.getMonth()
              const daysInMonth = getDaysInMonth(year, month)
              const firstDay = getFirstDayOfMonth(year, month)
              const cells = []

              // Empty cells for days before the month starts
              for (let i = 0; i < firstDay; i++) {
                cells.push(<div key={`empty-${i}`} className="aspect-square" />)
              }

              // Days of the month
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

                // Check if date has favorite times
                const dayOfWeek = date.getDay()
                const hasFavorite = bookingStats?.favoriteTimes?.some(fav => fav.day === dayOfWeek) || false

                const isDisabled = isPast || (isToday && isWithinNotice)

                cells.push(
                  <button
                    key={day}
                    onClick={() => !isDisabled && setSelectedDate(date)}
                    disabled={isDisabled}
                    className={`
                      aspect-square rounded-lg text-sm font-medium transition-all relative
                      ${isDisabled
                        ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed'
                        : isSelected
                          ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                          : hasSelectedSlots
                            ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-500'
                            : hasBooking
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'
                      }
                    `}
                  >
                    {day}
                    {hasFavorite && !isDisabled && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
                    )}
                    {isToday && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400" />
                    )}
                  </button>
                )
              }

              return cells
            })()}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Favorite
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Booked
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              Selected
            </div>
          </div>
        </div>
      </div>

      {/* Time Slots for Selected Date */}
      {selectedDate && (
        <div className="px-4 mb-6">
          <h3 className="text-white font-semibold mb-3">
            Available Times - {formatDate(selectedDate)}
          </h3>

          {loadingSlots ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 text-center">
              <p className="text-slate-400">No available slots for this date</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map((slot, index) => {
                const isSelected = selectedSlots.some(s => s.startsAt === slot.startsAt)
                return (
                  <button
                    key={index}
                    onClick={() => handleSlotSelect(slot)}
                    className={`
                      py-3 px-2 rounded-xl text-sm font-medium transition-all relative
                      ${isSelected
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                        : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      }
                    `}
                  >
                    {formatTime(slot.startsAt)}
                    {slot.isFavorite && (
                      <span className="absolute top-1 right-1 text-amber-400 text-xs">★</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Slots Summary */}
      {selectedSlots.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
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

      {/* Upcoming Bookings */}
      <div className="px-4 mb-6">
        <h3 className="text-white font-semibold mb-3">Upcoming Bookings</h3>

        {bookingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : upcomingBookings.length === 0 ? (
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-slate-400">No upcoming bookings</p>
            <p className="text-slate-500 text-sm mt-1">Select a date above to book a session</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((booking) => {
              const bookingDate = new Date(booking.startsAt)
              const canCancel = !isWithin12Hours(bookingDate)

              return (
                <div
                  key={booking.id}
                  className="bg-slate-900/50 rounded-xl border border-slate-800 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center
                        ${booking.bookingType === 'checkin'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-blue-500/20 text-blue-400'
                        }
                      `}>
                        {booking.bookingType === 'checkin' ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="text-white font-medium">
                          {booking.bookingType === 'checkin' ? 'Virtual Check-in' : 'Training Session'}
                        </div>
                        <div className="text-slate-400 text-sm">
                          {formatDate(bookingDate)} at {formatTime(booking.startsAt)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canCancel && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedBookingForAction(booking)
                              setShowRescheduleModal(true)
                            }}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBookingForAction(booking)
                              setShowCancelModal(true)
                            }}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                      {!canCancel && (
                        <span className="text-amber-400 text-xs">Within 12hrs</span>
                      )}
                    </div>
                  </div>

                  {booking.googleMeetLink && (
                    <a
                      href={booking.googleMeetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Join Meeting
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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

          {bookingType === 'session' && sessionPackage && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <div className="text-purple-300 text-sm">
                This will use {selectedSlots.length} of your {sessionPackage.remainingSessions} remaining sessions.
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
        title="Cancel Booking"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Are you sure you want to cancel this booking?
          </p>

          {selectedBookingForAction && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-white font-medium">
                {selectedBookingForAction.bookingType === 'checkin' ? 'Virtual Check-in' : 'Training Session'}
              </div>
              <div className="text-slate-400 text-sm">
                {formatFullDate(new Date(selectedBookingForAction.startsAt))} at {formatTime(selectedBookingForAction.startsAt)}
              </div>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <div className="text-amber-300 text-sm">
              Cancellations within 12 hours of the session are not allowed. Your session credit will be restored.
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => {
              setShowCancelModal(false)
              setSelectedBookingForAction(null)
            }}>
              Keep Booking
            </Button>
            <Button variant="danger" onClick={handleCancelBooking}>
              Cancel Booking
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
