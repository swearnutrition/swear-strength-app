import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SessionPackage {
  id: string
  client_id: string
  coach_id: string
  total_sessions: number
  remaining_sessions: number
  session_duration_minutes: number
  expires_at: string
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

// Track which reminders have been sent
type ReminderType = '30_day_warning' | '7_day_warning'

// Colors matching the design system
const colors = {
  bgPrimary: '#0f0f1a',
  bgCard: '#1a1a2e',
  purple: '#8b5cf6',
  purpleLight: '#a78bfa',
  amber: '#f59e0b',
  red: '#ef4444',
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

// Format date for display
function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }
  return date.toLocaleDateString('en-US', options)
}

// Calculate days until expiration
function daysUntilExpiration(expiresAt: string): number {
  const now = new Date()
  const expiration = new Date(expiresAt)
  const diffMs = expiration.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

// Email template for client
function generateClientExpirationEmail(
  pkg: SessionPackage,
  daysLeft: number,
  appUrl: string
): { subject: string; html: string } {
  const isUrgent = daysLeft <= 7
  const iconColor = isUrgent ? colors.red : colors.amber
  const urgencyText = isUrgent ? 'expires in 1 week' : 'expires in 1 month'

  return {
    subject: `Your Session Package ${isUrgent ? 'Expires Soon' : 'Expiring in 30 Days'} - ${pkg.remaining_sessions} Sessions Remaining`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Warning icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(${isUrgent ? '239, 68, 68' : '245, 158, 11'}, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px;">${isUrgent ? '&#9888;' : '&#128197;'}</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  Your Package ${isUrgent ? 'Expires Soon!' : 'Is Expiring'}
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Your session package with <strong style="color: ${colors.textPrimary};">${pkg.coach.name}</strong> ${urgencyText}.
                </p>

                <!-- Package Details Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding-bottom: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Expires On</p>
                            <p style="margin: 0; color: ${iconColor}; font-size: 16px; font-weight: 600;">${formatDate(pkg.expires_at)}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Sessions Remaining</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${pkg.remaining_sessions} of ${pkg.total_sessions} sessions</p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Session Duration</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${pkg.session_duration_minutes} minutes</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${renderButton('Book a Session', `${appUrl}/bookings/new`, isUrgent ? colors.red : colors.amber)}

                <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  ${isUrgent
                    ? 'Book now to use your remaining sessions before they expire!'
                    : 'Schedule your sessions now to get the most from your package.'}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `Your session package ${urgencyText} - ${pkg.remaining_sessions} sessions remaining`),
  }
}

// Email template for coach
function generateCoachExpirationEmail(
  pkg: SessionPackage,
  daysLeft: number,
  appUrl: string
): { subject: string; html: string } {
  const isUrgent = daysLeft <= 7

  return {
    subject: `Client Package ${isUrgent ? 'Expires Soon' : 'Expiring'}: ${pkg.client.name} - ${pkg.remaining_sessions} Sessions Left`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Info icon -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <div style="width: 64px; height: 64px; background-color: rgba(139, 92, 246, 0.2); border-radius: 50%; text-align: center; line-height: 64px;">
                        <span style="font-size: 32px;">&#128101;</span>
                      </div>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  Client Package ${isUrgent ? 'Expiring Soon' : 'Expiring'}
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  <strong style="color: ${colors.textPrimary};">${pkg.client.name}'s</strong> session package ${isUrgent ? 'expires in 1 week' : 'expires in 30 days'}.
                </p>

                <!-- Package Details Card -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="padding-bottom: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Client</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${pkg.client.name}</p>
                            <p style="margin: 4px 0 0; color: ${colors.textSecondary}; font-size: 14px;">${pkg.client.email}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 12px;">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Expires On</p>
                            <p style="margin: 0; color: ${isUrgent ? colors.red : colors.amber}; font-size: 16px; font-weight: 600;">${formatDate(pkg.expires_at)}</p>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase; font-weight: 600;">Sessions Remaining</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 16px; font-weight: 600;">${pkg.remaining_sessions} of ${pkg.total_sessions}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${renderButton('View Client', `${appUrl}/coach/clients/${pkg.client_id}`)}

                <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  Consider reaching out to help them use their remaining sessions.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `${pkg.client.name}'s package expires ${isUrgent ? 'in 1 week' : 'in 30 days'} - ${pkg.remaining_sessions} sessions remaining`),
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const appUrl = Deno.env.get('APP_URL') || 'https://app.swearstrength.com'
    const now = new Date()

    // Parse request body for reminder type
    let reminderDays = 30 // default to 30-day warning
    try {
      const body = await req.json()
      if (body.reminder_days) {
        reminderDays = body.reminder_days
      }
    } catch {
      // Use default
    }

    console.log(`Processing ${reminderDays}-day package expiration reminders at ${now.toISOString()}`)

    // Calculate the target date range
    // For 30-day warning: packages expiring in 29-30 days
    // For 7-day warning: packages expiring in 6-7 days
    const targetStart = new Date(now.getTime() + (reminderDays - 1) * 24 * 60 * 60 * 1000)
    const targetEnd = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000)

    console.log(`Looking for packages expiring between ${targetStart.toISOString()} and ${targetEnd.toISOString()}`)

    // Fetch packages expiring in the target window
    // Only packages with remaining sessions (no point reminding about empty packages)
    const { data: packages, error: fetchError } = await supabase
      .from('session_packages')
      .select(`
        id,
        client_id,
        coach_id,
        total_sessions,
        remaining_sessions,
        session_duration_minutes,
        expires_at,
        client:profiles!session_packages_client_id_fkey(id, name, email),
        coach:profiles!session_packages_coach_id_fkey(id, name, email)
      `)
      .gte('expires_at', targetStart.toISOString())
      .lt('expires_at', targetEnd.toISOString())
      .gt('remaining_sessions', 0)

    if (fetchError) {
      throw new Error(`Failed to fetch packages: ${fetchError.message}`)
    }

    console.log(`Found ${packages?.length || 0} packages expiring in ${reminderDays} days`)

    const results: {
      packageId: string
      clientId: string
      coachId: string
      daysLeft: number
      clientEmailSent: boolean
      coachEmailSent: boolean
      errors: string[]
    }[] = []

    for (const rawPackage of packages || []) {
      // Handle array results from foreign key relationships
      const client = Array.isArray(rawPackage.client) ? rawPackage.client[0] : rawPackage.client
      const coach = Array.isArray(rawPackage.coach) ? rawPackage.coach[0] : rawPackage.coach

      if (!client || !coach) {
        console.error(`Missing client or coach for package ${rawPackage.id}`)
        continue
      }

      const pkg: SessionPackage = {
        id: rawPackage.id,
        client_id: rawPackage.client_id,
        coach_id: rawPackage.coach_id,
        total_sessions: rawPackage.total_sessions,
        remaining_sessions: rawPackage.remaining_sessions,
        session_duration_minutes: rawPackage.session_duration_minutes,
        expires_at: rawPackage.expires_at,
        client,
        coach,
      }

      const daysLeft = daysUntilExpiration(pkg.expires_at)
      const errors: string[] = []
      let clientEmailSent = false
      let coachEmailSent = false

      // Send email to client
      try {
        const { subject, html } = generateClientExpirationEmail(pkg, daysLeft, appUrl)
        await sendEmail(client.email, subject, html)
        clientEmailSent = true
        console.log(`Client email sent for package ${pkg.id} to ${client.email}`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to send client email for package ${pkg.id}:`, errorMsg)
        errors.push(`client_email: ${errorMsg}`)
      }

      // Send email to coach
      try {
        const { subject, html } = generateCoachExpirationEmail(pkg, daysLeft, appUrl)
        await sendEmail(coach.email, subject, html)
        coachEmailSent = true
        console.log(`Coach email sent for package ${pkg.id} to ${coach.email}`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to send coach email for package ${pkg.id}:`, errorMsg)
        errors.push(`coach_email: ${errorMsg}`)
      }

      results.push({
        packageId: pkg.id,
        clientId: pkg.client_id,
        coachId: pkg.coach_id,
        daysLeft,
        clientEmailSent,
        coachEmailSent,
        errors,
      })
    }

    const totalClientEmails = results.filter((r) => r.clientEmailSent).length
    const totalCoachEmails = results.filter((r) => r.coachEmailSent).length
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0)

    return new Response(
      JSON.stringify({
        success: true,
        processedAt: now.toISOString(),
        reminderType: `${reminderDays}_day_warning`,
        packagesProcessed: results.length,
        clientEmailsSent: totalClientEmails,
        coachEmailsSent: totalCoachEmails,
        errors: totalErrors,
        details: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing package expiration reminders:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
