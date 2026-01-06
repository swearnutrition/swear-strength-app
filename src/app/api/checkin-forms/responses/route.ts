import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SubmitCheckinFormPayload } from '@/types/booking'

// POST - Submit client responses for a booking
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: SubmitCheckinFormPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate required fields
  if (!payload.bookingId || !payload.responses) {
    return NextResponse.json(
      { error: 'Missing required fields: bookingId, responses' },
      { status: 400 }
    )
  }

  try {
    // Get the booking to verify access and get coach ID
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        client:profiles!client_id(id, name, email),
        coach:profiles!coach_id(id, name, email)
      `)
      .eq('id', payload.bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Verify the user is the client for this booking
    if (booking.client_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify it's a check-in booking
    if (booking.booking_type !== 'checkin') {
      return NextResponse.json(
        { error: 'Form responses can only be submitted for check-in bookings' },
        { status: 400 }
      )
    }

    // Check if a response already exists for this booking
    const { data: existingResponse } = await supabase
      .from('checkin_form_responses')
      .select('id')
      .eq('booking_id', payload.bookingId)
      .single()

    if (existingResponse) {
      return NextResponse.json(
        { error: 'A response has already been submitted for this booking' },
        { status: 400 }
      )
    }

    // Get the coach's active questions
    const { data: questions, error: questionsError } = await supabase
      .from('checkin_form_questions')
      .select('*')
      .eq('coach_id', booking.coach_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (questionsError) throw questionsError

    // Validate all required questions are answered
    const requiredQuestions = questions?.filter(q => q.is_required) || []
    const missingResponses: string[] = []

    for (const question of requiredQuestions) {
      const response = payload.responses[question.id]
      if (response === undefined || response === null || response === '' ||
          (Array.isArray(response) && response.length === 0)) {
        missingResponses.push(question.question)
      }
    }

    if (missingResponses.length > 0) {
      return NextResponse.json(
        {
          error: 'Missing required responses',
          missingQuestions: missingResponses,
        },
        { status: 400 }
      )
    }

    // Create the form response
    const { data: formResponse, error: insertError } = await supabase
      .from('checkin_form_responses')
      .insert({
        booking_id: payload.bookingId,
        client_id: user.id,
        responses: payload.responses,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Send notification email to coach
    const coachEmail = booking.coach?.email
    const clientName = booking.client?.name || 'A client'

    if (coachEmail) {
      try {
        // Format responses for email
        const formattedResponses = questions?.map(q => {
          const answer = payload.responses[q.id]
          const answerStr = Array.isArray(answer) ? answer.join(', ') : String(answer || 'Not answered')
          return `${q.question}: ${answerStr}`
        }).join('\n') || ''

        await supabase.functions.invoke('send-email', {
          body: {
            to: coachEmail,
            template: 'coach-notification',
            data: {
              subject: `Check-in form submitted by ${clientName}`,
              title: 'New Check-in Form Submitted',
              message: `${clientName} has submitted their check-in form for their upcoming appointment.\n\n${formattedResponses}`,
              ctaText: 'View Booking',
              ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.swearstrength.com'}/coach/bookings/${payload.bookingId}`,
            },
          },
        })
      } catch (emailError) {
        // Log but don't fail the request if email fails
        console.error('Error sending notification email:', emailError)
      }
    }

    return NextResponse.json({ formResponse }, { status: 201 })
  } catch (error) {
    console.error('Error submitting check-in form response:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit response' },
      { status: 500 }
    )
  }
}

// GET - Get responses for a booking (coach or client)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const bookingId = searchParams.get('bookingId')
  const clientId = searchParams.get('clientId')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  try {
    let query = supabase
      .from('checkin_form_responses')
      .select(`
        *,
        booking:bookings(id, starts_at, ends_at, status)
      `)
      .order('submitted_at', { ascending: false })

    if (bookingId) {
      query = query.eq('booking_id', bookingId)
    }

    if (profile?.role === 'coach') {
      // Coach can filter by client
      if (clientId) {
        query = query.eq('client_id', clientId)
      }
      // Coach can see responses for their bookings
      // We need to filter through the booking's coach_id
      const { data: coachBookings } = await supabase
        .from('bookings')
        .select('id')
        .eq('coach_id', user.id)

      const bookingIds = coachBookings?.map(b => b.id) || []
      if (bookingIds.length > 0) {
        query = query.in('booking_id', bookingIds)
      } else {
        return NextResponse.json({ responses: [] })
      }
    } else {
      // Client can only see their own responses
      query = query.eq('client_id', user.id)
    }

    const { data: responses, error } = await query

    if (error) throw error

    return NextResponse.json({ responses: responses || [] })
  } catch (error) {
    console.error('Error fetching check-in form responses:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch responses' },
      { status: 500 }
    )
  }
}
