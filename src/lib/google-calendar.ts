// Google Calendar service for booking integration
// Uses Google Calendar API v3 with fetch

import { createAdminClient } from './supabase/server'
import type { Booking } from '@/types/booking'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope?: string
  refresh_token?: string
}

interface GoogleCalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone?: string
  }
  end: {
    dateTime: string
    timeZone?: string
  }
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: string
  }>
  conferenceData?: {
    createRequest?: {
      requestId: string
      conferenceSolutionKey: {
        type: string
      }
    }
    entryPoints?: Array<{
      entryPointType: string
      uri: string
    }>
  }
}

interface GoogleCalendarCredentials {
  id: string
  coach_id: string
  access_token: string
  refresh_token: string
  token_expiry: string
  calendar_id: string | null
}

/**
 * Get a valid access token for a coach, refreshing if expired
 */
export async function getValidAccessToken(coachId: string): Promise<string> {
  const supabase = createAdminClient()

  // Get current credentials
  const { data: credentials, error } = await supabase
    .from('google_calendar_credentials')
    .select('*')
    .eq('coach_id', coachId)
    .single()

  if (error || !credentials) {
    throw new Error('Google Calendar not connected. Please connect your calendar in settings.')
  }

  const creds = credentials as GoogleCalendarCredentials
  const now = new Date()
  const expiry = new Date(creds.token_expiry)

  // If token is still valid (with 5 minute buffer), return it
  if (expiry.getTime() - now.getTime() > 5 * 60 * 1000) {
    return creds.access_token
  }

  // Token is expired or about to expire, refresh it
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured')
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Token refresh failed:', errorData)
    throw new Error('Failed to refresh Google access token. Please reconnect your calendar.')
  }

  const tokenData: GoogleTokenResponse = await response.json()

  // Calculate new expiry time
  const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

  // Update stored credentials
  const { error: updateError } = await supabase
    .from('google_calendar_credentials')
    .update({
      access_token: tokenData.access_token,
      token_expiry: newExpiry,
      // Update refresh token if a new one was provided
      ...(tokenData.refresh_token && { refresh_token: tokenData.refresh_token }),
    })
    .eq('coach_id', coachId)

  if (updateError) {
    console.error('Failed to update token in database:', updateError)
    // Still return the new token even if storage failed
  }

  return tokenData.access_token
}

/**
 * Get the calendar ID for a coach (or use primary)
 */
async function getCalendarId(coachId: string): Promise<string> {
  const supabase = createAdminClient()

  const { data: credentials } = await supabase
    .from('google_calendar_credentials')
    .select('calendar_id')
    .eq('coach_id', coachId)
    .single()

  return credentials?.calendar_id || 'primary'
}

/**
 * Create a calendar event for a booking
 */
