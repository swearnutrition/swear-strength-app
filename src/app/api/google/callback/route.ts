import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GoogleTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!
  const settingsUrl = `${appUrl}/coach/settings`

  // 1. Handle OAuth errors
  if (error) {
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(`${settingsUrl}?error=google_oauth_denied`)
  }

  // 2. Validate required params
  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?error=google_oauth_invalid`)
  }

  // 3. Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('google_oauth_state')?.value

  if (!storedState || storedState !== state) {
    console.error('CSRF state mismatch')
    return NextResponse.redirect(`${settingsUrl}?error=google_oauth_csrf`)
  }

  // 4. Clear state cookie
  cookieStore.delete('google_oauth_state')

  // 5. Verify user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?redirect=${encodeURIComponent('/coach/settings')}`)
  }

  // 6. Verify user is a coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.redirect(`${settingsUrl}?error=google_oauth_forbidden`)
  }

  // 7. Exchange code for tokens
  const redirectUri = `${appUrl}/api/google/callback`

  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Google token exchange failed:', errorData)
      return NextResponse.redirect(`${settingsUrl}?error=google_oauth_token_failed`)
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json()

    if (!tokens.access_token) {
      console.error('No access token in response')
      return NextResponse.redirect(`${settingsUrl}?error=google_oauth_no_token`)
    }

    // 8. Calculate token expiry
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000)

    // 9. Store credentials in database (upsert)
    const { error: dbError } = await supabase
      .from('google_calendar_credentials')
      .upsert(
        {
          coach_id: user.id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || '',
          token_expiry: tokenExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'coach_id',
        }
      )

    if (dbError) {
      console.error('Failed to store credentials:', dbError)
      return NextResponse.redirect(`${settingsUrl}?error=google_oauth_db_failed`)
    }

    // 10. Redirect to settings with success
    return NextResponse.redirect(`${settingsUrl}?google_connected=true`)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return NextResponse.redirect(`${settingsUrl}?error=google_oauth_failed`)
  }
}
