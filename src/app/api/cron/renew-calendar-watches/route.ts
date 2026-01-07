import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { setupCalendarWatch, stopCalendarWatch } from '@/lib/google/calendar-sync'

/**
 * Cron job to renew expiring Google Calendar watch channels
 *
 * Google watch channels expire after max 7 days. This endpoint should be
 * called daily to renew channels that will expire within 2 days.
 *
 * Set up in vercel.json or your cron provider:
 * - Schedule: "0 0 * * *" (daily at midnight)
 * - URL: /api/cron/renew-calendar-watches
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (for Vercel cron jobs)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Find channels expiring within 2 days
  const expiryThreshold = new Date()
  expiryThreshold.setDate(expiryThreshold.getDate() + 2)

  const { data: expiringChannels, error } = await supabase
    .from('google_calendar_watch_channels')
    .select('coach_id, expiration')
    .lt('expiration', expiryThreshold.toISOString())

  if (error) {
    console.error('[Renew Watches] Error fetching expiring channels:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  console.log('[Renew Watches] Found', expiringChannels?.length || 0, 'channels to renew')

  const results = {
    total: expiringChannels?.length || 0,
    renewed: 0,
    failed: 0,
  }

  for (const channel of expiringChannels || []) {
    try {
      // Stop the old watch
      await stopCalendarWatch(channel.coach_id)

      // Set up a new watch
      const success = await setupCalendarWatch(channel.coach_id)

      if (success) {
        results.renewed++
        console.log('[Renew Watches] Renewed watch for coach:', channel.coach_id)
      } else {
        results.failed++
        console.error('[Renew Watches] Failed to renew watch for coach:', channel.coach_id)
      }
    } catch (err) {
      results.failed++
      console.error('[Renew Watches] Error renewing watch for coach:', channel.coach_id, err)
    }
  }

  console.log('[Renew Watches] Complete:', results)
  return NextResponse.json(results)
}
