import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stopCalendarWatch } from '@/lib/google/calendar-sync'

/**
 * Disconnect Google Calendar integration
 * Stops the watch channel and deletes credentials
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
    return NextResponse.json({ error: 'Only coaches can disconnect Google Calendar' }, { status: 403 })
  }

  try {
    // Stop the calendar watch first
    await stopCalendarWatch(user.id)

    // Delete credentials
    const { error } = await supabase
      .from('google_calendar_credentials')
      .delete()
      .eq('coach_id', user.id)

    if (error) {
      console.error('Error deleting Google credentials:', error)
      return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error disconnecting Google Calendar:', err)
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 })
  }
}
