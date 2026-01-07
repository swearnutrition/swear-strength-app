// Booking system types

export type BookingType = 'session' | 'checkin'
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type AvailabilityType = 'session' | 'checkin'
export type CheckinQuestionType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio'

// Session Packages
export interface SessionPackage {
  id: string
  clientId: string
  coachId: string
  totalSessions: number
  remainingSessions: number
  sessionDurationMinutes: number
  expiresAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  // Joined fields
  client?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

export interface SessionPackageAdjustment {
  id: string
  packageId: string
  adjustment: number
  previousBalance: number
  newBalance: number
  reason: string | null
  adjustedBy: string
  createdAt: string
}

export interface CreateSessionPackagePayload {
  clientId: string
  totalSessions: number
  sessionDurationMinutes: number
  expiresAt?: string | null
  notes?: string
}

export interface AdjustSessionPackagePayload {
  packageId: string
  adjustment: number
  reason?: string
}

// Bookings
export interface Booking {
  id: string
  clientId: string | null // Null for one-off bookings
  coachId: string
  packageId: string | null
  bookingType: BookingType
  startsAt: string
  endsAt: string
  status: BookingStatus
  googleEventId: string | null
  googleMeetLink: string | null
  rescheduledFromId: string | null
  cancelledAt: string | null
  oneOffClientName: string | null // For one-off bookings without account
  createdAt: string
  updatedAt: string
  // Joined fields
  client?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  } | null
  package?: SessionPackage
  formResponse?: CheckinFormResponse
}

export interface CreateBookingPayload {
  clientId?: string | null // Null for one-off bookings
  bookingType: BookingType
  startsAt: string
  endsAt: string
  packageId?: string // Required for regular sessions (not one-off)
  // One-off booking fields
  oneOffClientName?: string
  isOneOff?: boolean
}

export interface RescheduleBookingPayload {
  bookingId: string
  newStartsAt: string
  newEndsAt: string
}

// Availability
export interface AvailabilityTemplate {
  id: string
  coachId: string
  availabilityType: AvailabilityType
  dayOfWeek: number // 0-6 (Sunday-Saturday)
  startTime: string // "09:00"
  endTime: string // "17:00"
  maxConcurrentClients: number
}

export interface AvailabilityOverride {
  id: string
  coachId: string
  availabilityType: AvailabilityType
  overrideDate: string // "2026-01-15"
  startTime: string | null // null = entire day
  endTime: string | null
  isBlocked: boolean
  maxConcurrentClients: number | null
}

export interface CreateAvailabilityTemplatePayload {
  availabilityType: AvailabilityType
  dayOfWeek: number
  startTime: string
  endTime: string
  maxConcurrentClients?: number
}

export interface CreateAvailabilityOverridePayload {
  availabilityType: AvailabilityType
  overrideDate: string
  startTime?: string
  endTime?: string
  isBlocked: boolean
  maxConcurrentClients?: number
}

// Available time slots (computed)
export interface AvailableSlot {
  startsAt: string
  endsAt: string
  availableCapacity: number
  isFavorite?: boolean
}

// Check-in Forms
export interface CheckinFormQuestion {
  id: string
  coachId: string
  question: string
  questionType: CheckinQuestionType
  options: string[] | null
  sortOrder: number
  isRequired: boolean
  isActive: boolean
  createdAt: string
}

export interface CheckinFormResponse {
  id: string
  bookingId: string
  clientId: string
  responses: Record<string, string | string[]> // questionId -> answer
  submittedAt: string
}

export interface CreateCheckinQuestionPayload {
  question: string
  questionType: CheckinQuestionType
  options?: string[]
  isRequired?: boolean
}

export interface SubmitCheckinFormPayload {
  bookingId: string
  responses: Record<string, string | string[]>
}

// Client Stats
export interface ClientBookingStats {
  id: string
  clientId: string
  coachId: string
  currentStreakWeeks: number
  longestStreakWeeks: number
  noShowCount90d: number
  cancellationCount90d: number
  isFlagged: boolean
  favoriteTimes: Array<{ day: number; time: string }>
  lastStreakUpdate: string | null
}

export interface ClientCheckinUsage {
  id: string
  clientId: string
  coachId: string
  month: string // "2026-01-01"
  used: boolean
  bookingId: string | null
}

// Booking Settings
export interface CoachBookingSettings {
  id: string
  coachId: string
  bookingWindowDays: number
  minNoticeHours: number
  renewalReminderThreshold: number
  sessionSlotIntervalMinutes: number
  checkinDurationMinutes: number
}

// Google Calendar
export interface GoogleCalendarCredentials {
  id: string
  coachId: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
  calendarId: string | null
}

// Dashboard views
export interface BookingWithDetails extends Booking {
  client: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  formResponse?: CheckinFormResponse
}

export interface ClientBookingSummary {
  client: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  activePackage: SessionPackage | null
  upcomingBookings: Booking[]
  stats: ClientBookingStats | null
  checkinUsage: ClientCheckinUsage | null
}

export interface DailySummary {
  date: string
  bookings: BookingWithDetails[]
  clientsNeedingRenewal: Array<{
    client: { id: string; name: string }
    package: SessionPackage
    reason: 'low_sessions' | 'expiring_soon'
  }>
}
