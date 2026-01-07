import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Auto-complete past confirmed sessions
export async function POST() {
  const supabase = await createClient()

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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Find all confirmed bookings for this coach where end time has passed
    const now = new Date().toISOString()

    const { data: pastBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, ends_at, booking_type')
      .eq('coach_id', user.id)
      .eq('status', 'confirmed')
      .lt('ends_at', now)

    if (fetchError) throw fetchError

    if (!pastBookings || pastBookings.length === 0) {
      return NextResponse.json({ updated: 0, bookingIds: [] })
    }

    // Update all past confirmed bookings to completed
    const bookingIds = pastBookings.map(b => b.id)

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .in('id', bookingIds)

    if (updateError) throw updateError

    return NextResponse.json({
      updated: bookingIds.length,
      bookingIds
    })
  } catch (error) {
    console.error('Error auto-completing bookings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-complete bookings' },
      { status: 500 }
    )
  }
}
