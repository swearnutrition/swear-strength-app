'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useBookings } from '@/hooks/useBookings'
import { useSessionPackages } from '@/hooks/useSessionPackages'
import { useAvailability } from '@/hooks/useAvailability'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { BookSessionModal } from '@/components/booking/BookSessionModal'
import { createClient } from '@/lib/supabase/client'
import type { BookingWithDetails, BookingStatus, SessionPackage, ClientCheckinUsage, Booking, AvailableSlot } from '@/types/booking'

// Helper to get the display name for a booking (supports one-off bookings)
function getBookingClientName(booking: Booking | BookingWithDetails): string {
  // 1. First try booking.client?.name
  if (booking.client?.name) {
    return booking.client.name
  }
  // 2. Then try booking.oneOffClientName
  if ('oneOffClientName' in booking && booking.oneOffClientName) {
    return booking.oneOffClientName
  }
  // Check snake_case version from raw API response
  const rawBooking = booking as unknown as Record<string, unknown>
  if (rawBooking.one_off_client_name) {
    return rawBooking.one_off_client_name as string
  }
  // 3. Finally fallback to 'Unknown'
  return 'Unknown'
}

// Helper to check if a booking is one-off (no client account)
function isOneOffBooking(booking: Booking | BookingWithDetails): boolean {
  const rawBooking = booking as unknown as Record<string, unknown>
  const hasOneOffName = ('oneOffClientName' in booking && booking.oneOffClientName) || rawBooking.one_off_client_name
  const hasClient = booking.client
  return !!hasOneOffName && !hasClient
}

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

interface SelectableClient {
  id: string // For pending clients, this is prefixed with "pending:"
  name: string
  email: string
  avatarUrl: string | null
  activePackage: SessionPackage | null
  checkinUsage: ClientCheckinUsage | null
  isPending: boolean
}

interface PendingClient {
  id: string
  name: string
  email: string
  clientType: 'online' | 'training' | 'hybrid'
}

interface CoachBookingsClientProps {
  userId: string
  clients: Client[]
  pendingClients: PendingClient[]
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

// Extended slot with date info for multi-select
interface SlotWithDate extends AvailableSlot {
  date: string // ISO date string
}

export function CoachBookingsClient({ userId, clients, pendingClients }: CoachBookingsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showBookSessionModal, setShowBookSessionModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [clientsWithPackages, setClientsWithPackages] = useState<ClientWithPackage[]>([])
  const [preselectedDate, setPreselectedDate] = useState<string | undefined>(undefined)
  const [preselectedSlot, setPreselectedSlot] = useState<AvailableSlot | undefined>(undefined)
  const [slotsByDate, setSlotsByDate] = useState<Map<string, AvailableSlot[]>>(new Map())

  // Multi-select booking mode
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [multiSelectClientId, setMultiSelectClientId] = useState<string>('')
  const [selectedSlots, setSelectedSlots] = useState<SlotWithDate[]>([])
  const [isBookingMultiple, setIsBookingMultiple] = useState(false)

  // Drag-and-drop reschedule state
  const [draggedBooking, setDraggedBooking] = useState<BookingWithDetails | null>(null)
  const [bookingToReschedule, setBookingToReschedule] = useState<BookingWithDetails | null>(null) // Separate from draggedBooking to persist through dragEnd
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<{ slot: AvailableSlot; date: Date } | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)