export async function createCalendarEvent(
  coachId: string,
  booking: Booking,
  clientEmail: string,
  clientName: string
): Promise<{ eventId: string; meetLink: string | null }> {
  const accessToken = await getValidAccessToken(coachId)
  const calendarId = await getCalendarId(coachId)

  const isCheckin = booking.bookingType === 'checkin'
  const summary = isCheckin
    ? `Check-in with ${clientName}`
    : `Session with ${clientName}`

  const event: GoogleCalendarEvent = {
    summary,
    description: isCheckin
      ? 'Monthly check-in call'
      : 'Training session',
    start: {
      dateTime: booking.startsAt,
    },
    end: {
      dateTime: booking.endsAt,
    },
    attendees: [
      {
        email: clientEmail,
        displayName: clientName,
      },
    ],
  }

  // Add Google Meet for check-ins
  if (isCheckin) {
    event.conferenceData = {
      createRequest: {
        requestId: `booking-${booking.id}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    }
  }

  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('sendUpdates', 'all') // Send email invites to attendees
  if (isCheckin) {
    url.searchParams.set('conferenceDataVersion', '1') // Required for creating Meet links
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Failed to create calendar event:', errorData)
    throw new Error('Failed to create calendar event')
  }

  const createdEvent = await response.json()

  // Extract Meet link if created
  let meetLink: string | null = null
  if (createdEvent.conferenceData?.entryPoints) {
    const videoEntry = createdEvent.conferenceData.entryPoints.find(
      (entry: { entryPointType: string; uri: string }) => entry.entryPointType === 'video'
    )
    meetLink = videoEntry?.uri || null
  }

  return {
    eventId: createdEvent.id,
    meetLink,
  }
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  coachId: string,
  eventId: string,
  booking: Booking,
  clientName?: string
): Promise<void> {
  const accessToken = await getValidAccessToken(coachId)
  const calendarId = await getCalendarId(coachId)

  const isCheckin = booking.bookingType === 'checkin'

  // Build the update payload - only include fields we want to update
  const updatePayload: Partial<GoogleCalendarEvent> = {
    start: {
      dateTime: booking.startsAt,
    },
    end: {
      dateTime: booking.endsAt,
    },
  }

  // Update summary if client name is provided
  if (clientName) {
    updatePayload.summary = isCheckin
      ? `Check-in with ${clientName}`
      : `Session with ${clientName}`
  }

  const url = new URL(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  )
  url.searchParams.set('sendUpdates', 'all') // Notify attendees of changes

  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatePayload),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Failed to update calendar event:', errorData)
    throw new Error('Failed to update calendar event')
  }
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  coachId: string,
  eventId: string
): Promise<void> {
  const accessToken = await getValidAccessToken(coachId)
  const calendarId = await getCalendarId(coachId)

  const url = new URL(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  )
  url.searchParams.set('sendUpdates', 'all') // Notify attendees of cancellation

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  // 404 is acceptable - event may have already been deleted
  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Failed to delete calendar event:', errorData)
    throw new Error('Failed to delete calendar event')
  }
}

/**
 * Create a Google Meet link for a check-in booking
 * This is useful when you need to add a Meet link to an existing booking
 * or create one separately from the calendar event
 */
export async function createMeetLink(
  coachId: string,
  booking: Booking,
  clientName: string
): Promise<string> {
  const accessToken = await getValidAccessToken(coachId)
  const calendarId = await getCalendarId(coachId)

  // If there's already a Google event, update it to add conference data
  if (booking.googleEventId) {
    const url = new URL(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(booking.googleEventId)}`
    )
    url.searchParams.set('conferenceDataVersion', '1')
    url.searchParams.set('sendUpdates', 'all')

    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conferenceData: {
          createRequest: {
            requestId: `meet-${booking.id}-${Date.now()}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Failed to add Meet link:', errorData)
      throw new Error('Failed to create Google Meet link')
    }

    const updatedEvent = await response.json()

    const videoEntry = updatedEvent.conferenceData?.entryPoints?.find(
      (entry: { entryPointType: string; uri: string }) => entry.entryPointType === 'video'
    )

    if (!videoEntry?.uri) {
      throw new Error('Google Meet link was not created')
    }

    return videoEntry.uri
  }

  // No existing event - create a new event with Meet
  const event: GoogleCalendarEvent = {
    summary: `Check-in with ${clientName}`,
    description: 'Monthly check-in call',
    start: {
      dateTime: booking.startsAt,
    },
    end: {
      dateTime: booking.endsAt,
    },
    conferenceData: {
      createRequest: {
        requestId: `meet-${booking.id}-${Date.now()}`,
        conferenceSolutionKey: {
          type: 'hangoutsMeet',
        },
      },
    },
  }

  const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`)
  url.searchParams.set('conferenceDataVersion', '1')

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    console.error('Failed to create event with Meet:', errorData)
    throw new Error('Failed to create Google Meet link')
  }

  const createdEvent = await response.json()

  const videoEntry = createdEvent.conferenceData?.entryPoints?.find(
    (entry: { entryPointType: string; uri: string }) => entry.entryPointType === 'video'
  )

  if (!videoEntry?.uri) {
    throw new Error('Google Meet link was not created')
  }

  // Update booking with the new event ID (caller should handle this)
  // We return only the Meet link here

  return videoEntry.uri
}
