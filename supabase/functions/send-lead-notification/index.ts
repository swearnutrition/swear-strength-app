import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadNotificationPayload {
  name: string
  email: string
  phone: string | null
  trainingExperience: string
  goals: string[]
  trainingFormat: string
  currentSituation: string
  anythingElse: string | null
}

const formatLabels: Record<string, string> = {
  online: 'Online (independent/busy lifestyle)',
  hybrid: 'Hybrid (see me sometimes, workout on own most of the time)',
  'in-person': 'Fully in-person',
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function generateEmailHtml(lead: LeadNotificationPayload): string {
  // Escape user-provided data to prevent XSS/HTML injection
  const safeName = escapeHtml(lead.name)
  const safeEmail = escapeHtml(lead.email)
  const safePhone = lead.phone ? escapeHtml(lead.phone) : null
  const safeTrainingExperience = escapeHtml(lead.trainingExperience)
  const safeTrainingFormat = formatLabels[lead.trainingFormat] || escapeHtml(lead.trainingFormat)
  const safeGoals = lead.goals.map(goal => escapeHtml(goal)).join(', ')
  const safeCurrentSituation = escapeHtml(lead.currentSituation)
  const safeAnythingElse = lead.anythingElse ? escapeHtml(lead.anythingElse) : null

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 16px; padding: 32px;">
          <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">New Training Inquiry</h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px 0;">Someone wants to train with you!</p>

          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Contact Info</h2>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Name:</strong> ${safeName}</p>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Email:</strong> <a href="mailto:${lead.email}" style="color: #a855f7;">${safeEmail}</a></p>
            ${safePhone ? `<p style="color: #ffffff; margin: 0;"><strong>Phone:</strong> <a href="tel:${lead.phone}" style="color: #a855f7;">${safePhone}</a></p>` : ''}
          </div>

          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Training Details</h2>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Experience:</strong> ${safeTrainingExperience}</p>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Format:</strong> ${safeTrainingFormat}</p>
            <p style="color: #ffffff; margin: 0;"><strong>Goals:</strong> ${safeGoals}</p>
          </div>

          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Current Situation</h2>
            <p style="color: #ffffff; margin: 0; white-space: pre-wrap;">${safeCurrentSituation}</p>
          </div>

          ${safeAnythingElse ? `
          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Additional Info</h2>
            <p style="color: #ffffff; margin: 0; white-space: pre-wrap;">${safeAnythingElse}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 24px;">
            <a href="mailto:${lead.email}" style="display: inline-block; background: linear-gradient(135deg, #a855f7, #ec4899); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600;">Reply to ${safeName}</a>
          </div>
        </div>

        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
          Swear Strength Coaching Platform
        </p>
      </div>
    </body>
    </html>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const lead: LeadNotificationPayload = await req.json()

    const html = generateEmailHtml(lead)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Swear Strength <no-reply@swearstrength.com>',
        to: ['coach@swearstrength.com'],
        subject: `New Training Inquiry from ${lead.name}`,
        html,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Resend error: ${error}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error sending lead notification:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