  // Mass delete select mode state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const { bookings, loading: bookingsLoading, cancelBooking, deleteBooking, updateStatus, createMultipleBookings, autoCompletePastSessions, rescheduleBooking } = useBookings({
    from: dateRange.from,
    to: dateRange.to,
  })

  // Auto-complete past sessions on initial load
  const [hasAutoCompleted, setHasAutoCompleted] = useState(false)
  useEffect(() => {
    if (!bookingsLoading && !hasAutoCompleted) {
      autoCompletePastSessions().then((count) => {
        if (count > 0) {
          console.log(`Auto-completed ${count} past session(s)`)
        }
      })
      setHasAutoCompleted(true)
    }
  }, [bookingsLoading, hasAutoCompleted, autoCompletePastSessions])

  const { packages, loading: packagesLoading, refetch: refetchPackages } = useSessionPackages()

  const { getAvailableSlots } = useAvailability({ type: 'session' })

  // Fetch clients with their packages and check-in usage
  useEffect(() => {
    async function fetchClientsWithPackages() {
      const supabase = createClient()
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
            .maybeSingle()

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
  }, [clients, packages, packagesLoading])

  // Combine regular clients and pending clients for Quick Book dropdown
  const allSelectableClients: SelectableClient[] = useMemo(() => {
    const regularClients: SelectableClient[] = clientsWithPackages.map((c) => ({
      ...c,
      isPending: false,
    }))
    const pending: SelectableClient[] = pendingClients.map((pc) => ({
      id: `pending:${pc.id}`,
      name: pc.name,
      email: pc.email,
      avatarUrl: null,
      activePackage: null,
      checkinUsage: null,
      isPending: true,
    }))
    return [...regularClients, ...pending].sort((a, b) => a.name.localeCompare(b.name))
  }, [clientsWithPackages, pendingClients])

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

  // Fetch availability slots for week view
  useEffect(() => {
    if (viewMode !== 'week') return

    const fetchWeekSlots = async () => {
      const newSlotsByDate = new Map<string, AvailableSlot[]>()

      // Fetch slots for each day in the week
      await Promise.all(
        weekDays.map(async (day) => {
          const dateStr = day.toISOString().split('T')[0]
          // Only fetch for today and future dates
          const todayDate = new Date()
          todayDate.setHours(0, 0, 0, 0)
          if (day >= todayDate) {
            const slots = await getAvailableSlots(dateStr, 60)
            newSlotsByDate.set(day.toDateString(), slots)
          }
        })
      )

      setSlotsByDate(newSlotsByDate)
    }

    fetchWeekSlots()
  }, [viewMode, weekDays, getAvailableSlots])

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

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to permanently delete this booking? This action cannot be undone.')) return
    await deleteBooking(bookingId)
    setSelectedBooking(null)
  }

  // Get selected client for multi-select mode (supports both regular and pending clients)
  const multiSelectClient = useMemo(
    () => allSelectableClients.find((c) => c.id === multiSelectClientId),
    [allSelectableClients, multiSelectClientId]
  )

  const handleSlotClick = (day: Date, slot: AvailableSlot) => {
    if (isMultiSelectMode) {
      // In multi-select mode, toggle slot selection
      const dateStr = day.toISOString().split('T')[0]
      const slotWithDate: SlotWithDate = { ...slot, date: dateStr }

      setSelectedSlots((prev) => {
        const exists = prev.some((s) => s.startsAt === slot.startsAt)
        if (exists) {
          return prev.filter((s) => s.startsAt !== slot.startsAt)
        }
        return [...prev, slotWithDate]
      })
    } else {
      // Normal mode - open modal
      const dateStr = day.toISOString().split('T')[0]
      setPreselectedDate(dateStr)
      setPreselectedSlot(slot)
      setShowBookSessionModal(true)
    }
  }

  const handleOpenBookModal = () => {
    setPreselectedDate(undefined)
    setPreselectedSlot(undefined)
    setShowBookSessionModal(true)
  }

  const handleEnterMultiSelectMode = () => {
    setIsMultiSelectMode(true)
    setSelectedSlots([])
    setMultiSelectClientId('')
  }

  const handleExitMultiSelectMode = () => {
    setIsMultiSelectMode(false)
    setSelectedSlots([])
    setMultiSelectClientId('')
  }

  const handleBookSelectedSlots = async () => {
    if (!multiSelectClientId || selectedSlots.length === 0) return

    const client = allSelectableClients.find((c) => c.id === multiSelectClientId)
    if (!client) return

    // Check if client has enough sessions (only for regular clients with packages)
    if (client.activePackage && selectedSlots.length > client.activePackage.remainingSessions) {
      alert(`Not enough sessions remaining. Client has ${client.activePackage.remainingSessions} sessions left.`)
      return
    }

    setIsBookingMultiple(true)
    try {
      // Determine if this is a pending client (id starts with "pending:")
      const isPending = client.isPending
      const actualId = isPending ? multiSelectClientId.replace('pending:', '') : multiSelectClientId

      const payloads = selectedSlots.map((slot) => ({
        ...(isPending ? { inviteId: actualId } : { clientId: actualId }),
        bookingType: 'session' as const,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        packageId: client.activePackage?.id,
      }))

      const results = await createMultipleBookings(payloads)

      if (results.length > 0) {
        refetchPackages()
        handleExitMultiSelectMode()
      }
    } finally {
      setIsBookingMultiple(false)
    }
  }

  const removeSelectedSlot = (slot: SlotWithDate) => {
    setSelectedSlots((prev) => prev.filter((s) => s.startsAt !== slot.startsAt))
  }

  // Mass delete select mode handlers
  const handleEnterSelectMode = () => {
    setIsSelectMode(true)
    setSelectedBookingIds(new Set())
  }

  const handleExitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedBookingIds(new Set())
  }

  const toggleBookingSelection = (bookingId: string) => {
    setSelectedBookingIds((prev) => {
      const next = new Set(prev)
      if (next.has(bookingId)) {
        next.delete(bookingId)
      } else {
        next.add(bookingId)
      }
      return next
    })
  }

  // Get selectable bookings (exclude completed)
  const selectableBookings = useMemo(
    () => bookings.filter((b) => b.status !== 'completed'),
    [bookings]
  )

  const handleSelectAllVisible = () => {
    const allIds = new Set(selectableBookings.map((b) => b.id))
    setSelectedBookingIds(allIds)
  }

  const handleClearSelection = () => {
    setSelectedBookingIds(new Set())
  }

  // Calculate refund info for selected bookings
  const selectedBookingsRefundInfo = useMemo(() => {
    const selected = bookings.filter((b) => selectedBookingIds.has(b.id))
    const sessionsToRefund = selected.filter(
      (b) => b.status === 'confirmed' && b.bookingType === 'session' && b.packageId
    ).length
    return {
      count: selected.length,
      sessionsToRefund,
    }
  }, [bookings, selectedBookingIds])

  const handleDeleteSelected = async () => {
    if (selectedBookingIds.size === 0) return

    setIsDeleting(true)
    try {
      // Delete bookings one by one (each handles its own refund logic)
      const ids = Array.from(selectedBookingIds)
      for (const id of ids) {
        await deleteBooking(id)
      }
      refetchPackages()
      handleExitSelectMode()
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, booking: BookingWithDetails) => {
    // Only allow dragging confirmed bookings
    if (booking.status !== 'confirmed') {
      e.preventDefault()
      return
    }
    setDraggedBooking(booking)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', booking.id)
  }

  const handleDragEnd = () => {
    // Always clear draggedBooking - bookingToReschedule is used for the modal
    setDraggedBooking(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (draggedBooking) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDropOnSlot = (e: React.DragEvent, slot: AvailableSlot, day: Date) => {
    e.preventDefault()
    if (!draggedBooking) return

    // Don't allow drop on the same slot
    const draggedStart = new Date(draggedBooking.startsAt)
    const targetStart = new Date(slot.startsAt)
    if (draggedStart.getTime() === targetStart.getTime()) {
      return
    }

    // Store booking for modal (separate from draggedBooking which gets cleared by dragEnd)
    setBookingToReschedule(draggedBooking)
    setRescheduleTarget({ slot, date: day })
    setShowRescheduleConfirm(true)
  }

  const handleConfirmReschedule = async () => {
    if (!bookingToReschedule || !rescheduleTarget) return

    setIsRescheduling(true)
    try {
      // Calculate duration from original booking
      const originalStart = new Date(bookingToReschedule.startsAt)
      const originalEnd = new Date(bookingToReschedule.endsAt)
      const durationMs = originalEnd.getTime() - originalStart.getTime()

      // Calculate new end time
      const newStart = new Date(rescheduleTarget.slot.startsAt)
      const newEnd = new Date(newStart.getTime() + durationMs)

      await rescheduleBooking({
        bookingId: bookingToReschedule.id,
        newStartsAt: newStart.toISOString(),
        newEndsAt: newEnd.toISOString(),
      })

      setShowRescheduleConfirm(false)
      setRescheduleTarget(null)
      setBookingToReschedule(null)
    } finally {
      setIsRescheduling(false)
    }
  }

  const handleCancelReschedule = () => {
    setShowRescheduleConfirm(false)
    setRescheduleTarget(null)
    setBookingToReschedule(null)
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
              {!isMultiSelectMode && !isSelectMode ? (
                <>
                  <button
                    onClick={handleEnterSelectMode}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Select
                  </button>
                  <button
                    onClick={handleEnterMultiSelectMode}
                    className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Quick Book
                  </button>
                  <button
                    onClick={handleOpenBookModal}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Book Session
                  </button>
                </>
              ) : isMultiSelectMode ? (
                <button
                  onClick={handleExitMultiSelectMode}
                  className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400">
                    {selectedBookingIds.size} selected
                  </span>
                  {selectedBookingIds.size > 0 && (
                    <button
                      onClick={handleClearSelection}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleSelectAllVisible}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={selectedBookingIds.size === 0}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                  <button
                    onClick={handleExitSelectMode}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Multi-Select Mode Bar */}
          {isMultiSelectMode && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-green-400 mb-1">
                    Select a client to book sessions for:
                  </label>
                  <select
                    value={multiSelectClientId}
                    onChange={(e) => setMultiSelectClientId(e.target.value)}
                    className="w-full max-w-md px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select a client...</option>
                    {allSelectableClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} {client.isPending ? '(pending)' : client.activePackage ? `(${client.activePackage.remainingSessions} sessions)` : '(no package)'}
                      </option>
                    ))}
                  </select>
                </div>
                {multiSelectClient && (
                  <div className="text-sm text-slate-400">
                    {multiSelectClient.isPending ? (
                      <span className="text-purple-400">Pending client - will book without deducting</span>
                    ) : multiSelectClient.activePackage ? (
                      <span>
                        <span className="text-green-400 font-medium">{multiSelectClient.activePackage.remainingSessions}</span> sessions available
                      </span>
                    ) : (
                      <span className="text-amber-400">No package - will book without deducting</span>
                    )}
                  </div>
                )}
              </div>
              {multiSelectClientId && (
                <p className="text-xs text-slate-500 mt-2">
                  Click on available time slots below to select them. Selected slots will be highlighted in green.
                </p>
              )}
            </div>
          )}

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
                  const daySlots = slotsByDate.get(day.toDateString()) || []
                  const isToday = isSameDay(day, new Date())
                  const isPast = day < new Date(new Date().setHours(0, 0, 0, 0))

                  // Keep all slots available - coaches can book multiple clients at the same time
                  const availableSlots = daySlots

                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2 border-r border-slate-800 last:border-r-0 ${
                        isToday ? 'bg-purple-500/5' : ''
                      }`}
                    >
                      <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                        {/* Booked sessions */}
                        {dayBookings
                          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                          .map((booking) => {
                            const isSelected = selectedBookingIds.has(booking.id)
                            return (
                              <button
                                key={booking.id}
                                onClick={() => {
                                  if (isSelectMode) {
                                    if (booking.status !== 'completed') {
                                      toggleBookingSelection(booking.id)
                                    }
                                  } else {
                                    setSelectedBooking(booking)
                                  }
                                }}
                                draggable={!isSelectMode && booking.status === 'confirmed'}
                                onDragStart={(e) => handleDragStart(e, booking)}
                                onDragEnd={handleDragEnd}
                                className={`w-full p-2 rounded-lg border text-left transition-all hover:scale-[1.02] ${getBookingColor(booking)} ${
                                  !isSelectMode && booking.status === 'confirmed' ? 'cursor-grab active:cursor-grabbing' : ''
                                } ${draggedBooking?.id === booking.id ? 'opacity-50 ring-2 ring-purple-500' : ''} ${
                                  isSelected ? 'ring-2 ring-red-500' : ''
                                } ${isSelectMode && booking.status === 'completed' ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <div className="flex items-start gap-2">
                                  {isSelectMode && (
                                    <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                                      booking.status === 'completed'
                                        ? 'border-slate-600 bg-slate-700'
                                        : isSelected
                                          ? 'border-red-500 bg-red-500'
                                          : 'border-slate-500'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium">{formatTime(booking.startsAt)}</div>
                                    <div className="text-sm font-semibold truncate">
                                      {getBookingClientName(booking)}
                                      {isOneOffBooking(booking) && <span className="text-amber-400 ml-1">(one-off)</span>}
                                    </div>
                                    <div className="text-xs opacity-75 capitalize flex items-center gap-1">
                                      {booking.bookingType === 'checkin' ? 'Check-in' : 'Session'}
                                      {!isSelectMode && booking.status === 'confirmed' && (
                                        <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}

                        {/* Available slots (only for today and future dates) */}
                        {!isPast && availableSlots.length > 0 && (
                          <>
                            {dayBookings.length > 0 && (
                              <div className="border-t border-slate-700/50 my-2" />
                            )}
                            {availableSlots.map((slot) => {
                              const isSelected = selectedSlots.some((s) => s.startsAt === slot.startsAt)
                              const canSelect = isMultiSelectMode && multiSelectClientId
                              const isDragTarget = draggedBooking !== null

                              return (
                                <button
                                  key={slot.startsAt}
                                  onClick={() => !isDragTarget && handleSlotClick(day, slot)}
                                  onDragOver={handleDragOver}
                                  onDrop={(e) => handleDropOnSlot(e, slot, day)}
                                  disabled={isMultiSelectMode && !multiSelectClientId && !isDragTarget}
                                  className={`w-full p-2 rounded-lg border text-left transition-all group ${
                                    isSelected
                                      ? 'border-green-500 bg-green-500/20 text-green-300'
                                      : isDragTarget
                                        ? 'border-dashed border-purple-500 bg-purple-500/10 hover:bg-purple-500/20'
                                        : isMultiSelectMode && !multiSelectClientId
                                          ? 'border-dashed border-slate-700 text-slate-700 cursor-not-allowed'
                                          : 'border-dashed border-slate-600 hover:border-green-500/50 hover:bg-green-500/10'
                                  }`}
                                >
                                  <div className={`text-xs font-medium ${
                                    isSelected
                                      ? 'text-green-300'
                                      : isDragTarget
                                        ? 'text-purple-400'
                                        : canSelect
                                          ? 'text-slate-500 group-hover:text-green-400'
                                          : 'text-slate-500'
                                  }`}>
                                    {formatTime(slot.startsAt)}
                                  </div>
                                  <div className={`text-xs ${
                                    isSelected
                                      ? 'text-green-400'
                                      : isDragTarget
                                        ? 'text-purple-300'
                                        : canSelect
                                          ? 'text-slate-600 group-hover:text-green-400/80'
                                          : 'text-slate-600'
                                  }`}>
                                    {isSelected ? 'Selected' : isDragTarget ? 'Drop here' : 'Available'}
                                  </div>
                                </button>
                              )
                            })}
                          </>
                        )}

                        {/* Empty state */}
                        {dayBookings.length === 0 && availableSlots.length === 0 && !isPast && (
                          <div className="text-center text-slate-600 text-sm py-8">No slots</div>
                        )}
                        {isPast && dayBookings.length === 0 && (
                          <div className="text-center text-slate-700 text-sm py-8">-</div>
                        )}
                      </div>
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
                        {dayBookings.slice(0, 2).map((booking) => {
                          const isSelected = selectedBookingIds.has(booking.id)
                          return (
                            <button
                              key={booking.id}
                              onClick={() => {
                                if (isSelectMode) {
                                  if (booking.status !== 'completed') {
                                    toggleBookingSelection(booking.id)
                                  }
                                } else {
                                  setSelectedBooking(booking)
                                }
                              }}
                              className={`w-full px-1.5 py-0.5 rounded text-xs truncate text-left flex items-center gap-1 ${getBookingColor(booking)} ${
                                isSelected ? 'ring-2 ring-red-500' : ''
                              } ${isSelectMode && booking.status === 'completed' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {isSelectMode && (
                                <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${
                                  booking.status === 'completed'
                                    ? 'border-slate-600 bg-slate-700'
                                    : isSelected
                                      ? 'border-red-500 bg-red-500'
                                      : 'border-slate-500'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              )}
                              <span className="truncate">{formatTime(booking.startsAt)} {getBookingClientName(booking).split(' ')[0]}</span>
                            </button>
                          )
                        })}
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

          {/* Multi-Select Floating Footer */}
          {isMultiSelectMode && selectedSlots.length > 0 && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-green-400 mb-2">
                    {selectedSlots.length} slot{selectedSlots.length !== 1 ? 's' : ''} selected for {multiSelectClient?.name}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSlots
                      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
                      .map((slot) => (
                        <span
                          key={slot.startsAt}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-300 rounded-md text-sm"
                        >
                          {new Date(slot.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {formatTime(slot.startsAt)}
                          <button
                            type="button"
                            onClick={() => removeSelectedSlot(slot)}
                            className="hover:text-green-100 ml-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                  </div>
                  {multiSelectClient?.activePackage && (
                    <p className="text-xs text-slate-500 mt-2">
                      After booking: {multiSelectClient.activePackage.remainingSessions - selectedSlots.length} sessions remaining
                    </p>
                  )}
                </div>
                <button
                  onClick={handleBookSelectedSlots}
                  disabled={isBookingMultiple}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-medium py-2.5 px-5 rounded-xl transition-all"
                >
                  {isBookingMultiple ? (
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
                      Book {selectedSlots.length} Session{selectedSlots.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
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
                      name={getBookingClientName(booking)}
                      src={booking.client?.avatarUrl}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">
                        {getBookingClientName(booking)}
                        {isOneOffBooking(booking) && <span className="text-amber-400 text-xs ml-1">(one-off)</span>}
                      </div>
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
                    name={getBookingClientName(booking)}
                    src={booking.client?.avatarUrl}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {getBookingClientName(booking)}
                      {isOneOffBooking(booking) && <span className="text-amber-400 text-xs ml-1">(one-off)</span>}
                    </div>
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
            <div className="flex items-center gap-2 col-span-2 pt-1 border-t border-slate-700/50 mt-1">
              <span className="w-3 h-3 rounded border border-dashed border-slate-500"></span>
              <span className="text-slate-400">Available (click to book)</span>
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
                name={getBookingClientName(selectedBooking)}
                src={selectedBooking.client?.avatarUrl}
                size="lg"
              />
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {getBookingClientName(selectedBooking)}
                  {isOneOffBooking(selectedBooking) && (
                    <span className="ml-2 text-sm font-normal text-amber-400">(one-off)</span>
                  )}
                </h3>
                <p className="text-slate-400">
                  {selectedBooking.client?.email || 'No account - one-off booking'}
                </p>
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

            {/* Delete button - always available */}
            <div className="pt-4 border-t border-slate-700">
              <Button
                variant="secondary"
                onClick={() => handleDeleteBooking(selectedBooking.id)}
                className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Booking
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Book Session Modal */}
      <BookSessionModal
        isOpen={showBookSessionModal}
        onClose={() => {
          setShowBookSessionModal(false)
          setPreselectedDate(undefined)
          setPreselectedSlot(undefined)
        }}
        clients={clientsWithPackages}
        pendingClients={pendingClients}
        preselectedDate={preselectedDate}
        onSuccess={() => {
          refetchPackages()
        }}
      />

      {/* Reschedule Confirmation Modal */}
      <Modal
        isOpen={showRescheduleConfirm}
        onClose={handleCancelReschedule}
        title="Reschedule Session"
      >
        {bookingToReschedule && rescheduleTarget && (
          <div className="space-y-6">
            <p className="text-slate-300">
              Are you sure you want to reschedule this session?
            </p>

            {/* Client info */}
            <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg p-3">
              <Avatar
                src={bookingToReschedule.client?.avatarUrl}
                name={getBookingClientName(bookingToReschedule)}
                size="sm"
              />
              <div>
                <p className="font-medium text-white">{getBookingClientName(bookingToReschedule)}</p>
                <p className="text-sm text-slate-400 capitalize">{bookingToReschedule.bookingType}</p>
              </div>
            </div>

            {/* Time comparison */}
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="text-xs text-red-400 uppercase font-medium mb-1">From</div>
                <div className="text-white font-medium">
                  {new Date(bookingToReschedule.startsAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="text-slate-300">
                  {formatTime(bookingToReschedule.startsAt)} - {formatTime(bookingToReschedule.endsAt)}
                </div>
              </div>

              <div className="flex justify-center">
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="text-xs text-green-400 uppercase font-medium mb-1">To</div>
                <div className="text-white font-medium">
                  {rescheduleTarget.date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="text-slate-300">
                  {formatTime(rescheduleTarget.slot.startsAt)} - {(() => {
                    const originalStart = new Date(bookingToReschedule.startsAt)
                    const originalEnd = new Date(bookingToReschedule.endsAt)
                    const durationMs = originalEnd.getTime() - originalStart.getTime()
                    const newEnd = new Date(new Date(rescheduleTarget.slot.startsAt).getTime() + durationMs)
                    return newEnd.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                  })()}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleCancelReschedule}
                className="flex-1"
                disabled={isRescheduling}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReschedule}
                className="flex-1"
                disabled={isRescheduling}
              >
                {isRescheduling ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Rescheduling...
                  </>
                ) : (
                  'Confirm Reschedule'
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Mass Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Bookings"
      >
        <div className="space-y-4">
          <p className="text-slate-300">
            Delete {selectedBookingsRefundInfo.count} booking{selectedBookingsRefundInfo.count !== 1 ? 's' : ''}?
          </p>

          {selectedBookingsRefundInfo.sessionsToRefund > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-amber-400 text-sm">
                {selectedBookingsRefundInfo.sessionsToRefund} session{selectedBookingsRefundInfo.sessionsToRefund !== 1 ? 's' : ''} will be refunded to client packages.
              </p>
            </div>
          )}

          <p className="text-slate-400 text-sm">
            This cannot be undone.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteSelected}
              className="flex-1 bg-red-600 hover:bg-red-500"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
