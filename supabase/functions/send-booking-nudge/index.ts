import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Colors matching the design system
const colors = {
  bgPrimary: '#0f0f1a',
  bgCard: '#1a1a2e',
  purple: '#8b5cf6',
  purpleLight: '#a78bfa',
  green: '#10b981',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  border: '#2a2a40',
}

// Base email wrapper - dark theme
function wrapInTemplate(content: string, preheader?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark">
      <meta name="supported-color-schemes" content="dark">
    </head>
    <body style="margin: 0; padding: 0; background-color: ${colors.bgPrimary}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${preheader}</div>` : ''}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px;">
              ${content}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Logo component
function renderLogo(): string {
  return `
    <tr>
      <td align="center" style="padding-bottom: 24px;">
        <!--[if mso]>
        <h1 style="margin: 0; font-size: 16px; font-weight: 700; color: ${colors.purple}; letter-spacing: 1px;">SWEAR STRENGTH</h1>
        <![endif]-->
        <!--[if !mso]><!-->
        <h1 style="margin: 0; font-size: 16px; font-weight: 700; font-style: italic; background: linear-gradient(135deg, ${colors.purple} 0%, ${colors.purpleLight} 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; color: ${colors.purple}; letter-spacing: 1px;">
          SWEAR STRENGTH
        </h1>
        <!--<![endif]-->
      </td>
    </tr>
  `
}

// CTA Button component
function renderButton(text: string, url: string, bgColor: string = colors.purple): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:52px;v-text-anchor:middle;width:220px;" arcsize="27%" fillcolor="${bgColor}">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:sans-serif;font-size:16px;font-weight:700;">${text}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${url}" style="display: inline-block; background-color: ${bgColor}; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 18px 40px; border-radius: 14px; mso-hide: all;">
            ${text}
          </a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>
  `
}

// Generate email for clients who need to book sessions
function generateBookingNudgeEmail(clientName: string, coachName: string, clientType: string, appUrl: string): { subject: string; html: string } {
  const isHybrid = clientType === 'hybrid'

  return {
    subject: `📅 Time to Book Your Training Sessions`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Calendar icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(139, 92, 246, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px;">&#128197;</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  Hey ${clientName.split(' ')[0]}, Book Your Sessions!
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  ${isHybrid
                    ? `You haven't booked any training sessions yet. Schedule your in-person sessions with ${coachName} to get the most out of your hybrid coaching experience.`
                    : `You haven't booked any training sessions yet. Schedule your sessions with ${coachName} to keep making progress.`
                  }
                </p>

                <!-- Benefits Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <p style="margin: 0 0 12px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Why book now?</p>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding: 8px 0; vertical-align: top;">
                            <span style="color: ${colors.green}; font-size: 16px; margin-right: 10px;">✓</span>
                            <span style="color: ${colors.textSecondary}; font-size: 14px;">Best time slots fill up fast</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; vertical-align: top;">
                            <span style="color: ${colors.green}; font-size: 16px; margin-right: 10px;">✓</span>
                            <span style="color: ${colors.textSecondary}; font-size: 14px;">Keep your training consistent</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; vertical-align: top;">
                            <span style="color: ${colors.green}; font-size: 16px; margin-right: 10px;">✓</span>
                            <span style="color: ${colors.textSecondary}; font-size: 14px;">Get hands-on guidance from your coach</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${renderButton('Book Sessions', `${appUrl}/bookings`)}

                <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  Questions? Message ${coachName} directly in the app.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `Book your training sessions with ${coachName} to stay on track!`),
  }
}

// Send email via Resend
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured')
    throw new Error('RESEND_API_KEY not configured')
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Swear Strength <no-reply@swearstrength.com>',
      reply_to: 'coach@swearstrength.com',
      to: [to],
      subject,
      html,
    }),
  })

  const responseData = await res.json()

  if (!res.ok) {
    console.error('Resend error:', responseData)
    throw new Error(responseData.message || 'Failed to send email')
  }

  console.log('Email sent successfully:', responseData)
}

