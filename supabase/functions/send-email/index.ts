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
  | 'habit-zero-logs'
  | 'habit-halfway'
  | 'weekly-summary'
  | 'coach-notification'
  | 'rivalry-nudge'

interface EmailRequest {
  to: string
  template: EmailTemplate
  data: Record<string, string | number | boolean | string[]>
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
  borderDashed: '#3a3a50',
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

// Week day boxes for zero logs email
function renderEmptyWeekDays(): string {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        ${days.map(day => `
          <td align="center" style="padding: 4px;">
            <table role="presentation" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="width: 40px; height: 40px; border-radius: 10px; background-color: ${colors.bgHover}; border: 2px dashed ${colors.borderDashed};">
                  <span style="color: ${colors.textDark}; font-size: 14px;">—</span>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-top: 6px;">
                  <span style="color: ${colors.textDark}; font-size: 11px; font-weight: 600;">${day}</span>
                </td>
              </tr>
            </table>
          </td>
        `).join('')}
      </tr>
    </table>
  `
}

// Progress bar for halfway email
function renderProgressBar(logged: number, goal: number): string {
  const percentage = Math.round((logged / goal) * 100)
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 10px;">
            <tr>
              <td style="color: ${colors.textSecondary}; font-size: 13px; font-weight: 600;">THIS WEEK</td>
              <td align="right" style="color: ${colors.amber}; font-size: 14px; font-weight: 700;">${logged}/${goal} days</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 6px;">
            <tr>
              <td style="height: 12px; border-radius: 6px;">
                <table role="presentation" width="${percentage}%" cellspacing="0" cellpadding="0" bgcolor="${colors.amber}" style="background-color: ${colors.amber}; border-radius: 6px;">
                  <tr>
                    <td style="height: 12px; line-height: 12px; font-size: 1px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `
}

// Template generators
const templates: Record<EmailTemplate, (data: Record<string, string | number | boolean | string[]>) => { subject: string; html: string }> = {
  'client-invite': (data) => ({
    subject: `${data.coachName} invited you to Swear Strength`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 20px; font-weight: 600; text-align: center;">
                  You're Invited!
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  <strong style="color: ${colors.textPrimary};">${data.coachName}</strong> has invited you to join their coaching platform. Click below to create your account and get started.
                </p>
                ${renderButton('Accept Invitation', String(data.inviteLink))}
                <p style="margin: 24px 0 0; color: ${colors.textMuted}; font-size: 14px; text-align: center;">
                  This invite expires in 7 days.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 24px; text-align: center;">
          <p style="margin: 0; color: ${colors.textDark}; font-size: 12px;">
            Can't click the button? Copy this link:<br>
            <a href="${data.inviteLink}" style="color: ${colors.purpleLight}; word-break: break-all;">${data.inviteLink}</a>
          </p>
        </td>
      </tr>
    `),
  }),

  'program-assigned': (data) => ({
    subject: `New program assigned: ${data.programName}`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 20px; font-weight: 600; text-align: center;">
                  New Program Ready!
                </h2>
                <p style="margin: 0 0 8px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  ${data.coachName} has assigned you a new program:
                </p>
                <p style="margin: 0 0 24px; color: ${colors.textPrimary}; font-size: 20px; font-weight: 600; text-align: center;">
                  ${data.programName}
                </p>
                ${renderButton('View Program', `${data.appUrl}/workouts`)}
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
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 20px; font-weight: 600; text-align: center;">
                  Workout Reminder
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Today's workout is ready for you:
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 12px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px; text-align: center;">
                      <p style="margin: 0 0 4px; color: ${colors.textPrimary}; font-size: 18px; font-weight: 600;">
                        ${data.workoutName}
                      </p>
                    </td>
                  </tr>
                </table>
                ${renderButton('Start Workout', `${data.appUrl}/workouts`)}
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
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 20px; font-weight: 600; text-align: center;">
                  Habit Check-in
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  You have <strong style="color: ${colors.textPrimary};">${data.pendingCount} habits</strong> left to complete today. Keep your streak going!
                </p>
                ${renderButton('Log Habits', `${data.appUrl}/habits`)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `),
  }),

