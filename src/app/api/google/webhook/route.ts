import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncCalendarChanges } from '@/lib/google/calendar-sync'

/**
 * Google Calendar Push Notification Webhook
 *
 * Receives notifications when calendar events change.
 * Google sends these headers:
 * - X-Goog-Channel-ID: Our channel UUID
 * - X-Goog-Resource-State: "sync" | "exists" | "not_exists"
 * - X-Goog-Resource-ID: Opaque resource identifier
 * - X-Goog-Resource-URI: API endpoint for the resource
 * - X-Goog-Channel-Token: Optional token we set (coach_id)
 * - X-Goog-Message-Number: Notification sequence number
 */
export async function POST(request: NextRequest) {
  // Extract Google notification headers
  const channelId = request.headers.get('x-goog-channel-id')
  const resourceState = request.headers.get('x-goog-resource-state')
  const resourceId = request.headers.get('x-goog-resource-id')
  const channelToken = request.headers.get('x-goog-channel-token') // We store coach_id here
  const messageNumber = request.headers.get('x-goog-message-number')

  console.log('[Calendar Webhook] Received notification:', {
    channelId,
    resourceState,
    resourceId,
    channelToken,
    messageNumber,
  })

  // Validate required headers
  if (!channelId || !resourceState) {
    console.error('[Calendar Webhook] Missing required headers')
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 })
  }

  // Sync notification - Google sends this when watch is first set up
  if (resourceState === 'sync') {
    console.log('[Calendar Webhook] Sync notification received, watch is active')
    return NextResponse.json({ ok: true })
  }

  // Look up the watch channel to get the coach_id
  const supabase = createAdminClient()

  const { data: channel, error: channelError } = await supabase
    .from('google_calendar_watch_channels')
    .select('coach_id, sync_token')
    .eq('channel_id', channelId)
    .single()

  if (channelError || !channel) {
    console.error('[Calendar Webhook] Channel not found:', channelId, channelError)
    // Return 200 to prevent Google from retrying
    return NextResponse.json({ ok: true })
  }

  // Process the notification asynchronously
  // Google expects a quick response, so we don't wait for sync to complete
  if (resourceState === 'exists') {
    // Events were created, updated, or deleted
    console.log('[Calendar Webhook] Processing changes for coach:', channel.coach_id)

    // Fire and forget - sync in background
    syncCalendarChanges(channel.coach_id, channel.sync_token || undefined)
      .then(newSyncToken => {
        if (newSyncToken) {
          // Update sync token for incremental sync
          supabase
            .from('google_calendar_watch_channels')
            .update({ sync_token: newSyncToken, updated_at: new Date().toISOString() })
            .eq('coach_id', channel.coach_id)
            .then(() => console.log('[Calendar Webhook] Sync token updated'))
        }
      })
      .catch(err => console.error('[Calendar Webhook] Sync error:', err))
  }

  // Always return 200 quickly to acknowledge receipt
  return NextResponse.json({ ok: true })
}

// Google may send GET requests for verification
export async function GET() {
  return NextResponse.json({ status: 'Calendar webhook endpoint active' })
}
