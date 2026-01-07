import { createAdminClient } from '@/lib/supabase/server'
import { getGoogleCredentials } from './calendar'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

interface CalendarEventItem {
  id: string
  status: 'confirmed' | 'tentative' | 'cancelled'
  summary?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
}

interface EventsListResponse {
  kind: string
  nextSyncToken?: string
  nextPageToken?: string
  items: CalendarEventItem[]
}

/**
 * Sync calendar changes from Google Calendar to our bookings.
 * Uses incremental sync if sync token is available.
 *
 * @param coachId - The coach's user ID
 * @param syncToken - Optional sync token for incremental sync
 * @returns New sync token for next sync, or null on failure
 */
export async function syncCalendarChanges(
  coachId: string,
  syncToken?: string
): Promise<string | null> {
  console.log('[Calendar Sync] Starting sync for coach:', coachId, 'syncToken:', syncToken ? 'yes' : 'no')

  const creds = await getGoogleCredentials(coachId)
  if (!creds) {
    console.log('[Calendar Sync] No credentials for coach:', coachId)
    return null
  }

  try {
    // Build API URL
    const params = new URLSearchParams()
    if (syncToken) {
      params.set('syncToken', syncToken)
    } else {
      // Full sync - only get events from last 30 days and next 90 days
      const timeMin = new Date()
      timeMin.setDate(timeMin.getDate() - 30)
      const timeMax = new Date()
      timeMax.setDate(timeMax.getDate() + 90)
      params.set('timeMin', timeMin.toISOString())
      params.set('timeMax', timeMax.toISOString())
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
        },
      }
    )

    // Handle invalid sync token - need full sync
    if (response.status === 410) {
      console.log('[Calendar Sync] Sync token expired, doing full sync')
      return syncCalendarChanges(coachId, undefined)
    }

    if (!response.ok) {
      console.error('[Calendar Sync] API error:', response.status, await response.text())
      return null
    }

    const data: EventsListResponse = await response.json()
    console.log('[Calendar Sync] Got', data.items.length, 'events')

    // Process cancelled events
    const supabase = createAdminClient()

    for (const event of data.items) {
      if (event.status === 'cancelled') {
        console.log('[Calendar Sync] Processing cancelled event:', event.id)

        // Find booking with this google_event_id
        const { data: booking, error: findError } = await supabase
          .from('bookings')
          .select('id, status, package_id, booking_type, coach_id')
          .eq('google_event_id', event.id)
          .eq('coach_id', coachId)
          .single()

        if (findError || !booking) {
          console.log('[Calendar Sync] No matching booking found for event:', event.id)
          continue
        }

        // Skip if already cancelled
        if (booking.status === 'cancelled') {
          console.log('[Calendar Sync] Booking already cancelled:', booking.id)
          continue
        }

        // Cancel the booking
        console.log('[Calendar Sync] Cancelling booking:', booking.id)

        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id)

        if (updateError) {
          console.error('[Calendar Sync] Failed to cancel booking:', updateError)
          continue
        }

        // Refund session if it's a session booking with a package
        if (booking.booking_type === 'session' && booking.package_id) {
          console.log('[Calendar Sync] Refunding session for package:', booking.package_id)
          const { error: rpcError } = await supabase.rpc('increment_session', {
            package_id: booking.package_id,
          })
          if (rpcError) {
            console.error('[Calendar Sync] Failed to refund session:', rpcError)
          }
        }

        console.log('[Calendar Sync] Booking cancelled successfully:', booking.id)
      }
    }

    // Handle pagination
    if (data.nextPageToken) {
      // More pages to fetch - in production, you'd want to handle this
      console.log('[Calendar Sync] More pages available (not implemented)')
    }

    return data.nextSyncToken || null
  } catch (err) {
    console.error('[Calendar Sync] Error:', err)
    return null
  }
}

/**
 * Set up a watch channel for a coach's calendar
 *
 * @param coachId - The coach's user ID
 * @returns true if watch was set up successfully
 */
export async function setupCalendarWatch(coachId: string): Promise<boolean> {
  console.log('[Calendar Watch] Setting up watch for coach:', coachId)

  const creds = await getGoogleCredentials(coachId)
  if (!creds) {
    console.log('[Calendar Watch] No credentials for coach:', coachId)
    return false
  }

  const supabase = createAdminClient()

  // Generate unique channel ID
  const channelId = crypto.randomUUID()

  // Calculate expiration (max 7 days, we'll use 6 to be safe)
  const expiration = new Date()
  expiration.setDate(expiration.getDate() + 6)

  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/google/webhook`

  try {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/watch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: coachId, // Store coach ID in token for easy lookup
          params: {
            ttl: (6 * 24 * 60 * 60).toString(), // 6 days in seconds
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Calendar Watch] Failed to create watch:', response.status, errorText)
      return false
    }

    const watchData = await response.json()
    console.log('[Calendar Watch] Watch created:', watchData)

    // Store watch channel info
    const { error: dbError } = await supabase
      .from('google_calendar_watch_channels')
      .upsert(
        {
          coach_id: coachId,
          channel_id: channelId,
          resource_id: watchData.resourceId,
          expiration: new Date(parseInt(watchData.expiration)).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'coach_id' }
      )

    if (dbError) {
      console.error('[Calendar Watch] Failed to store channel:', dbError)
      return false
    }

    console.log('[Calendar Watch] Watch set up successfully for coach:', coachId)
    return true
  } catch (err) {
    console.error('[Calendar Watch] Error:', err)
    return false
  }
}

/**
 * Stop watching a coach's calendar
 */
export async function stopCalendarWatch(coachId: string): Promise<boolean> {
  console.log('[Calendar Watch] Stopping watch for coach:', coachId)

  const creds = await getGoogleCredentials(coachId)
  if (!creds) {
    return false
  }

  const supabase = createAdminClient()

  // Get the channel info
  const { data: channel, error: findError } = await supabase
    .from('google_calendar_watch_channels')
    .select('channel_id, resource_id')
    .eq('coach_id', coachId)
    .single()

  if (findError || !channel) {
    console.log('[Calendar Watch] No watch channel found for coach:', coachId)
    return true // Nothing to stop
  }

  try {
    // Stop the watch
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/channels/stop`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channel.channel_id,
          resourceId: channel.resource_id,
        }),
      }
    )

    if (!response.ok && response.status !== 404) {
      console.error('[Calendar Watch] Failed to stop watch:', response.status)
    }

    // Delete from database
    await supabase
      .from('google_calendar_watch_channels')
      .delete()
      .eq('coach_id', coachId)

    console.log('[Calendar Watch] Watch stopped for coach:', coachId)
    return true
  } catch (err) {
    console.error('[Calendar Watch] Error stopping watch:', err)
    return false
  }
}
