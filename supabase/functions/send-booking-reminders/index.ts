import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Reminder types that can be sent
type ReminderType = 'booking_reminder' | 'form_reminder'

interface BookingWithDetails {
  id: string
  client_id: string
  coach_id: string
  booking_type: 'session' | 'checkin'
  starts_at: string
  ends_at: string
  status: string
  google_meet_link: string | null
  reminders_sent: string[]
  client: {
    id: string
    name: string
    email: string
  }
  coach: {
    id: string
    name: string
    email: string
  }
}

// Colors matching the design system
const colors = {
  bgPrimary: '#0f0f1a',
  bgCard: '#1a1a2e',
  purple: '#8b5cf6',
  purpleLight: '#a78bfa',
  amber: '#f59e0b',
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

// Format date/time for display
function formatDateTime(isoString: string): { date: string; time: string; full: string } {
  const date = new Date(isoString)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }
  return {
    date: date.toLocaleDateString('en-US', options),
    time: date.toLocaleTimeString('en-US', timeOptions),
    full: `${date.toLocaleDateString('en-US', options)} at ${date.toLocaleTimeString('en-US', timeOptions)}`,
  }
}

// Email template for booking reminder
function generateBookingReminderEmail(booking: BookingWithDetails, appUrl: string): { subject: string; html: string } {
  const dateTime = formatDateTime(booking.starts_at)
  const endTime = formatDateTime(booking.ends_at).time
  const bookingTypeLabel = booking.booking_type === 'session' ? 'Session' : 'Check-in'

  return {
    subject: `Reminder: Your ${bookingTypeLabel} is Tomorrow - ${dateTime.time}`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Reminder icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(245, 158, 11, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px;">&#128276;</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  ${bookingTypeLabel} Tomorrow!
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Just a reminder that you have a ${bookingTypeLabel.toLowerCase()} with <strong style="color: ${colors.textPrimary};">${booking.coach.name}</strong> tomorrow.
                </p>

                <!-- Booking Details Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding-bottom: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Date</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${dateTime.date}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Time</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${dateTime.time} - ${endTime}</p>
                          </td>
                        </tr>
                        ${booking.google_meet_link ? `
                        <tr>
                          <td>
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Meeting Link</p>
                            <a href="${booking.google_meet_link}" style="color: ${colors.purpleLight}; font-size: 14px; text-decoration: none;">Join Google Meet</a>
                          </td>
                        </tr>
                        ` : ''}
                      </table>
                    </td>
                  </tr>
                </table>

                ${renderButton('View Booking', `${appUrl}/bookings`)}

                <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  Need to reschedule? Please let your coach know as soon as possible.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `Reminder: Your ${bookingTypeLabel.toLowerCase()} with ${booking.coach.name} is tomorrow at ${dateTime.time}`),
  }
}

