import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Notification types
type BookingNotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'checkin_form_submitted'

interface BookingNotificationRequest {
  type: BookingNotificationType
  bookingId: string
  // Additional data for rescheduling
  previousStartsAt?: string
  previousEndsAt?: string
}

interface BookingData {
  id: string
  client_id: string
  coach_id: string
  booking_type: 'session' | 'checkin'
  starts_at: string
  ends_at: string
  status: string
  google_meet_link: string | null
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

interface CheckinFormResponseData {
  id: string
  booking_id: string
  client_id: string
  responses: Record<string, string | string[]>
  submitted_at: string
}

// Colors matching the design system
const colors = {
  bgPrimary: '#0f0f1a',
  bgCard: '#1a1a2e',
  bgCardDark: '#0f0f1a',
  bgHover: '#2a2a40',
  purple: '#8b5cf6',
  purpleDark: '#7c3aed',
  purpleLight: '#a78bfa',
  amber: '#f59e0b',
  amberDark: '#d97706',
  green: '#10b981',
  red: '#ef4444',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textDark: '#475569',
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

// Email templates for booking notifications
function generateBookingConfirmedEmail(booking: BookingData, appUrl: string): { subject: string; html: string } {
  const dateTime = formatDateTime(booking.starts_at)
  const endTime = formatDateTime(booking.ends_at).time
  const bookingTypeLabel = booking.booking_type === 'session' ? 'Session' : 'Check-in'

  return {
    subject: `Your ${bookingTypeLabel} is Confirmed - ${dateTime.date}`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Confirmation icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(16, 185, 129, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px;">&#10003;</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  ${bookingTypeLabel} Confirmed!
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Your ${bookingTypeLabel.toLowerCase()} with <strong style="color: ${colors.textPrimary};">${booking.coach.name}</strong> has been confirmed.
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
                  Need to reschedule? You can manage your booking from the app.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `Your ${bookingTypeLabel.toLowerCase()} with ${booking.coach.name} is confirmed for ${dateTime.full}`),
  }
}

function generateBookingCancelledEmail(booking: BookingData, appUrl: string): { subject: string; html: string } {
  const dateTime = formatDateTime(booking.starts_at)
  const bookingTypeLabel = booking.booking_type === 'session' ? 'Session' : 'Check-in'

  return {
    subject: `${bookingTypeLabel} Cancelled - ${dateTime.date}`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Cancel icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(239, 68, 68, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px; color: ${colors.red};">&#10005;</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  ${bookingTypeLabel} Cancelled
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Your ${bookingTypeLabel.toLowerCase()} has been cancelled.
                </p>

                <!-- Cancelled Booking Details -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px; opacity: 0.7;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td>
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Original Date</p>
                            <p style="margin: 0; color: ${colors.textSecondary}; font-size: 16px; text-decoration: line-through;">${dateTime.date}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-top: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Coach</p>
                            <p style="margin: 0; color: ${colors.textSecondary}; font-size: 16px;">${booking.coach.name}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${renderButton('Book a New Time', `${appUrl}/bookings`)}

                <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  Questions? Message your coach anytime.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `Your ${bookingTypeLabel.toLowerCase()} for ${dateTime.date} has been cancelled`),
  }
}

function generateBookingRescheduledEmail(
  booking: BookingData,
  previousStartsAt: string,
  previousEndsAt: string,
  appUrl: string
): { subject: string; html: string } {
  const oldDateTime = formatDateTime(previousStartsAt)
  const newDateTime = formatDateTime(booking.starts_at)
  const newEndTime = formatDateTime(booking.ends_at).time
  const bookingTypeLabel = booking.booking_type === 'session' ? 'Session' : 'Check-in'

  return {
    subject: `${bookingTypeLabel} Rescheduled - Now ${newDateTime.date}`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Reschedule icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(245, 158, 11, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px;">&#128197;</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  ${bookingTypeLabel} Rescheduled
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Your ${bookingTypeLabel.toLowerCase()} has been moved to a new time.
                </p>

                <!-- Old vs New Time -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                  <tr>
                    <!-- Old Time -->
                    <td width="48%" valign="top" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; padding: 16px; opacity: 0.6;">
                      <p style="margin: 0 0 8px; color: ${colors.red}; font-size: 11px; font-weight: 700; text-transform: uppercase;">Previous</p>
                      <p style="margin: 0; color: ${colors.textSecondary}; font-size: 14px; text-decoration: line-through;">${oldDateTime.date}</p>
                      <p style="margin: 4px 0 0; color: ${colors.textMuted}; font-size: 13px; text-decoration: line-through;">${oldDateTime.time}</p>
                    </td>
                    <td width="4%"></td>
                    <!-- New Time -->
                    <td width="48%" valign="top" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; padding: 16px; border: 2px solid ${colors.green};">
                      <p style="margin: 0 0 8px; color: ${colors.green}; font-size: 11px; font-weight: 700; text-transform: uppercase;">New Time</p>
                      <p style="margin: 0; color: ${colors.textPrimary}; font-size: 14px; font-weight: 600;">${newDateTime.date}</p>
                      <p style="margin: 4px 0 0; color: ${colors.textSecondary}; font-size: 13px;">${newDateTime.time} - ${newEndTime}</p>
                    </td>
                  </tr>
                </table>

                ${booking.google_meet_link ? `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px;">
                      <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Meeting Link</p>
                      <a href="${booking.google_meet_link}" style="color: ${colors.purpleLight}; font-size: 14px; text-decoration: none;">Join Google Meet</a>
                    </td>
                  </tr>
                </table>
                ` : ''}

                ${renderButton('View Booking', `${appUrl}/bookings`)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `Your ${bookingTypeLabel.toLowerCase()} has been rescheduled from ${oldDateTime.date} to ${newDateTime.date}`),
  }
}

function generateCheckinFormSubmittedEmail(
  booking: BookingData,
  _formResponse: CheckinFormResponseData,
  appUrl: string
): { subject: string; html: string } {
  const dateTime = formatDateTime(booking.starts_at)

  return {
    subject: `Check-in Form Submitted by ${booking.client.name}`,
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
                  Check-in Form Submitted
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  <strong style="color: ${colors.textPrimary};">${booking.client.name}</strong> has submitted their check-in form for their upcoming appointment.
                </p>

                <!-- Booking Details -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td>
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Appointment</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${dateTime.date}</p>
                            <p style="margin: 4px 0 0; color: ${colors.textSecondary}; font-size: 14px;">${dateTime.time}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${renderButton('View Responses', `${appUrl}/coach/bookings`)}

                <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  Review the responses before your check-in call.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `${booking.client.name} has submitted their check-in form ahead of their appointment`),
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
    const { type, bookingId, previousStartsAt, previousEndsAt }: BookingNotificationRequest = await req.json()
    console.log('Booking notification request:', { type, bookingId })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const appUrl = Deno.env.get('APP_URL') || 'https://app.swearstrength.com'

    // Fetch booking with client and coach details
    const { data: booking, error: bookingError } = await supabase
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
        client:profiles!bookings_client_id_fkey(id, name, email),
        coach:profiles!bookings_coach_id_fkey(id, name, email)
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message || 'Unknown error'}`)
    }

    // Handle array results from foreign key relationships
    const client = Array.isArray(booking.client) ? booking.client[0] : booking.client
    const coach = Array.isArray(booking.coach) ? booking.coach[0] : booking.coach

    if (!client || !coach) {
      throw new Error('Client or coach profile not found')
    }

    const bookingData: BookingData = {
      id: booking.id,
      client_id: booking.client_id,
      coach_id: booking.coach_id,
      booking_type: booking.booking_type,
      starts_at: booking.starts_at,
      ends_at: booking.ends_at,
      status: booking.status,
      google_meet_link: booking.google_meet_link,
      client,
      coach,
    }

    const dateTime = formatDateTime(bookingData.starts_at)
    const bookingTypeLabel = bookingData.booking_type === 'session' ? 'Session' : 'Check-in'

    switch (type) {
      case 'booking_confirmed': {
        // Send email to client
        const { subject, html } = generateBookingConfirmedEmail(bookingData, appUrl)
        await sendEmail(client.email, subject, html)

        // Send push to client
        await sendPushNotification(
          supabase,
          [client.id],
          `${bookingTypeLabel} Confirmed`,
          `Your ${bookingTypeLabel.toLowerCase()} is confirmed for ${dateTime.date} at ${dateTime.time}`,
          '/bookings'
        )
        break
      }

      case 'booking_cancelled': {
        // Send email to client
        const { subject, html } = generateBookingCancelledEmail(bookingData, appUrl)
        await sendEmail(client.email, subject, html)

        // Send push to client
        await sendPushNotification(
          supabase,
          [client.id],
          `${bookingTypeLabel} Cancelled`,
          `Your ${bookingTypeLabel.toLowerCase()} for ${dateTime.date} has been cancelled`,
          '/bookings'
        )
        break
      }

      case 'booking_rescheduled': {
        if (!previousStartsAt || !previousEndsAt) {
          throw new Error('previousStartsAt and previousEndsAt required for reschedule notification')
        }

        // Send email to client
        const { subject, html } = generateBookingRescheduledEmail(
          bookingData,
          previousStartsAt,
          previousEndsAt,
          appUrl
        )
        await sendEmail(client.email, subject, html)

        // Send push to client
        const oldDateTime = formatDateTime(previousStartsAt)
        await sendPushNotification(
          supabase,
          [client.id],
          `${bookingTypeLabel} Rescheduled`,
          `Your ${bookingTypeLabel.toLowerCase()} has been moved from ${oldDateTime.date} to ${dateTime.date}`,
          '/bookings'
        )
        break
      }

      case 'checkin_form_submitted': {
        // Fetch form response
        const { data: formResponse, error: formError } = await supabase
          .from('checkin_form_responses')
          .select('*')
          .eq('booking_id', bookingId)
          .single()

        if (formError || !formResponse) {
          throw new Error(`Form response not found: ${formError?.message || 'Unknown error'}`)
        }

        // Send email to coach
        const { subject, html } = generateCheckinFormSubmittedEmail(bookingData, formResponse, appUrl)
        await sendEmail(coach.email, subject, html)

        // Send push to coach
        await sendPushNotification(
          supabase,
          [coach.id],
          'Check-in Form Submitted',
          `${client.name} submitted their check-in form`,
          '/coach/bookings'
        )
        break
      }

      default:
        throw new Error(`Unknown notification type: ${type}`)
    }

    return new Response(
      JSON.stringify({ success: true, type, bookingId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending booking notification:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