  // NEW: Zero Logs Email - "Hey {name}, everything okay?"
  'habit-zero-logs': (data) => {
    const previousStreak = Number(data.previousStreak) || 0
    const quotes = [
      "The best time to start was yesterday. The second best time is now.",
      "Small daily improvements are the key to staggering long-term results.",
      "You don't have to be perfect. You just have to show up.",
      "Progress, not perfection.",
      "Every expert was once a beginner who refused to give up.",
    ]
    const quote = quotes[Math.floor(Math.random() * quotes.length)]

    return {
      subject: `👋 Hey ${data.name}, everything okay?`,
      html: wrapInTemplate(`
        ${renderLogo()}
        <tr>
          <td>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
              <tr>
                <td style="padding: 32px 24px;">
                  <!-- Wave emoji -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding-bottom: 16px;">
                        <span style="font-size: 56px;">👋</span>
                      </td>
                    </tr>
                  </table>

                  <!-- Headline -->
                  <h1 style="margin: 0 0 12px; color: ${colors.textPrimary}; font-size: 26px; font-weight: 700; text-align: center; line-height: 1.3;">
                    Hey ${data.name}, everything okay?
                  </h1>
                  <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                    I noticed you haven't logged any habits this week. Life happens — but let's not let the week slip away.
                  </p>

                  <!-- Week Progress Card -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCardDark}" style="background-color: ${colors.bgCardDark}; border-radius: 16px; margin-bottom: 24px;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 16px; color: ${colors.textMuted}; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; text-align: center;">
                          THIS WEEK
                        </p>
                        ${renderEmptyWeekDays()}
                        ${previousStreak > 0 ? `
                        <!-- Streak Ended Notice -->
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#1e1e2e" style="background-color: #1e1e2e; border-radius: 12px; margin-top: 16px;">
                          <tr>
                            <td style="padding: 14px 16px;">
                              <table role="presentation" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td style="padding-right: 12px; vertical-align: middle;">
                                    <span style="font-size: 20px; opacity: 0.5;">🔥</span>
                                  </td>
                                  <td style="vertical-align: middle;">
                                    <p style="margin: 0 0 2px; color: ${colors.textMuted}; font-size: 13px;">
                                      Your <span style="color: ${colors.textSecondary}; font-weight: 600;">${previousStreak}-day streak</span> ended
                                    </p>
                                    <p style="margin: 0; color: ${colors.textDark}; font-size: 12px;">
                                      But you can start fresh right now
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        ` : ''}
                      </td>
                    </tr>
                  </table>

                  <!-- Quote Card -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                    <tr>
                      <td bgcolor="#1a1625" style="background-color: #1a1625; border-radius: 14px; padding: 20px; border: 1px solid #2d2640;">
                        <p style="margin: 0; color: #e2e8f0; font-size: 15px; line-height: 1.6; font-style: italic; text-align: center;">
                          "${quote}"
                        </p>
                      </td>
                    </tr>
                  </table>

                  ${renderButton('Start Fresh Today →', `${data.appUrl}/habits`)}

                  <p style="margin: 20px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                    One check-in. That's all it takes.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Help Section -->
        <tr>
          <td style="padding-top: 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 14px; border: 1px solid ${colors.border};">
              <tr>
                <td style="padding: 16px 20px; text-align: center;">
                  <p style="margin: 0; color: ${colors.textSecondary}; font-size: 13px;">
                    Struggling? <a href="${data.appUrl}/messages" style="color: ${colors.purpleLight}; text-decoration: none; font-weight: 600;">Message your coach →</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top: 24px; text-align: center;">
            <p style="margin: 0; color: ${colors.textDark}; font-size: 12px;">
              <a href="${data.appUrl}/settings" style="color: ${colors.textDark}; text-decoration: underline;">Manage reminder preferences</a>
            </p>
          </td>
        </tr>
      `, `Hey ${data.name}, I noticed you haven't logged any habits this week...`),
    }
  },