// Email template for form reminder
function generateFormReminderEmail(booking: BookingWithDetails, appUrl: string): { subject: string; html: string } {
  const dateTime = formatDateTime(booking.starts_at)

  return {
    subject: `Please Complete Your Check-in Form Before Tomorrow`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Form icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(139, 92, 246, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px;">&#128203;</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  Check-in Form Needed
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Please complete your check-in form before your appointment with <strong style="color: ${colors.textPrimary};">${booking.coach.name}</strong> tomorrow.
                </p>

                <!-- Booking Details Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding-bottom: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Appointment</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${dateTime.date}</p>
                            <p style="margin: 4px 0 0; color: ${colors.textSecondary}; font-size: 14px;">${dateTime.time}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${renderButton('Complete Form', `${appUrl}/bookings/${booking.id}/form`, colors.amber)}

                <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  Completing your form ahead of time helps your coach prepare for your check-in.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `Don't forget to complete your check-in form before your appointment tomorrow`),
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

// Update reminders_sent array for a booking
async function markReminderSent(
  supabase: ReturnType<typeof createClient>,
  bookingId: string,
  reminderType: ReminderType
): Promise<void> {
  // Use Postgres array_append to add the reminder type
  await supabase.rpc('append_booking_reminder', {
    p_booking_id: bookingId,
    p_reminder_type: reminderType,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const appUrl = Deno.env.get('APP_URL') || 'https://app.swearstrength.com'
    const now = new Date()

    // Calculate the time window: 23-24 hours from now
    // This catches bookings that start in ~24 hours when cron runs hourly
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000)
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    console.log(`Processing booking reminders at ${now.toISOString()}`)
    console.log(`Looking for bookings starting between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`)

    // Fetch confirmed bookings starting in 23-24 hours
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        client_id,
        coach_id,
        booking_type,
        starts_at,
        ends_at,
        status,
        google_meet_link,
        reminders_sent,
        client:profiles!bookings_client_id_fkey(id, name, email),
        coach:profiles!bookings_coach_id_fkey(id, name, email)
      `)
      .eq('status', 'confirmed')
      .gte('starts_at', windowStart.toISOString())
      .lt('starts_at', windowEnd.toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch bookings: ${fetchError.message}`)
    }

    console.log(`Found ${bookings?.length || 0} bookings to process`)

    const results: {
      bookingId: string
      bookingType: string
      remindersSent: string[]
      errors: string[]
    }[] = []

    for (const rawBooking of bookings || []) {
      // Handle array results from foreign key relationships
      const client = Array.isArray(rawBooking.client) ? rawBooking.client[0] : rawBooking.client
      const coach = Array.isArray(rawBooking.coach) ? rawBooking.coach[0] : rawBooking.coach

      if (!client || !coach) {
        console.error(`Missing client or coach for booking ${rawBooking.id}`)
        continue
      }

      const booking: BookingWithDetails = {
        id: rawBooking.id,
        client_id: rawBooking.client_id,
        coach_id: rawBooking.coach_id,
        booking_type: rawBooking.booking_type,
        starts_at: rawBooking.starts_at,
        ends_at: rawBooking.ends_at,
        status: rawBooking.status,
        google_meet_link: rawBooking.google_meet_link,
        reminders_sent: rawBooking.reminders_sent || [],
        client,
        coach,
      }

      const dateTime = formatDateTime(booking.starts_at)
      const bookingTypeLabel = booking.booking_type === 'session' ? 'Session' : 'Check-in'
      const remindersSent: string[] = []
      const errors: string[] = []

      // Check if booking_reminder already sent
      const alreadySentBookingReminder = booking.reminders_sent.includes('booking_reminder')

      if (!alreadySentBookingReminder) {
        try {
          // Send push notification for all booking types
          await sendPushNotification(
            supabase,
            [booking.client_id],
            `${bookingTypeLabel} Tomorrow`,
            `Your ${bookingTypeLabel.toLowerCase()} with ${booking.coach.name} is tomorrow at ${dateTime.time}`,
            '/bookings'
          )
          console.log(`Push notification sent for booking ${booking.id}`)

          // For check-ins, also send email
          if (booking.booking_type === 'checkin') {
            const { subject, html } = generateBookingReminderEmail(booking, appUrl)
            await sendEmail(client.email, subject, html)
            console.log(`Email sent for check-in booking ${booking.id}`)
          }

          // Mark reminder as sent
          await markReminderSent(supabase, booking.id, 'booking_reminder')
          remindersSent.push('booking_reminder')
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`Failed to send booking reminder for ${booking.id}:`, errorMsg)
          errors.push(`booking_reminder: ${errorMsg}`)
        }
      }

      // For check-ins, check if form is incomplete and send form reminder
      if (booking.booking_type === 'checkin') {
        const alreadySentFormReminder = booking.reminders_sent.includes('form_reminder')

        if (!alreadySentFormReminder) {
          // Check if form has been submitted
          const { data: formResponse } = await supabase
            .from('checkin_form_responses')
            .select('id')
            .eq('booking_id', booking.id)
            .maybeSingle()

          // If no form response, send form reminder
          if (!formResponse) {
            try {
              // Send push notification
              await sendPushNotification(
                supabase,
                [booking.client_id],
                'Complete Your Check-in Form',
                `Please fill out your check-in form before your appointment tomorrow with ${booking.coach.name}`,
                `/bookings/${booking.id}/form`
              )

              // Send email
              const { subject, html } = generateFormReminderEmail(booking, appUrl)
              await sendEmail(client.email, subject, html)

              // Mark reminder as sent
              await markReminderSent(supabase, booking.id, 'form_reminder')
              remindersSent.push('form_reminder')
              console.log(`Form reminder sent for booking ${booking.id}`)
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : 'Unknown error'
              console.error(`Failed to send form reminder for ${booking.id}:`, errorMsg)
              errors.push(`form_reminder: ${errorMsg}`)
            }
          }
        }
      }

      results.push({
        bookingId: booking.id,
        bookingType: booking.booking_type,
        remindersSent,
        errors,
      })
    }

    const totalReminders = results.reduce((sum, r) => sum + r.remindersSent.length, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

    return new Response(
      JSON.stringify({
        success: true,
        processedAt: now.toISOString(),
        bookingsProcessed: results.length,
        remindersSent: totalReminders,
        errors: totalErrors,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing booking reminders:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
