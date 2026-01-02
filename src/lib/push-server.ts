// Server-side push notification utilities
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

// Initialize web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:noreply@swearstrength.com'

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
}

interface PushPayload {
  title: string
  body: string
  url?: string
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured')
    return { sent: 0, failed: 0 }
  }

  const adminClient = createAdminClient()

  // Get all push subscriptions for these users
  const { data: subscriptions, error } = await adminClient
    .from('push_subscriptions')
    .select('id, user_id, endpoint, keys')
    .in('user_id', userIds)

  if (error) {
    console.error('Error fetching push subscriptions:', error)
    return { sent: 0, failed: 0 }
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0
  const expiredEndpoints: string[] = []

  // Send to all subscriptions
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys as { p256dh: string; auth: string },
          },
          JSON.stringify(payload)
        )
        sent++
      } catch (err: unknown) {
        failed++
        const error = err as { statusCode?: number }
        // If subscription is expired/invalid, mark for removal
        if (error.statusCode === 410 || error.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint)
        }
        console.error('Push notification failed:', err)
      }
    })
  )

  // Clean up expired subscriptions
  if (expiredEndpoints.length > 0) {
    await adminClient
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints)
  }

  return { sent, failed }
}
