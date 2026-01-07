import { createClient } from '@/lib/supabase/server'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

interface GoogleCalendarCredentials {
  access_token: string
  refresh_token: string
  token_expiry: string
}

interface CalendarEventParams {
  summary: string
  description?: string
  startTime: string // ISO string
  endTime: string // ISO string
  attendeeEmail?: string
  attendeeName?: string
}

interface CalendarEvent {
  id: string
  htmlLink: string
  hangoutLink?: string
}

/**
 * Get valid Google Calendar credentials for a coach
 * Refreshes the token if expired
 */
export async function getGoogleCredentials(
  coachId: string
): Promise<GoogleCalendarCredentials | null> {
  const supabase = await createClient()

  const { data: creds, error } = await supabase
    .from('google_calendar_credentials')
    .select('access_token, refresh_token, token_expiry')
    .eq('coach_id', coachId)
    .single()

  if (error || !creds) {
    console.log('No Google Calendar credentials found for coach:', coachId)
    return null
  }

  // Check if token is expired (with 5 minute buffer)
  const expiry = new Date(creds.token_expiry)
  const now = new Date()
  const bufferMs = 5 * 60 * 1000 // 5 minutes

  if (expiry.getTime() - bufferMs <= now.getTime()) {
    // Token is expired or about to expire, refresh it
    console.log('Refreshing Google Calendar token for coach:', coachId)
    const newCreds = await refreshAccessToken(coachId, creds.refresh_token)
    if (!newCreds) {
      return null
    }
    return newCreds
  }

  return creds as GoogleCalendarCredentials
}

/**
 * Refresh the Google access token
 */
async function refreshAccessToken(
  coachId: string,
  refreshToken: string
): Promise<GoogleCalendarCredentials | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('Failed to refresh Google token:', await response.text())
      return null
    }

    const data = await response.json()
    const tokenExpiry = new Date(Date.now() + data.expires_in * 1000)

    // Update database with new token
    const supabase = await createClient()
    await supabase
      .from('google_calendar_credentials')
      .update({
        access_token: data.access_token,
        token_expiry: tokenExpiry.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('coach_id', coachId)

    return {
      access_token: data.access_token,
      refresh_token: refreshToken, // Refresh token doesn't change
      token_expiry: tokenExpiry.toISOString(),
    }
  } catch (err) {
    console.error('Error refreshing Google token:', err)
    return null
  }
}

/**
 * Create a Google Calendar event
 */
export async function createCalendarEvent(
  coachId: string,
  params: CalendarEventParams
): Promise<CalendarEvent | null> {
  const creds = await getGoogleCredentials(coachId)
  if (!creds) {
    console.log('No valid Google credentials, skipping calendar event creation')
    return null
  }

  try {
    const event: Record<string, unknown> = {
      summary: params.summary,
      description: params.description || '',
      start: {
        dateTime: params.startTime,
        timeZone: 'America/Los_Angeles', // TODO: Get from coach settings
      },
      end: {
        dateTime: params.endTime,
        timeZone: 'America/Los_Angeles',
      },
      conferenceData: {
        createRequest: {
          requestId: `booking-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    }

    // Add attendee if provided
    if (params.attendeeEmail) {
      event.attendees = [
        {
          email: params.attendeeEmail,
          displayName: params.attendeeName || params.attendeeEmail,
        },
      ]
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create Google Calendar event:', errorText)
      return null
    }

    const data = await response.json()
    return {
      id: data.id,
      htmlLink: data.htmlLink,
      hangoutLink: data.hangoutLink,
    }
  } catch (err) {
    console.error('Error creating Google Calendar event:', err)
    return null
  }
}

/**
 * Update a Google Calendar event
 */
export async function updateCalendarEvent(
  coachId: string,
  eventId: string,
  params: Partial<CalendarEventParams>
): Promise<boolean> {
  const creds = await getGoogleCredentials(coachId)
  if (!creds) {
    return false
  }

  try {
    const updates: Record<string, unknown> = {}

    if (params.summary) updates.summary = params.summary
    if (params.description) updates.description = params.description
    if (params.startTime) {
      updates.start = {
        dateTime: params.startTime,
        timeZone: 'America/Los_Angeles',
      }
    }
    if (params.endTime) {
      updates.end = {
        dateTime: params.endTime,
        timeZone: 'America/Los_Angeles',
      }
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    )

    return response.ok
  } catch (err) {
    console.error('Error updating Google Calendar event:', err)
    return false
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(
  coachId: string,
  eventId: string
): Promise<boolean> {
  const creds = await getGoogleCredentials(coachId)
  if (!creds) {
    return false
  }

  try {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}?sendUpdates=all`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
        },
      }
    )

    // 204 No Content is success, 410 Gone means already deleted
    return response.ok || response.status === 410
  } catch (err) {
    console.error('Error deleting Google Calendar event:', err)
    return false
  }
}
