import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setupCalendarWatch } from '@/lib/google/calendar-sync'

/**
 * Manually set up a calendar watch for a coach who already has Google Calendar connected.
 * This is useful for existing users who connected before webhook support was added.
 */
export async function POST() {
  const supabase = await createClient()

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Only coaches can set up calendar watch' }, { status: 403 })
  }

  // Verify user has Google Calendar connected
  const { data: creds } = await supabase
    .from('google_calendar_credentials')
    .select('id')
    .eq('coach_id', user.id)
    .single()

  if (!creds) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  try {
    const success = await setupCalendarWatch(user.id)

    if (success) {
      return NextResponse.json({ success: true, message: 'Calendar watch set up successfully' })
    } else {
      return NextResponse.json({ error: 'Failed to set up calendar watch' }, { status: 500 })
    }
  } catch (err) {
    console.error('Error setting up calendar watch:', err)
    return NextResponse.json({ error: 'Failed to set up calendar watch' }, { status: 500 })
  }
}
