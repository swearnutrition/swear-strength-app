import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]

export async function GET() {
  const supabase = await createClient()

  // 1. Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify user is a coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Only coaches can connect Google Calendar' }, { status: 403 })
  }

  // 3. Generate CSRF state token
  const state = randomBytes(32).toString('hex')

  // 4. Store state in cookie for validation in callback
  const cookieStore = await cookies()
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  })

  // 5. Build OAuth URL
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state: state,
    access_type: 'offline',
    prompt: 'consent', // Force consent to ensure we get refresh token
  })

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`

  // 6. Redirect to Google consent screen
  return NextResponse.redirect(authUrl)
}
