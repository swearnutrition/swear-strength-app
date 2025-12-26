import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email templates
type EmailTemplate =
  | 'client-invite'
  | 'program-assigned'
  | 'workout-reminder'
  | 'habit-reminder'
  | 'weekly-summary'
  | 'coach-notification'

interface EmailRequest {
  to: string
  template: EmailTemplate
  data: Record<string, string | number | boolean>
}

// Base email wrapper
function wrapInTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px;">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom: 32px;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; background: linear-gradient(to right, #a855f7, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                    SWEAR STRENGTH
                  </h1>
                </td>
              </tr>
              ${content}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

// Template generators
const templates: Record<EmailTemplate, (data: Record<string, string | number | boolean>) => { subject: string; html: string }> = {
  'client-invite': (data) => ({
    subject: `${data.coachName} invited you to Swear Strength`,
    html: wrapInTemplate(`
      <tr>
        <td style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600; text-align: center;">
            You're Invited!
          </h2>
          <p style="margin: 0 0 24px; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
            <strong style="color: #ffffff;">${data.coachName}</strong> has invited you to join their coaching platform. Click below to create your account and get started.
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding: 8px 0 24px;">
                <a href="${data.inviteLink}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #4f46e5); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
                  Accept Invitation
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">
            This invite expires in 7 days.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 32px; text-align: center;">
          <p style="margin: 0; color: #475569; font-size: 12px;">
            Can't click the button? Copy this link:<br>
            <a href="${data.inviteLink}" style="color: #a855f7; word-break: break-all;">${data.inviteLink}</a>
          </p>
        </td>
      </tr>
    `),
  }),

  'program-assigned': (data) => ({
    subject: `New program assigned: ${data.programName}`,
    html: wrapInTemplate(`
      <tr>
        <td style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600; text-align: center;">
            New Program Ready!
          </h2>
          <p style="margin: 0 0 8px; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
            ${data.coachName} has assigned you a new program:
          </p>
          <p style="margin: 0 0 24px; color: #ffffff; font-size: 20px; font-weight: 600; text-align: center;">
            ${data.programName}
          </p>
          ${data.programDescription ? `<p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px; text-align: center;">${data.programDescription}</p>` : ''}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center" style="padding: 8px 0;">
                <a href="${data.appUrl}/workouts" style="display: inline-block; background: linear-gradient(to right, #9333ea, #4f46e5); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
                  View Program
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `),
  }),

  'workout-reminder': (data) => ({
    subject: `Time to train! ${data.workoutName} is waiting`,
    html: wrapInTemplate(`
      <tr>
        <td style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600; text-align: center;">
            Workout Reminder
          </h2>
          <p style="margin: 0 0 24px; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
            Today's workout is ready for you:
          </p>
          <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px; color: #ffffff; font-size: 18px; font-weight: 600; text-align: center;">
              ${data.workoutName}
            </p>
            ${data.workoutSubtitle ? `<p style="margin: 0; color: #64748b; font-size: 14px; text-align: center;">${data.workoutSubtitle}</p>` : ''}
          </div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <a href="${data.appUrl}/workouts" style="display: inline-block; background: linear-gradient(to right, #9333ea, #4f46e5); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
                  Start Workout
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `),
  }),

  'habit-reminder': (data) => ({
    subject: `Don't forget your habits today!`,
    html: wrapInTemplate(`
      <tr>
        <td style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600; text-align: center;">
            Habit Check-in
          </h2>
          <p style="margin: 0 0 24px; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
            You have <strong style="color: #ffffff;">${data.pendingCount} habits</strong> left to complete today. Keep your streak going!
          </p>
          ${data.currentStreak ? `
          <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase;">Current Streak</p>
            <p style="margin: 0; color: #fbbf24; font-size: 24px; font-weight: 700;">${data.currentStreak} days</p>
          </div>
          ` : ''}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <a href="${data.appUrl}/habits" style="display: inline-block; background: linear-gradient(to right, #9333ea, #4f46e5); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
                  Log Habits
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `),
  }),

  'weekly-summary': (data) => ({
    subject: `Your weekly summary is ready`,
    html: wrapInTemplate(`
      <tr>
        <td style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">
          <h2 style="margin: 0 0 24px; color: #ffffff; font-size: 20px; font-weight: 600; text-align: center;">
            Weekly Summary
          </h2>

          <!-- Stats Grid -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
            <tr>
              <td width="50%" style="padding: 8px;">
                <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; text-align: center;">
                  <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase;">Workouts</p>
                  <p style="margin: 0; color: #10b981; font-size: 24px; font-weight: 700;">${data.workoutsCompleted}/${data.workoutsTotal}</p>
                </div>
              </td>
              <td width="50%" style="padding: 8px;">
                <div style="background-color: #0f172a; border-radius: 12px; padding: 16px; text-align: center;">
                  <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase;">Habits</p>
                  <p style="margin: 0; color: #8b5cf6; font-size: 24px; font-weight: 700;">${data.habitsCompletionRate}%</p>
                </div>
              </td>
            </tr>
          </table>

          <p style="margin: 0 0 24px; color: #94a3b8; font-size: 14px; text-align: center;">
            ${Number(data.workoutsCompleted) >= Number(data.workoutsTotal) ? 'Amazing work this week! You crushed all your workouts.' : 'Keep pushing! Every workout counts.'}
          </p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <a href="${data.appUrl}/dashboard" style="display: inline-block; background: linear-gradient(to right, #9333ea, #4f46e5); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
                  View Details
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `),
  }),

  'coach-notification': (data) => ({
    subject: `${data.subject}`,
    html: wrapInTemplate(`
      <tr>
        <td style="background-color: #1e293b; border-radius: 16px; padding: 40px; border: 1px solid #334155;">
          <h2 style="margin: 0 0 16px; color: #ffffff; font-size: 20px; font-weight: 600; text-align: center;">
            ${data.title}
          </h2>
          <p style="margin: 0 0 24px; color: #94a3b8; font-size: 16px; line-height: 1.6; text-align: center;">
            ${data.message}
          </p>
          ${data.ctaUrl ? `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td align="center">
                <a href="${data.ctaUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #4f46e5); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 14px rgba(147, 51, 234, 0.4);">
                  ${data.ctaText || 'View'}
                </a>
              </td>
            </tr>
          </table>
          ` : ''}
        </td>
      </tr>
    `),
  }),
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, template, data }: EmailRequest = await req.json()
    console.log('Email request:', { to, template, data })

    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured')
      throw new Error('RESEND_API_KEY not configured')
    }

    if (!templates[template]) {
      console.error(`Unknown template: ${template}`)
      throw new Error(`Unknown email template: ${template}`)
    }

    const { subject, html } = templates[template](data)
    console.log('Sending email:', { to, subject })

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
    console.log('Resend response:', res.status, responseData)

    if (!res.ok) {
      console.error('Resend error:', responseData)
      throw new Error(responseData.message || 'Failed to send email')
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Email function error:', message)
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