  // NEW: Halfway There Email - "You're halfway there, {name}!"
  'habit-halfway': (data) => {
    const logged = Number(data.logged) || 0
    const goal = Number(data.goal) || 7
    const streak = Number(data.streak) || 0
    const hoursLeft = Number(data.hoursLeft) || 24
    const habitsComplete = Array.isArray(data.habitsComplete) ? data.habitsComplete : []
    const habitsIncomplete = Array.isArray(data.habitsIncomplete) ? data.habitsIncomplete : []

    // Render habit pills
    const renderHabitPills = (habits: string[], done: boolean) => {
      if (habits.length === 0) return ''
      return habits.map(habit => `
        <span style="display: inline-block; background-color: ${done ? 'rgba(16, 185, 129, 0.2)' : colors.bgHover}; color: ${done ? colors.green : colors.textSecondary}; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: ${done ? 600 : 500}; margin: 3px;">
          ${habit}
        </span>
      `).join('')
    }

    return {
      subject: `⚡ You're halfway there — finish strong!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="dark">
        </head>
        <body style="margin: 0; padding: 0; background-color: ${colors.bgPrimary}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">You're ${logged}/${goal} days — don't stop now!</div>

          <!-- Amber Gradient Header Banner -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.amber}" style="background-color: ${colors.amber};">
            <tr>
              <td align="center" style="padding: 32px 20px 56px;">
                <!-- Logo on banner -->
                <p style="margin: 0 0 20px; font-size: 14px; font-weight: 700; font-style: italic; color: rgba(255,255,255,0.85); letter-spacing: 1px;">
                  SWEAR STRENGTH
                </p>
                <!-- Lightning bolt -->
                <div style="font-size: 40px; margin-bottom: 12px;">⚡</div>
                <!-- Headline -->
                <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700; color: white;">
                  You're halfway there, ${data.name}!
                </h1>
                <!-- Subtext -->
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 15px;">
                  Don't stop now — finish strong
                </p>
              </td>
            </tr>
          </table>

          <!-- Main Content Area -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary};">
            <tr>
              <td align="center" style="padding: 0 20px 40px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 500px;">
                  <!-- Progress Card (Overlapping) -->
                  <tr>
                    <td style="padding-top: 0;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border}; margin-top: -32px;">
                        <tr>
                          <td style="padding: 24px;">
                            ${renderProgressBar(logged, goal)}

                            <!-- Split View: Done vs To Log -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <!-- Done section -->
                                <td width="48%" valign="top" bgcolor="#0d261a" style="background-color: #0d261a; border-radius: 12px; padding: 14px;">
                                  <p style="margin: 0 0 8px; color: ${colors.green}; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
                                    ✓ DONE
                                  </p>
                                  <div>
                                    ${habitsComplete.length > 0 ? renderHabitPills(habitsComplete as string[], true) : `<span style="color: ${colors.textMuted}; font-size: 12px;">—</span>`}
                                  </div>
                                </td>
                                <td width="4%"></td>
                                <!-- To Log section -->
                                <td width="48%" valign="top" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 12px; padding: 14px;">
                                  <p style="margin: 0 0 8px; color: ${colors.amber}; font-size: 11px; font-weight: 700; letter-spacing: 0.5px;">
                                    ○ TO LOG
                                  </p>
                                  <div>
                                    ${habitsIncomplete.length > 0 ? renderHabitPills(habitsIncomplete as string[], false) : `<span style="color: ${colors.textMuted}; font-size: 12px;">All done!</span>`}
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Streak Card -->
                  ${streak > 0 ? `
                  <tr>
                    <td style="padding-top: 16px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 14px; border: 1px solid ${colors.border};">
                        <tr>
                          <td style="padding: 18px 20px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="vertical-align: middle;">
                                  <table role="presentation" cellspacing="0" cellpadding="0">
                                    <tr>
                                      <td style="padding-right: 10px; vertical-align: middle;">
                                        <span style="font-size: 24px;">🔥</span>
                                      </td>
                                      <td style="vertical-align: middle;">
                                        <p style="margin: 0; color: white; font-weight: 700; font-size: 15px;">
                                          ${streak}-day streak
                                        </p>
                                        <p style="margin: 0; color: ${colors.textMuted}; font-size: 12px;">
                                          Keep it going!
                                        </p>
                                      </td>
                                    </tr>
                                  </table>
                                </td>
                                <td align="right" style="vertical-align: middle;">
                                  <span style="display: inline-block; background-color: rgba(16, 185, 129, 0.2); color: ${colors.green}; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">
                                    ACTIVE
                                  </span>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}

                  <!-- Urgency Card -->
                  <tr>
                    <td style="padding-top: 16px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#1f1418" style="background-color: #1f1418; border-radius: 14px; border: 1px solid #3d2025;">
                        <tr>
                          <td style="padding: 16px 18px;">
                            <table role="presentation" cellspacing="0" cellpadding="0">
                              <tr>
                                <td style="padding-right: 12px; vertical-align: middle;">
                                  <span style="font-size: 22px;">⏰</span>
                                </td>
                                <td style="vertical-align: middle;">
                                  <p style="margin: 0; color: #f87171; font-weight: 700; font-size: 14px;">
                                    ${hoursLeft} hours until this week locks
                                  </p>
                                  <p style="margin: 0; color: ${colors.textSecondary}; font-size: 13px;">
                                    Log remaining habits to hit 100%
                                  </p>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- CTA Button -->
                  <tr>
                    <td style="padding-top: 24px;">
                      ${renderButton('Finish Strong →', `${data.appUrl}/habits`)}
                    </td>
                  </tr>

                  <!-- Helper text -->
                  <tr>
                    <td style="padding-top: 16px; text-align: center;">
                      <p style="margin: 0; color: ${colors.textMuted}; font-size: 13px;">
                        2 minutes. That's all it takes.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding-top: 32px; text-align: center;">
                      <p style="margin: 0; color: ${colors.textDark}; font-size: 12px;">
                        <a href="${data.appUrl}/settings" style="color: ${colors.textDark}; text-decoration: underline;">Manage reminders</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    }
  },

  'weekly-summary': (data) => ({
    subject: `Your weekly summary is ready`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 24px; color: ${colors.textPrimary}; font-size: 20px; font-weight: 600; text-align: center;">
                  Weekly Summary
                </h2>

                <!-- Stats Grid -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                  <tr>
                    <td width="48%" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 12px; padding: 16px; text-align: center;">
                      <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase;">Workouts</p>
                      <p style="margin: 0; color: ${colors.green}; font-size: 24px; font-weight: 700;">${data.workoutsCompleted}/${data.workoutsTotal}</p>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 12px; padding: 16px; text-align: center;">
                      <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px; text-transform: uppercase;">Habits</p>
                      <p style="margin: 0; color: ${colors.purple}; font-size: 24px; font-weight: 700;">${data.habitsCompletionRate}%</p>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 14px; text-align: center;">
                  ${Number(data.workoutsCompleted) >= Number(data.workoutsTotal) ? 'Amazing work this week! You crushed all your workouts.' : 'Keep pushing! Every workout counts.'}
                </p>

                ${renderButton('View Details', `${data.appUrl}/dashboard`)}
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
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 20px; font-weight: 600; text-align: center;">
                  ${data.title}
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  ${data.message}
                </p>
                ${data.ctaUrl ? renderButton(String(data.ctaText) || 'View', String(data.ctaUrl)) : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `),
  }),

  // Rivalry nudge - sent when someone pokes their rival
  'rivalry-nudge': (data) => ({
    subject: `${data.senderName} nudged you in your rivalry!`,
    html: wrapInTemplate(`
      ${renderLogo()}
      <tr>
        <td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgCard}" style="background-color: ${colors.bgCard}; border-radius: 20px; border: 1px solid ${colors.border};">
            <tr>
              <td style="padding: 40px;">
                <!-- Poke emoji -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <span style="font-size: 56px;">👊</span>
                    </td>
                  </tr>
                </table>

                <h2 style="margin: 0 0 16px; color: ${colors.textPrimary}; font-size: 22px; font-weight: 700; text-align: center;">
                  ${data.senderName} nudged you!
                </h2>
                <p style="margin: 0 0 24px; color: ${colors.textSecondary}; font-size: 16px; line-height: 1.6; text-align: center;">
                  Your rival is calling you out on <strong style="color: ${colors.amber};">${data.habitName}</strong>. Don't let them get ahead!
                </p>

                <!-- Score comparison -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.bgPrimary}" style="background-color: ${colors.bgPrimary}; border-radius: 14px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 20px;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                        <tr>
                          <td width="45%" align="center">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px;">You</p>
                            <p style="margin: 0; color: ${colors.textPrimary}; font-size: 28px; font-weight: 700;">${data.recipientScore}%</p>
                          </td>
                          <td width="10%" align="center">
                            <p style="margin: 0; color: ${colors.red}; font-size: 14px; font-weight: 700;">VS</p>
                          </td>
                          <td width="45%" align="center">
                            <p style="margin: 0 0 4px; color: ${colors.textMuted}; font-size: 12px;">${data.senderName}</p>
                            <p style="margin: 0; color: ${colors.amber}; font-size: 28px; font-weight: 700;">${data.senderScore}%</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="margin: 0 0 24px; color: ${colors.textMuted}; font-size: 14px; text-align: center;">
                  ${Number(data.daysLeft)} days left in the rivalry
                </p>

                ${renderButton('Log Your Habit Now', `${data.appUrl}/rivalry/${data.rivalryId}`, colors.amber)}

                <p style="margin: 24px 0 0; color: ${colors.textMuted}; font-size: 13px; text-align: center;">
                  Show them what you're made of.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `, `${data.senderName} is calling you out! Don't let them win.`),
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