// Send push notification
async function sendPushNotification(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  title: string,
  body: string,
  url: string
): Promise<void> {
  // Get push subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No push subscriptions found for users')
    return
  }

  // Import web-push for Deno
  const webPush = await import('npm:web-push@3.6.7')

  const vapidPublicKey = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured')
    return
  }

  webPush.setVapidDetails(
    'mailto:support@swearstrength.com',
    vapidPublicKey,
    vapidPrivateKey
  )

  const payload = JSON.stringify({
    title,
    body,
    url,
  })

  for (const sub of subscriptions) {
    try {
      const keys = sub.keys as { p256dh: string; auth: string }
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        },
        payload
      )
      console.log(`Push sent successfully for subscription ${sub.id}`)
    } catch (error: unknown) {
      const pushError = error as { statusCode?: number }
      if (pushError.statusCode === 410) {
        // Subscription expired, remove it
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
        console.log(`Removed expired push subscription ${sub.id}`)
      } else {
        console.error(`Push failed for subscription ${sub.id}:`, error)
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const appUrl = Deno.env.get('APP_URL') || 'https://app.swearstrength.com'
    const now = new Date()

    console.log(`Processing booking nudge at ${now.toISOString()}`)

    // Find training/hybrid clients with no upcoming confirmed bookings
    // First, get all training/hybrid clients who have booking reminders enabled
    const { data: clients, error: clientsError } = await supabase
      .from('profiles')
      .select('id, name, email, client_type, coach_id, push_booking_reminders')
      .in('client_type', ['training', 'hybrid'])
      .not('coach_id', 'is', null)
      .neq('push_booking_reminders', false)

    if (clientsError) {
      throw new Error(`Failed to fetch clients: ${clientsError.message}`)
    }

    console.log(`Found ${clients?.length || 0} training/hybrid clients`)

    if (!clients || clients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No training/hybrid clients found', emailsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all upcoming bookings for these clients
    const clientIds = clients.map(c => c.id)
    const { data: upcomingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('client_id')
      .in('client_id', clientIds)
      .eq('status', 'confirmed')
      .gte('starts_at', now.toISOString())

    if (bookingsError) {
      throw new Error(`Failed to fetch bookings: ${bookingsError.message}`)
    }

    // Get set of client IDs who have upcoming bookings
    const clientsWithBookings = new Set(upcomingBookings?.map(b => b.client_id) || [])

    // Filter to clients without upcoming bookings
    const clientsNeedingNudge = clients.filter(c => !clientsWithBookings.has(c.id))

    console.log(`${clientsNeedingNudge.length} clients need booking nudge`)

    // Check last nudge timestamp to avoid spamming
    // We'll use a rate limit of max 1 nudge per week per client
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const { data: recentNudges, error: nudgesError } = await supabase
      .from('booking_nudges')
      .select('client_id')
      .in('client_id', clientsNeedingNudge.map(c => c.id))
      .gte('sent_at', oneWeekAgo.toISOString())

    if (nudgesError) {
      // Table might not exist yet, that's okay
      console.log('Note: booking_nudges table may not exist yet')
    }

    const recentlyNudgedIds = new Set(recentNudges?.map(n => n.client_id) || [])

    // Filter out recently nudged clients
    const clientsToNudge = clientsNeedingNudge.filter(c => !recentlyNudgedIds.has(c.id))

    console.log(`${clientsToNudge.length} clients to nudge (after rate limiting)`)

    const results: { clientId: string; success: boolean; error?: string }[] = []

    // Get coach info
    const coachIds = [...new Set(clientsToNudge.map(c => c.coach_id))]
    const { data: coaches } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', coachIds)

    const coachMap = new Map(coaches?.map(c => [c.id, c.name]) || [])

    for (const client of clientsToNudge) {
      const coachName = coachMap.get(client.coach_id) || 'your coach'

      try {
        // Send email
        const { subject, html } = generateBookingNudgeEmail(
          client.name,
          coachName,
          client.client_type,
          appUrl
        )
        await sendEmail(client.email, subject, html)

        // Send push notification
        await sendPushNotification(
          supabase,
          [client.id],
          'Book Your Sessions',
          `Schedule your training sessions with ${coachName}`,
          '/bookings'
        )

        // Record the nudge (create table if needed via RPC or just try insert)
        try {
          await supabase
            .from('booking_nudges')
            .insert({
              client_id: client.id,
              sent_at: now.toISOString(),
            })
        } catch {
          // Table might not exist, that's fine for now
          console.log('Could not record nudge (table may not exist)')
        }

        results.push({ clientId: client.id, success: true })
        console.log(`Nudge sent to ${client.name} (${client.id})`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        results.push({ clientId: client.id, success: false, error: errorMsg })
        console.error(`Failed to nudge ${client.name}:`, errorMsg)
      }
    }

    const successCount = results.filter(r => r.success).length

    return new Response(
      JSON.stringify({
        success: true,
        processedAt: now.toISOString(),
        clientsChecked: clients.length,
        clientsWithoutBookings: clientsNeedingNudge.length,
        emailsSent: successCount,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing booking nudges:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
