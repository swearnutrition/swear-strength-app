import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    let query = supabase
      .from('bookings')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        package:session_packages(id, total_sessions, remaining_sessions, session_duration_minutes),
        formResponse:checkin_form_responses(id, responses, submitted_at)
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

    return NextResponse.json({ bookings: bookings || [] })
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

  // 5. Determine client and coach IDs
  let clientId: string
  let coachId: string

  if (profile?.role === 'coach') {
    if (!payload.clientId) {
      return NextResponse.json(
        { error: 'Coach must specify clientId' },
        { status: 400 }
      )
    }
    clientId = payload.clientId
    coachId = user.id
  } else {
    // Client booking for themselves
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

  // 6. For sessions, validate package
  let packageId: string | null = null
  if (payload.bookingType === 'session') {
    if (payload.packageId) {
      packageId = payload.packageId
    } else {
      // Find active package for client
      const { data: activePackage } = await supabase
        .from('session_packages')
        .select('id, remaining_sessions')
        .eq('client_id', clientId)
        .eq('coach_id', coachId)
        .gt('remaining_sessions', 0)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!activePackage) {
        return NextResponse.json(
          { error: 'No active session package found' },
          { status: 400 }
        )
      }
      packageId = activePackage.id
    }
  }

  // 7. For check-ins, verify monthly usage
  if (payload.bookingType === 'checkin') {
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
        booking_type: payload.bookingType,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
        status: 'confirmed',
      })
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url)
      `)
      .single()

    if (error) throw error

    // 10. Deduct session from package if session type
    if (payload.bookingType === 'session' && packageId) {
      await supabase.rpc('decrement_session', { package_id: packageId })
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

    // TODO: Create Google Calendar event
    // TODO: Send notifications

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create booking' },
      { status: 500 }
    )
  }
}
