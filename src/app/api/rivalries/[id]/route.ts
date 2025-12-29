import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/rivalries/[id] - Update rivalry (cancel, complete, etc.)
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

  const body = await request.json()
  const { action } = body

  // Verify the user owns this rivalry
  const { data: rivalry, error: fetchError } = await supabase
    .from('habit_rivalries')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !rivalry) {
    return NextResponse.json({ error: 'Rivalry not found' }, { status: 404 })
  }

  if (action === 'cancel') {
    // Cancel the rivalry
    const { error } = await supabase
      .from('habit_rivalries')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, status: 'cancelled' })
  }

  if (action === 'complete') {
    // Complete the rivalry and determine winner
    // Get completion counts for both players
    const { data: completions } = await supabase
      .from('habit_completions')
      .select(`
        client_id,
        client_habit_id,
        completed_date,
        client_habits!inner(rivalry_id)
      `)
      .gte('completed_date', rivalry.start_date)
      .lte('completed_date', rivalry.end_date)

    // Filter to this rivalry and count
    const rivalryCompletions = (completions || []).filter(c => {
      const ch = c.client_habits as unknown as { rivalry_id: string } | null
      return ch?.rivalry_id === id
    })

    const challengerCount = rivalryCompletions.filter(c => c.client_id === rivalry.challenger_id).length
    const opponentCount = rivalryCompletions.filter(c => c.client_id === rivalry.opponent_id).length

    // Determine winner (null if tied)
    let winnerId: string | null = null
    if (challengerCount > opponentCount) {
      winnerId = rivalry.challenger_id
    } else if (opponentCount > challengerCount) {
      winnerId = rivalry.opponent_id
    }
    // If tied, winner_id stays null

    const { error } = await supabase
      .from('habit_rivalries')
      .update({
        status: 'completed',
        winner_id: winnerId
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      status: 'completed',
      winner_id: winnerId,
      scores: {
        challenger: challengerCount,
        opponent: opponentCount
      }
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

// DELETE /api/rivalries/[id] - Delete a rivalry entirely
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

  // First unlink any habits from this rivalry
  await supabase
    .from('client_habits')
    .update({ rivalry_id: null })
    .eq('rivalry_id', id)

  // Delete the rivalry
  const { error } = await supabase
    .from('habit_rivalries')
    .delete()
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
