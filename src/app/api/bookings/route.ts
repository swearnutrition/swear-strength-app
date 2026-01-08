import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent } from '@/lib/google/calendar'
import type { CreateBookingPayload } from '@/types/booking'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const status = searchParams.get('status')
  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. Build query based on role
  try {
    // Note: Using inner:false would make it a left join, but Supabase handles nullable FKs automatically
    let query = supabase
      .from('bookings')
      .select(`
        *,
        package:session_packages(id, total_sessions, remaining_sessions, session_duration_minutes)
      `)
      .order('starts_at', { ascending: true })

    if (profile?.role === 'coach') {
      query = query.eq('coach_id', user.id)
      if (clientId) {
        query = query.eq('client_id', clientId)
      }
    } else {
      // Client can only see their own bookings
      query = query.eq('client_id', user.id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (fromDate) {
      query = query.gte('starts_at', fromDate)
    }

    if (toDate) {
      query = query.lte('starts_at', toDate)
    }

    const { data: bookings, error } = await query

    if (error) throw error

    // Fetch client info separately for bookings with client_id
    const clientIds = [...new Set((bookings || [])
      .filter(b => b.client_id)
      .map(b => b.client_id))]

    let clientsMap: Record<string, { id: string; name: string; email: string; avatar_url: string | null }> = {}

    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .in('id', clientIds)

      if (clients) {
        clientsMap = Object.fromEntries(clients.map(c => [c.id, c]))
      }
    }

    // Transform bookings from snake_case to camelCase and attach client info
    const bookingsWithClients = (bookings || []).map(booking => {
      const client = booking.client_id ? clientsMap[booking.client_id] || null : null
      return {
        id: booking.id,
        clientId: booking.client_id,
        coachId: booking.coach_id,
        packageId: booking.package_id,
        subscriptionId: booking.subscription_id,
        bookingType: booking.booking_type,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        status: booking.status,
        googleEventId: booking.google_event_id,
        googleMeetLink: booking.google_meet_link,
        rescheduledFromId: booking.rescheduled_from_id,
        cancelledAt: booking.cancelled_at,
        oneOffClientName: booking.one_off_client_name,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        client: client ? {
          id: client.id,
          name: client.name,
          email: client.email,
          avatarUrl: client.avatar_url,
        } : null,
        package: booking.package ? {
          id: booking.package.id,
          totalSessions: booking.package.total_sessions,
          remainingSessions: booking.package.remaining_sessions,
          sessionDurationMinutes: booking.package.session_duration_minutes,
        } : null,
      }
    })

    console.log('Bookings API Debug:', {
      fromDate,
      toDate,
      totalBookings: bookingsWithClients.length,
      sampleBooking: bookingsWithClients[0] ? {
        id: bookingsWithClients[0].id,
        startsAt: bookingsWithClients[0].startsAt,
        clientId: bookingsWithClients[0].clientId,
        oneOffClientName: bookingsWithClients[0].oneOffClientName,
        status: bookingsWithClients[0].status,
      } : null
    })

    return NextResponse.json({ bookings: bookingsWithClients })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. Parse request body
  let payload: CreateBookingPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 4. Validate required fields
  if (!payload.startsAt || !payload.endsAt || !payload.bookingType) {
    return NextResponse.json(
      { error: 'Missing required fields: startsAt, endsAt, bookingType' },
      { status: 400 }
    )
  }

  // Check if this is a one-off booking
  const isOneOff = payload.isOneOff || !!payload.oneOffClientName
  // Check if this is a pending client booking
  const isPendingClientBooking = !!payload.inviteId

  // 5. Determine client and coach IDs
  let clientId: string | null = null
  let coachId: string
  let oneOffClientName: string | null = null
  let inviteId: string | null = null

  if (profile?.role === 'coach') {
    if (isPendingClientBooking) {
      // Pending client booking - verify invite exists and belongs to this coach
      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .select('id, created_by')
        .eq('id', payload.inviteId)
        .is('accepted_at', null)
        .single()

      if (inviteError || !invite || invite.created_by !== user.id) {
        return NextResponse.json(
          { error: 'Invalid pending client' },
          { status: 400 }
        )
      }
      inviteId = payload.inviteId!
      coachId = user.id
    } else if (isOneOff) {
      // One-off booking - no client account required
      if (!payload.oneOffClientName?.trim()) {
        return NextResponse.json(
          { error: 'One-off booking requires a client name' },
          { status: 400 }
        )
      }
      oneOffClientName = payload.oneOffClientName.trim()
      coachId = user.id
    } else {
      // Regular booking - client must be specified
      if (!payload.clientId) {
        return NextResponse.json(
          { error: 'Coach must specify clientId for regular bookings' },
          { status: 400 }
        )
      }
      clientId = payload.clientId
      coachId = user.id
    }
  } else {
    // Client booking for themselves (can't be one-off)
    if (isOneOff) {
      return NextResponse.json(
        { error: 'Only coaches can create one-off bookings' },
        { status: 403 }
      )
    }
    clientId = user.id
    // Get the coach ID from their package or existing relationship
    const { data: existingPackage } = await supabase
      .from('session_packages')
      .select('coach_id')
      .eq('client_id', user.id)
      .limit(1)
      .single()

    if (!existingPackage) {
      return NextResponse.json(
        { error: 'No coach relationship found' },
        { status: 400 }
      )
    }
    coachId = existingPackage.coach_id
  }

  // 6. For sessions, find session source (subscription or package)
  // Priority: 1. Hybrid subscription  2. Prepaid package  3. No deduction
  let packageId: string | null = null
  let subscriptionId: string | null = null

  if (payload.bookingType === 'session' && !isOneOff) {
    if (payload.packageId) {
      // Explicit package specified
      packageId = payload.packageId
    } else if (clientId || inviteId) {
      // First, check for active hybrid subscription with available sessions
      let subscriptionQuery = supabase
        .from('client_subscriptions')
        .select('id, available_sessions')
        .eq('coach_id', coachId)
        .eq('subscription_type', 'hybrid')
        .eq('is_active', true)
        .gt('available_sessions', 0)
        .limit(1)

      if (clientId) {
        subscriptionQuery = subscriptionQuery.eq('client_id', clientId)
      } else if (inviteId) {
        subscriptionQuery = subscriptionQuery.eq('invite_id', inviteId)
      }

      const { data: activeSubscription } = await subscriptionQuery.single()

      if (activeSubscription) {
        subscriptionId = activeSubscription.id
      } else {
        // Fall back to prepaid package
        let packageQuery = supabase
          .from('session_packages')
          .select('id, remaining_sessions')
          .eq('coach_id', coachId)
          .gt('remaining_sessions', 0)
          .or('expires_at.is.null,expires_at.gt.now()')
          .order('created_at', { ascending: true })
          .limit(1)

        if (clientId) {
          packageQuery = packageQuery.eq('client_id', clientId)
        } else if (inviteId) {
          packageQuery = packageQuery.eq('invite_id', inviteId)
        }

        const { data: activePackage } = await packageQuery.single()

        if (activePackage) {
          packageId = activePackage.id
        }
      }
      // No error if no subscription or package - coaches can book sessions without requiring either
    }
  }

  // 7. For check-ins, verify monthly usage (one-off can't have check-ins)
  if (payload.bookingType === 'checkin') {
    if (isOneOff) {
      return NextResponse.json(
        { error: 'One-off bookings cannot be check-ins' },
        { status: 400 }
      )
    }

    const startOfMonth = new Date(payload.startsAt)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const monthStr = startOfMonth.toISOString().split('T')[0]

    const { data: usage } = await supabase
      .from('client_checkin_usage')
      .select('used')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .eq('month', monthStr)
      .single()

    if (usage?.used) {
      return NextResponse.json(
        { error: 'Monthly check-in already used' },
        { status: 400 }
      )
    }
  }

  // 8. Check minimum notice (12 hours for clients)
  if (profile?.role === 'client') {
    const { data: settings } = await supabase
      .from('coach_booking_settings')
      .select('min_notice_hours')
      .eq('coach_id', coachId)
      .single()

    const minNotice = settings?.min_notice_hours || 12
    const bookingTime = new Date(payload.startsAt)
    const minAllowedTime = new Date()
    minAllowedTime.setHours(minAllowedTime.getHours() + minNotice)

    if (bookingTime < minAllowedTime) {
      return NextResponse.json(
        { error: `Bookings require ${minNotice} hours notice` },
        { status: 400 }
      )
    }
  }

  // 9. Create the booking
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        coach_id: coachId,
        package_id: packageId,
        subscription_id: subscriptionId,
        booking_type: payload.bookingType,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
        status: 'confirmed',
        one_off_client_name: oneOffClientName,
        invite_id: inviteId,
      })
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        invite:invites!invite_id(id, name, email)
      `)
      .single()

    if (error) throw error

    // 10. Deduct session from subscription or package
    if (payload.bookingType === 'session') {
      if (subscriptionId) {
        await supabase.rpc('decrement_subscription_session', { p_subscription_id: subscriptionId })
      } else if (packageId) {
        await supabase.rpc('decrement_session', { package_id: packageId })
      }
    }

    // 11. Mark check-in usage if check-in type
    if (payload.bookingType === 'checkin') {
      const startOfMonth = new Date(payload.startsAt)
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthStr = startOfMonth.toISOString().split('T')[0]

      await supabase
        .from('client_checkin_usage')
        .upsert({
          client_id: clientId,
          coach_id: coachId,
          month: monthStr,
          used: true,
          booking_id: booking.id,
        })
    }

    // 12. Create Google Calendar event
    // Determine client name and email based on booking type
    const clientName = isPendingClientBooking
      ? booking.invite?.name || 'Pending Client'
      : isOneOff
        ? oneOffClientName
        : booking.client?.name || 'Client'
    const clientEmail = isPendingClientBooking
      ? booking.invite?.email
      : isOneOff
        ? undefined
        : booking.client?.email

    console.log('[Create Booking] Creating calendar event:', {
      coachId,
      clientName,
      clientEmail,
      bookingType: payload.bookingType,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
    })

    const bookingLabel = isPendingClientBooking ? ' (Pending client)' : isOneOff ? ' (One-off booking)' : ''
    const calendarEvent = await createCalendarEvent(coachId, {
      summary: `${payload.bookingType === 'checkin' ? 'Check-in' : 'Training Session'}: ${clientName}`,
      description: `${payload.bookingType === 'checkin' ? 'Monthly check-in' : 'Training session'} with ${clientName}${bookingLabel}`,
      startTime: payload.startsAt,
      endTime: payload.endsAt,
      attendeeEmail: clientEmail,
      attendeeName: clientName,
    })

    if (calendarEvent) {
      console.log('[Create Booking] Calendar event created:', calendarEvent.id)
    } else {
      console.log('[Create Booking] Calendar event NOT created - check Google credentials')
    }

    // Update booking with Google Calendar info if event was created
    if (calendarEvent) {
      await supabase
        .from('bookings')
        .update({
          google_event_id: calendarEvent.id,
          google_meet_link: calendarEvent.hangoutLink || null,
        })
        .eq('id', booking.id)

      // Update local booking object for response
      booking.google_event_id = calendarEvent.id
      booking.google_meet_link = calendarEvent.hangoutLink || null
    }

    // TODO: Send notifications

    // Transform to camelCase for frontend
    const transformedBooking = {
      id: booking.id,
      clientId: booking.client_id,
      coachId: booking.coach_id,
      packageId: booking.package_id,
      subscriptionId: booking.subscription_id,
      bookingType: booking.booking_type,
      startsAt: booking.starts_at,
      endsAt: booking.ends_at,
      status: booking.status,
      googleEventId: booking.google_event_id,
      googleMeetLink: booking.google_meet_link,
      rescheduledFromId: booking.rescheduled_from_id,
      cancelledAt: booking.cancelled_at,
      oneOffClientName: booking.one_off_client_name,
      inviteId: booking.invite_id,
      createdAt: booking.created_at,
      updatedAt: booking.updated_at,
      client: booking.client ? {
        id: booking.client.id,
        name: booking.client.name,
        email: booking.client.email,
        avatarUrl: booking.client.avatar_url,
      } : null,
      invite: booking.invite ? {
        id: booking.invite.id,
        name: booking.invite.name,
        email: booking.invite.email,
      } : null,
    }

    return NextResponse.json({ booking: transformedBooking }, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create booking' },
      { status: 500 }
    )
  }
}
