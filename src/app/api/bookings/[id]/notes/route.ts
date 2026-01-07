import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  // Verify user is a coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { notes: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    // Update the booking notes (only if this coach owns the booking)
    const { data: booking, error } = await supabase
      .from('bookings')
      .update({ notes: body.notes })
      .eq('id', id)
      .eq('coach_id', user.id)
      .select()
      .single()

    if (error) throw error

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return NextResponse.json({ booking })
  } catch (error) {
    console.error('Error updating booking notes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update notes' },
      { status: 500 }
    )
  }
}
