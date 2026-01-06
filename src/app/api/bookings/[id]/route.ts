import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BookingStatus } from '@/types/booking'

// GET single booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        package:session_packages(id, total_sessions, remaining_sessions, session_duration_minutes),
        formResponse:checkin_form_responses(id, responses, submitted_at)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    // Verify access
    if (booking.coach_id !== user.id && booking.client_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ booking })
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch booking' },
      { status: 500 }
    )
  }
}

// PATCH - Update status (cancel, complete, no-show) or reschedule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let payload: {
    status?: BookingStatus
    startsAt?: string
    endsAt?: string
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Get current booking
  const { data: currentBooking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentBooking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Verify access
  if (currentBooking.coach_id !== user.id && currentBooking.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Handle status change
    if (payload.status) {
      const updates: Record<string, unknown> = { status: payload.status }

      if (payload.status === 'cancelled') {
        updates.cancelled_at = new Date().toISOString()

        // Refund session if session type and was confirmed
        if (
          currentBooking.booking_type === 'session' &&
          currentBooking.package_id &&
          currentBooking.status === 'confirmed'
        ) {
          await supabase.rpc('increment_session', {
            package_id: currentBooking.package_id,
          })
        }

        // Reset check-in usage if check-in type
        if (currentBooking.booking_type === 'checkin') {
          const startOfMonth = new Date(currentBooking.starts_at)
          startOfMonth.setDate(1)
          const monthStr = startOfMonth.toISOString().split('T')[0]

          await supabase
            .from('client_checkin_usage')
            .update({ used: false, booking_id: null })
            .eq('client_id', currentBooking.client_id)
            .eq('coach_id', currentBooking.coach_id)
            .eq('month', monthStr)
        }

        // Update attendance stats
        await updateAttendanceStats(
          supabase,
          currentBooking.client_id,
          currentBooking.coach_id,
          'cancellation'
        )
      }

      if (payload.status === 'no_show') {
        await updateAttendanceStats(
          supabase,
          currentBooking.client_id,
          currentBooking.coach_id,
          'no_show'
        )
      }

      const { data: updatedBooking, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          client:profiles!client_id(id, name, email, avatar_url)
        `)
        .single()

      if (error) throw error

      // TODO: Update/delete Google Calendar event
      // TODO: Send notifications

      return NextResponse.json({ booking: updatedBooking })
    }

    // Handle reschedule
    if (payload.startsAt && payload.endsAt) {
      // Create new booking linked to original
      const { data: newBooking, error: createError } = await supabase
        .from('bookings')
        .insert({
          client_id: currentBooking.client_id,
          coach_id: currentBooking.coach_id,
          package_id: currentBooking.package_id,
          booking_type: currentBooking.booking_type,
          starts_at: payload.startsAt,
          ends_at: payload.endsAt,
          status: 'confirmed',
          rescheduled_from_id: id,
        })
        .select(`
          *,
          client:profiles!client_id(id, name, email, avatar_url)
        `)
        .single()

      if (createError) throw createError

      // Cancel old booking (but don't refund since it's a reschedule)
      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id)

      // TODO: Update Google Calendar event
      // TODO: Send reschedule notification

      return NextResponse.json({ booking: newBooking })
    }

    return NextResponse.json({ error: 'No valid update provided' }, { status: 400 })
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update booking' },
      { status: 500 }
    )
  }
}

// Helper to update attendance stats
async function updateAttendanceStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  coachId: string,
  type: 'cancellation' | 'no_show'
) {
  // Get or create stats record
  const { data: stats } = await supabase
    .from('client_booking_stats')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Count incidents in last 90 days
  const { count: noShowCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .eq('status', 'no_show')
    .gte('updated_at', ninetyDaysAgo.toISOString())

  const { count: cancelCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .eq('status', 'cancelled')
    .gte('cancelled_at', ninetyDaysAgo.toISOString())

  const isFlagged = (noShowCount || 0) >= 3 || (cancelCount || 0) >= 3

  await supabase
    .from('client_booking_stats')
    .upsert({
      client_id: clientId,
      coach_id: coachId,
      no_show_count_90d: noShowCount || 0,
      cancellation_count_90d: cancelCount || 0,
      is_flagged: isFlagged,
      ...(stats ? {} : { current_streak_weeks: 0, longest_streak_weeks: 0 }),
    })
}
