'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAvailability } from '@/hooks/useAvailability'
import { useBookings } from '@/hooks/useBookings'
import type { BookingType, AvailableSlot, SessionPackage, ClientCheckinUsage } from '@/types/booking'

interface ClientWithPackage {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  activePackage: SessionPackage | null
  checkinUsage: ClientCheckinUsage | null
}

// One-off booking option (pseudo-client for UI)
const ONE_OFF_BOOKING_ID = '__one_off__'

interface BookSessionModalProps {
  isOpen: boolean
  onClose: () => void
  clients: ClientWithPackage[]
  preselectedClientId?: string
  preselectedDate?: string
  onSuccess: () => void
}

export function BookSessionModal({
  isOpen,
  onClose,
  clients,
  preselectedClientId,
  preselectedDate,
  onSuccess,
}: BookSessionModalProps) {
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '')
  const [bookingType, setBookingType] = useState<BookingType>('session')
  const [selectedDate, setSelectedDate] = useState(preselectedDate || '')
  const [selectedSlots, setSelectedSlots] = useState<AvailableSlot[]>([])
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // One-off booking fields
  const [oneOffClientName, setOneOffClientName] = useState('')
  const [oneOffDuration, setOneOffDuration] = useState(60)

  const { getAvailableSlots } = useAvailability({ type: bookingType })
  const { createMultipleBookings } = useBookings()

  const isOneOffBooking = selectedClientId === ONE_OFF_BOOKING_ID

  // Get selected client info
  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  )

  // Check if check-in is available for selected client this month
  const canBookCheckin = useMemo(() => {
    if (!selectedClient) return false
    // Check-in is available if they haven't used it this month
    return !selectedClient.checkinUsage?.used
  }, [selectedClient])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedClientId(preselectedClientId || '')
      setBookingType('session')
      setSelectedDate(preselectedDate || new Date().toISOString().split('T')[0])
      setSelectedSlots([])
      setAvailableSlots([])
      setOneOffClientName('')
      setOneOffDuration(60)
    }
  }, [isOpen, preselectedClientId, preselectedDate])

  // Fetch available slots when date or booking type changes
  useEffect(() => {
    if (!selectedDate) return

    const fetchSlots = async () => {
      setLoadingSlots(true)
      setSelectedSlots([])
      try {
        let duration: number
        if (bookingType === 'checkin') {
          duration = 30
        } else if (isOneOffBooking) {
          duration = oneOffDuration
        } else {
          duration = selectedClient?.activePackage?.sessionDurationMinutes || 60
        }
        console.log('BookSessionModal: Fetching slots for date:', selectedDate, 'duration:', duration)
        const slots = await getAvailableSlots(selectedDate, duration)
        console.log('BookSessionModal: Got slots:', slots.length)
        setAvailableSlots(slots)
      } catch (err) {
        console.error('Error fetching slots:', err)
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [selectedDate, bookingType, selectedClient?.activePackage?.sessionDurationMinutes, getAvailableSlots, isOneOffBooking, oneOffDuration])

  // Toggle slot selection
  const toggleSlot = (slot: AvailableSlot) => {
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => s.startsAt === slot.startsAt)
      if (exists) {
        return prev.filter((s) => s.startsAt !== slot.startsAt)
      }
      // For check-ins, only allow one slot
      if (bookingType === 'checkin') {
        return [slot]
      }
      return [...prev, slot]
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClientId || selectedSlots.length === 0) return

    // Validate one-off booking has client name
    if (isOneOffBooking && !oneOffClientName.trim()) {
      alert('Please enter a client name for the one-off booking.')
      return
    }

    // Validate sessions available (only for existing clients with packages)
    if (bookingType === 'session' && !isOneOffBooking && selectedClient?.activePackage) {
      const remainingSessions = selectedClient.activePackage.remainingSessions
      if (selectedSlots.length > remainingSessions) {
        alert(`Not enough sessions remaining. Client has ${remainingSessions} sessions left.`)
        return
      }
    }

    setSubmitting(true)
    try {
      const payloads = selectedSlots.map((slot) => ({
        clientId: isOneOffBooking ? null : selectedClientId,
        bookingType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        packageId: bookingType === 'session' && !isOneOffBooking ? selectedClient?.activePackage?.id : undefined,
        // One-off booking fields
        oneOffClientName: isOneOffBooking ? oneOffClientName.trim() : undefined,
        isOneOff: isOneOffBooking,
      }))

      const results = await createMultipleBookings(payloads)

      if (results.length > 0) {
        onSuccess()
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      onClose()
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const canSubmit = useMemo(() => {
    if (!selectedClientId || selectedSlots.length === 0 || submitting) return false

    // One-off booking: just need client name
    if (isOneOffBooking) {
      return oneOffClientName.trim().length > 0
    }

    // Check-in: needs available check-in
    if (bookingType === 'checkin') {
      return canBookCheckin
    }

    // Regular session: can book with or without package
    // With package: deducts from remaining sessions
    // Without package: one-off session
    return true
  }, [selectedClientId, selectedSlots.length, submitting, isOneOffBooking, oneOffClientName, bookingType, canBookCheckin])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Book Session</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Schedule a session or check-in with a client</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Client selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value)
                setSelectedSlots([])
                // Reset booking type to session for one-off
                if (e.target.value === ONE_OFF_BOOKING_ID) {
                  setBookingType('session')
                }
              }}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a client</option>
              <option value={ONE_OFF_BOOKING_ID}>One-off booking (no account)</option>
              <optgroup label="Existing Clients">
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.activePackage ? `${client.activePackage.remainingSessions} sessions` : 'No package'}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* One-off booking fields */}
          {isOneOffBooking && (
            <div className="space-y-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30">
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">One-off Booking Details</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={oneOffClientName}
                  onChange={(e) => setOneOffClientName(e.target.value)}
                  placeholder="Enter client name"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Session Duration
                </label>
                <select
                  value={oneOffDuration}
                  onChange={(e) => {
                    setOneOffDuration(Number(e.target.value))
                    setSelectedSlots([])
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
          )}

          {/* Client package info */}
          {selectedClient && (
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Package Info</h3>
              {selectedClient.activePackage ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sessions Remaining</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {selectedClient.activePackage.remainingSessions} / {selectedClient.activePackage.totalSessions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Session Duration</p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {selectedClient.activePackage.sessionDurationMinutes} min
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No active session package. Session will be booked without deducting from a package.
                </p>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">Monthly Check-in</p>
                <p className={`text-sm font-medium ${canBookCheckin ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                  {canBookCheckin ? 'Available' : 'Already used this month'}
                </p>
              </div>
            </div>
          )}

          {/* Booking type - hide for one-off bookings (only sessions available) */}
          {!isOneOffBooking && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Booking Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setBookingType('session')
                    setSelectedSlots([])
                  }}
                  className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    bookingType === 'session'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Session
                  </div>
                  {selectedClient?.activePackage && (
                    <p className="text-xs mt-1 opacity-75">{selectedClient.activePackage.remainingSessions} left</p>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingType('checkin')
                    setSelectedSlots([])
                  }}
                  disabled={!canBookCheckin}
                  className={`px-4 py-3 rounded-xl border-2 font-medium transition-all ${
                    bookingType === 'checkin'
                      ? 'border-green-500 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Check-in
                  </div>
                  <p className="text-xs mt-1 opacity-75">{canBookCheckin ? '1 available' : 'Used'}</p>
                </button>
              </div>
            </div>
          )}

          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Time slots */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Available Time Slots {bookingType === 'session' && '(select multiple)'}
            </label>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-8">
                <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p>No available slots for this date</p>
                <p className="text-sm">Try selecting a different date</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlots.some((s) => s.startsAt === slot.startsAt)
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => toggleSlot(slot)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {formatTime(slot.startsAt)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Selected summary */}
          {selectedSlots.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-200 dark:border-blue-500/30">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                {selectedSlots.length} {selectedSlots.length === 1 ? 'slot' : 'slots'} selected
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedSlots
                  .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                  .map((slot) => (
                    <span
                      key={slot.startsAt}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 rounded-md text-sm"
                    >
                      {formatTime(slot.startsAt)} - {formatTime(slot.endsAt)}
                      <button
                        type="button"
                        onClick={() => toggleSlot(slot)}
                        className="hover:text-blue-600 dark:hover:text-blue-200"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
              </div>
              {bookingType === 'session' && selectedClient?.activePackage && (
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                  After booking: {selectedClient.activePackage.remainingSessions - selectedSlots.length} sessions remaining
                </p>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Booking...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Book {selectedSlots.length > 1 ? `${selectedSlots.length} Sessions` : bookingType === 'checkin' ? 'Check-in' : 'Session'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
