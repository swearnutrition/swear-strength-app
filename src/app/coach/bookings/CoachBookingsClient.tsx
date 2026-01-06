'use client'

import { useState, useMemo, useEffect } from 'react'
import { useBookings } from '@/hooks/useBookings'
import { useSessionPackages } from '@/hooks/useSessionPackages'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { BookSessionModal } from '@/components/booking/BookSessionModal'
import { createClient } from '@/lib/supabase/client'
import type { BookingWithDetails, BookingStatus, SessionPackage, ClientCheckinUsage } from '@/types/booking'

interface Client {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

interface ClientWithPackage {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  activePackage: SessionPackage | null
  checkinUsage: ClientCheckinUsage | null
}

interface CoachBookingsClientProps {
  userId: string
  clients: Client[]
}

type ViewMode = 'week' | 'month'

// Helper functions for date manipulation
function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getEndOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() + (6 - day)
  d.setDate(diff)
  d.setHours(23, 59, 59, 999)
  return d
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
}

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

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.toDateString() === d2.toDateString()
}

export function CoachBookingsClient({ userId, clients }: CoachBookingsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showBookSessionModal, setShowBookSessionModal] = useState(false)
  const [showBlockTimeModal, setShowBlockTimeModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [clientsWithPackages, setClientsWithPackages] = useState<ClientWithPackage[]>([])
  const supabase = createClient()

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      return {
        from: getStartOfWeek(currentDate).toISOString(),
        to: getEndOfWeek(currentDate).toISOString(),
      }
    } else {
      return {
        from: getStartOfMonth(currentDate).toISOString(),
        to: getEndOfMonth(currentDate).toISOString(),
      }
    }
  }, [currentDate, viewMode])

  const { bookings, loading: bookingsLoading, cancelBooking, updateStatus } = useBookings({
    from: dateRange.from,
    to: dateRange.to,
  })

  const { packages, loading: packagesLoading, refetch: refetchPackages } = useSessionPackages()

  // Fetch clients with their packages and check-in usage
  useEffect(() => {
    async function fetchClientsWithPackages() {
      const currentMonth = new Date()
      currentMonth.setDate(1)
      const monthStr = currentMonth.toISOString().split('T')[0]

      const clientsData: ClientWithPackage[] = await Promise.all(
        clients.map(async (client) => {
          // Get active package for this client
          const activePackage = packages.find(
            (pkg) => pkg.clientId === client.id && pkg.remainingSessions > 0
          ) || null

          // Get check-in usage for this month
          const { data: checkinData } = await supabase
            .from('client_checkin_usage')
            .select('*')
            .eq('client_id', client.id)
            .eq('month', monthStr)
            .single()

          const checkinUsage: ClientCheckinUsage | null = checkinData ? {
            id: checkinData.id,
            clientId: checkinData.client_id,
            coachId: checkinData.coach_id,
            month: checkinData.month,
            used: checkinData.used,
            bookingId: checkinData.booking_id,
          } : null

          return {
            id: client.id,
            name: client.name,
            email: client.email,
            avatarUrl: client.avatar_url,
            activePackage,
            checkinUsage,
          }
        })
      )

      setClientsWithPackages(clientsData)
    }

    if (!packagesLoading && clients.length > 0) {
      fetchClientsWithPackages()
    }
  }, [clients, packages, packagesLoading, supabase])

  // Get today's and tomorrow's bookings for sidebar
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayBookings = useMemo(() => {
    return bookings
      .filter((b) => isSameDay(new Date(b.startsAt), today) && b.status === 'confirmed')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [bookings, today])

  const tomorrowBookings = useMemo(() => {
    return bookings
      .filter((b) => isSameDay(new Date(b.startsAt), tomorrow) && b.status === 'confirmed')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [bookings, tomorrow])

  // Clients needing renewal (low sessions or expiring soon)
  const clientsNeedingRenewal = useMemo(() => {
    const renewalThreshold = 2
    const oneMonthFromNow = new Date()
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1)

    return packages
      .filter((pkg) => {
        const lowSessions = pkg.remainingSessions <= renewalThreshold
        const expiringSoon = pkg.expiresAt && new Date(pkg.expiresAt) <= oneMonthFromNow
        return lowSessions || expiringSoon
      })
      .map((pkg) => ({
        package: pkg,
        reason: pkg.remainingSessions <= renewalThreshold ? 'low_sessions' : 'expiring_soon',
      }))
  }, [packages])

  // Generate week days for calendar header
  const weekDays = useMemo(() => {
    const start = getStartOfWeek(currentDate)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      return date
    })
  }, [currentDate])

  // Generate month days for calendar
  const monthDays = useMemo(() => {
    const start = getStartOfMonth(currentDate)
    const end = getEndOfMonth(currentDate)
    const startDay = start.getDay()
    const days: (Date | null)[] = []

    // Add empty cells for days before the month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    let current = new Date(start)
    while (current <= end) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }

    return days
  }, [currentDate])

  // Group bookings by date for calendar rendering
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingWithDetails[]>()
    bookings.forEach((booking) => {
      const dateKey = new Date(booking.startsAt).toDateString()
      const existing = map.get(dateKey) || []
      map.set(dateKey, [...existing, booking])
    })
    return map
  }, [bookings])

  // Navigation functions
  const goToPrevious = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setMonth(newDate.getMonth() - 1)
    }
    setCurrentDate(newDate)
  }

  const goToNext = () => {
    const newDate = new Date(currentDate)
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return
    await cancelBooking(bookingId)
    setSelectedBooking(null)
  }

  const handleMarkComplete = async (bookingId: string) => {
    await updateStatus(bookingId, 'completed')
    setSelectedBooking(null)
  }

  const handleMarkNoShow = async (bookingId: string) => {
    await updateStatus(bookingId, 'no_show')
    setSelectedBooking(null)
  }

  const getStatusBadge = (status: BookingStatus) => {
    const styles: Record<BookingStatus, string> = {
      confirmed: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
      no_show: 'bg-amber-500/20 text-amber-400',
    }
    return styles[status] || 'bg-slate-500/20 text-slate-400'
  }

  const getBookingColor = (booking: BookingWithDetails) => {
    if (booking.status === 'cancelled') return 'bg-red-500/20 border-red-500/50 text-red-300'
    if (booking.status === 'completed') return 'bg-green-500/20 border-green-500/50 text-green-300'
    if (booking.status === 'no_show') return 'bg-amber-500/20 border-amber-500/50 text-amber-300'
    if (booking.bookingType === 'checkin') return 'bg-purple-500/20 border-purple-500/50 text-purple-300'
    return 'bg-blue-500/20 border-blue-500/50 text-blue-300'
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Main Calendar Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Bookings</h1>
              <p className="text-slate-400 mt-1">Manage your training sessions and check-ins</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Quick Actions */}
              <button
                onClick={() => setShowBookSessionModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Book Session
              </button>
              <button
                onClick={() => setShowBlockTimeModal(true)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Block Time
              </button>
            </div>
          </div>

          {/* Calendar Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={goToPrevious}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToToday}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-colors"
              >
                Today
              </button>
              <button
                onClick={goToNext}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-white ml-2">
                {viewMode === 'week'
                  ? `${formatDate(weekDays[0])} - ${formatDate(weekDays[6])}`
                  : currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'month'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Month
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="flex-1 overflow-auto p-6">
          {bookingsLoading ? (
            <div className="flex items-center justify-center h-64">
              <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : viewMode === 'week' ? (
            // Week View
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              {/* Week Header */}
              <div className="grid grid-cols-7 border-b border-slate-800">
                {weekDays.map((day) => {
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-4 text-center border-r border-slate-800 last:border-r-0 ${
                        isToday ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <div className="text-sm text-slate-500">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                      <div className={`text-xl font-semibold mt-1 ${isToday ? 'text-purple-400' : 'text-white'}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Week Body */}
              <div className="grid grid-cols-7 min-h-[400px]">
                {weekDays.map((day) => {
                  const dayBookings = bookingsByDate.get(day.toDateString()) || []
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 border-r border-slate-800 last:border-r-0 ${
                        isToday ? 'bg-purple-500/5' : ''
                      }`}
                    >
                      {dayBookings.length === 0 ? (
                        <div className="text-center text-slate-600 text-sm py-8">No bookings</div>
                      ) : (
                        <div className="space-y-2">
                          {dayBookings
                            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                            .map((booking) => (
                              <button
                                key={booking.id}
                                onClick={() => setSelectedBooking(booking)}
                                className={`w-full p-2 rounded-lg border text-left transition-all hover:scale-[1.02] ${getBookingColor(booking)}`}
                              >
                                <div className="text-xs font-medium">{formatTime(booking.startsAt)}</div>
                                <div className="text-sm font-semibold truncate">{booking.client?.name}</div>
                                <div className="text-xs opacity-75 capitalize">
                                  {booking.bookingType === 'checkin' ? 'Check-in' : 'Session'}
                                </div>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            // Month View
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              {/* Month Header */}
              <div className="grid grid-cols-7 border-b border-slate-800">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-slate-500 border-r border-slate-800 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Month Grid */}
              <div className="grid grid-cols-7">
                {monthDays.map((day, index) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="p-2 h-28 border-r border-b border-slate-800 last:border-r-0 bg-slate-900/30"
                      />
                    )
                  }

                  const dayBookings = bookingsByDate.get(day.toDateString()) || []
                  const isToday = isSameDay(day, new Date())

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 h-28 border-r border-b border-slate-800 last:border-r-0 overflow-hidden ${
                        isToday ? 'bg-purple-500/10' : ''
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-purple-400' : 'text-slate-400'}`}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayBookings.slice(0, 2).map((booking) => (
                          <button
                            key={booking.id}
                            onClick={() => setSelectedBooking(booking)}
                            className={`w-full px-1.5 py-0.5 rounded text-xs truncate text-left ${getBookingColor(booking)}`}
                          >
                            {formatTime(booking.startsAt)} {booking.client?.name?.split(' ')[0]}
                          </button>
                        ))}
                        {dayBookings.length > 2 && (
                          <div className="text-xs text-slate-500 px-1">+{dayBookings.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l border-slate-800 bg-slate-900/50 flex flex-col overflow-hidden">
        {/* Today's Summary */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3">Today&apos;s Sessions</h3>
          {todayBookings.length === 0 ? (
            <p className="text-slate-500 text-sm">No sessions scheduled for today</p>
          ) : (
            <div className="space-y-2">
              {todayBookings.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => setSelectedBooking(booking)}
                  className="w-full p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={booking.client?.name || 'Unknown'}
                      src={booking.client?.avatarUrl}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{booking.client?.name}</div>
                      <div className="text-sm text-slate-400">
                        {formatTime(booking.startsAt)} - {formatTime(booking.endsAt)}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      booking.bookingType === 'checkin'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {booking.bookingType === 'checkin' ? 'Check-in' : 'Session'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tomorrow's Preview */}
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3">Tomorrow</h3>
          {tomorrowBookings.length === 0 ? (
            <p className="text-slate-500 text-sm">No sessions scheduled</p>
          ) : (
            <div className="space-y-2">
              {tomorrowBookings.slice(0, 3).map((booking) => (
                <div key={booking.id} className="flex items-center gap-3 p-2">
                  <Avatar
                    name={booking.client?.name || 'Unknown'}
                    src={booking.client?.avatarUrl}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{booking.client?.name}</div>
                    <div className="text-xs text-slate-500">{formatTime(booking.startsAt)}</div>
                  </div>
                </div>
              ))}
              {tomorrowBookings.length > 3 && (
                <div className="text-sm text-slate-500 text-center">
                  +{tomorrowBookings.length - 3} more sessions
                </div>
              )}
            </div>
          )}
        </div>

        {/* Clients Needing Renewal */}
        <div className="p-4 flex-1 overflow-auto">
          <h3 className="text-lg font-semibold text-white mb-3">Renewal Alerts</h3>
          {packagesLoading ? (
            <div className="text-slate-500 text-sm">Loading...</div>
          ) : clientsNeedingRenewal.length === 0 ? (
            <p className="text-slate-500 text-sm">No clients need renewal attention</p>
          ) : (
            <div className="space-y-2">
              {clientsNeedingRenewal.map(({ package: pkg, reason }) => (
                <div
                  key={pkg.id}
                  className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={pkg.client?.name || 'Unknown'}
                      src={pkg.client?.avatarUrl}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{pkg.client?.name}</div>
                      <div className="text-xs text-amber-400">
                        {reason === 'low_sessions'
                          ? `${pkg.remainingSessions} sessions left`
                          : `Expires ${new Date(pkg.expiresAt!).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="p-4 border-t border-slate-800">
          <h4 className="text-sm font-medium text-slate-400 mb-2">Legend</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-blue-500/50"></span>
              <span className="text-slate-400">Session</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-purple-500/50"></span>
              <span className="text-slate-400">Check-in</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-500/50"></span>
              <span className="text-slate-400">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-500/50"></span>
              <span className="text-slate-400">Cancelled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Details Modal */}
      <Modal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title="Booking Details"
      >
        {selectedBooking && (
          <div className="space-y-4">
            {/* Client Info */}
            <div className="flex items-center gap-4">
              <Avatar
                name={selectedBooking.client?.name || 'Unknown'}
                src={selectedBooking.client?.avatarUrl}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedBooking.client?.name}</h3>
                <p className="text-slate-400">{selectedBooking.client?.email}</p>
              </div>
            </div>

            {/* Booking Info */}
            <div className="space-y-3 bg-slate-800/50 rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Type</span>
                <span className="text-white capitalize">
                  {selectedBooking.bookingType === 'checkin' ? 'Virtual Check-in' : 'Training Session'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date</span>
                <span className="text-white">{new Date(selectedBooking.startsAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Time</span>
                <span className="text-white">
                  {formatTime(selectedBooking.startsAt)} - {formatTime(selectedBooking.endsAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className={`px-2 py-0.5 rounded text-sm capitalize ${getStatusBadge(selectedBooking.status)}`}>
                  {selectedBooking.status.replace('_', ' ')}
                </span>
              </div>
              {selectedBooking.googleMeetLink && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Meet Link</span>
                  <a
                    href={selectedBooking.googleMeetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300"
                  >
                    Join Meeting
                  </a>
                </div>
              )}
            </div>

            {/* Actions */}
            {selectedBooking.status === 'confirmed' && (
              <div className="flex gap-3">
                <Button
                  onClick={() => handleMarkComplete(selectedBooking.id)}
                  className="flex-1"
                >
                  Mark Complete
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleMarkNoShow(selectedBooking.id)}
                  className="flex-1"
                >
                  No Show
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleCancelBooking(selectedBooking.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Book Session Modal */}
      <BookSessionModal
        isOpen={showBookSessionModal}
        onClose={() => setShowBookSessionModal(false)}
        clients={clientsWithPackages}
        onSuccess={() => {
          refetchPackages()
        }}
      />

      {/* Block Time Modal (placeholder) */}
      <Modal
        isOpen={showBlockTimeModal}
        onClose={() => setShowBlockTimeModal(false)}
        title="Block Time"
      >
        <div className="text-slate-400 text-center py-8">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          <p>Block time form coming soon</p>
          <p className="text-sm text-slate-500 mt-1">Block out times when you&apos;re unavailable</p>
        </div>
      </Modal>
    </div>
  )
}
