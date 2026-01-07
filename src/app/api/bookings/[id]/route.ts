import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/google/calendar'
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
          console.log('[Cancel Booking] Refunding session for package:', currentBooking.package_id)
          const { error: rpcError } = await supabase.rpc('increment_session', {
            package_id: currentBooking.package_id,
          })
          if (rpcError) {
            console.error('[Cancel Booking] Failed to increment session:', rpcError)
          } else {
            console.log('[Cancel Booking] Session refunded successfully')
          }
        } else {
          console.log('[Cancel Booking] Not refunding session. booking_type:', currentBooking.booking_type, 'package_id:', currentBooking.package_id, 'status:', currentBooking.status)
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

      // Delete Google Calendar event if cancelled
      if (payload.status === 'cancelled' && currentBooking.google_event_id) {
        await deleteCalendarEvent(currentBooking.coach_id, currentBooking.google_event_id)
      }

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
          one_off_client_name: currentBooking.one_off_client_name,
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

      // Handle Google Calendar: delete old event and create new one
      // This sends cancellation email for old event and new invite for new event
      if (currentBooking.google_event_id) {
        await deleteCalendarEvent(currentBooking.coach_id, currentBooking.google_event_id)
      }

      // Create new Google Calendar event
      const isOneOff = !!currentBooking.one_off_client_name
      const clientName = isOneOff
        ? currentBooking.one_off_client_name
        : newBooking.client?.name || 'Client'
      const clientEmail = isOneOff ? undefined : newBooking.client?.email

      const calendarEvent = await createCalendarEvent(currentBooking.coach_id, {
        summary: `${currentBooking.booking_type === 'checkin' ? 'Check-in' : 'Training Session'}: ${clientName} (Rescheduled)`,
        description: `${currentBooking.booking_type === 'checkin' ? 'Monthly check-in' : 'Training session'} with ${clientName}${isOneOff ? ' (One-off booking)' : ''}\n\nRescheduled from original booking.`,
        startTime: payload.startsAt,
        endTime: payload.endsAt,
        attendeeEmail: clientEmail,
        attendeeName: clientName,
      })

      // Update new booking with Google Calendar info
      if (calendarEvent) {
        await supabase
          .from('bookings')
          .update({
            google_event_id: calendarEvent.id,
            google_meet_link: calendarEvent.hangoutLink || null,
          })
          .eq('id', newBooking.id)

        newBooking.google_event_id = calendarEvent.id
        newBooking.google_meet_link = calendarEvent.hangoutLink || null
      }

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

// DELETE - Permanently delete a booking (coaches only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only coaches can delete bookings
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Only coaches can delete bookings' }, { status: 403 })
  }

  // Get current booking
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Verify coach owns this booking
  if (booking.coach_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Refund session if it was a confirmed session with a package
    if (
      booking.booking_type === 'session' &&
      booking.package_id &&
      booking.status === 'confirmed'
    ) {
      await supabase.rpc('increment_session', {
        package_id: booking.package_id,
      })
    }

    // Reset check-in usage if check-in type
    if (booking.booking_type === 'checkin' && booking.client_id) {
      const startOfMonth = new Date(booking.starts_at)
      startOfMonth.setDate(1)
      const monthStr = startOfMonth.toISOString().split('T')[0]

      await supabase
        .from('client_checkin_usage')
        .update({ used: false, booking_id: null })
        .eq('client_id', booking.client_id)
        .eq('coach_id', booking.coach_id)
        .eq('month', monthStr)
    }

    // Delete Google Calendar event if exists
    if (booking.google_event_id) {
      await deleteCalendarEvent(booking.coach_id, booking.google_event_id)
    }

    // Delete the booking
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete booking' },
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
