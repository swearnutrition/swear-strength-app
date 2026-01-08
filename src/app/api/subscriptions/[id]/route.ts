import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UpdateSubscriptionPayload, AdjustSubscriptionPayload } from '@/types/booking'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Verify subscription belongs to this coach
  const { data: existingSubscription } = await supabase
    .from('client_subscriptions')
    .select('id, coach_id, subscription_type, available_sessions, monthly_sessions')
    .eq('id', id)
    .single()

  if (!existingSubscription || existingSubscription.coach_id !== user.id) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  // 4. Parse request body
  let payload: UpdateSubscriptionPayload | AdjustSubscriptionPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 5. Handle adjustment (special case - add/subtract sessions)
  if ('adjustment' in payload) {
    if (existingSubscription.subscription_type !== 'hybrid') {
      return NextResponse.json(
        { error: 'Can only adjust sessions for hybrid subscriptions' },
        { status: 400 }
      )
    }

    const newBalance = (existingSubscription.available_sessions || 0) + payload.adjustment
    if (newBalance < 0) {
      return NextResponse.json(
        { error: 'Cannot reduce balance below zero' },
        { status: 400 }
      )
    }

    // Cap at 2x monthly
    const maxBalance = (existingSubscription.monthly_sessions || 0) * 2
    const cappedBalance = Math.min(newBalance, maxBalance)

    try {
      const { data: updatedSubscription, error } = await supabase
        .from('client_subscriptions')
        .update({
          available_sessions: cappedBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`
          *,
          client:profiles!client_id(id, name, email, avatar_url),
          invite:invites!invite_id(id, name, email)
        `)
        .single()

      if (error) throw error

      return NextResponse.json({
        subscription: transformSubscription(updatedSubscription),
        adjustment: {
          requested: payload.adjustment,
          applied: cappedBalance - (existingSubscription.available_sessions || 0),
          wasCapped: cappedBalance < newBalance,
        },
      })
    } catch (error) {
      console.error('Error adjusting subscription:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to adjust subscription' },
        { status: 500 }
      )
    }
  }

  // 6. Handle regular update
  const updatePayload = payload as UpdateSubscriptionPayload
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (updatePayload.monthlySessions !== undefined) {
    if (existingSubscription.subscription_type !== 'hybrid') {
      return NextResponse.json(
        { error: 'Can only set monthly sessions for hybrid subscriptions' },
        { status: 400 }
      )
    }
    updateData.monthly_sessions = updatePayload.monthlySessions
  }

  if (updatePayload.sessionDurationMinutes !== undefined) {
    if (existingSubscription.subscription_type !== 'hybrid') {
      return NextResponse.json(
        { error: 'Can only set session duration for hybrid subscriptions' },
        { status: 400 }
      )
    }
    updateData.session_duration_minutes = updatePayload.sessionDurationMinutes
  }

  if (updatePayload.isActive !== undefined) {
    updateData.is_active = updatePayload.isActive
  }

  if (updatePayload.notes !== undefined) {
    updateData.notes = updatePayload.notes
  }

  try {
    const { data: updatedSubscription, error } = await supabase
      .from('client_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        invite:invites!invite_id(id, name, email)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ subscription: transformSubscription(updatedSubscription) })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update subscription' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Verify subscription belongs to this coach
  const { data: existingSubscription } = await supabase
    .from('client_subscriptions')
    .select('id, coach_id')
    .eq('id', id)
    .single()

  if (!existingSubscription || existingSubscription.coach_id !== user.id) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  // 4. Delete the subscription
  try {
    const { error } = await supabase
      .from('client_subscriptions')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete subscription' },
      { status: 500 }
    )
  }
}

// Helper function to transform subscription to camelCase
function transformSubscription(sub: Record<string, unknown>) {
  const client = sub.client as { id: string; name: string; email: string; avatar_url: string | null } | null
  const invite = sub.invite as { id: string; name: string; email: string } | null

  return {
    id: sub.id,
    clientId: sub.client_id,
    inviteId: sub.invite_id,
    coachId: sub.coach_id,
    subscriptionType: sub.subscription_type,
    monthlySessions: sub.monthly_sessions,
    availableSessions: sub.available_sessions,
    sessionDurationMinutes: sub.session_duration_minutes,
    isActive: sub.is_active,
    notes: sub.notes,
    createdAt: sub.created_at,
    updatedAt: sub.updated_at,
    client: client ? {
      id: client.id,
      name: client.name,
      email: client.email,
      avatarUrl: client.avatar_url,
      isPending: false,
    } : invite ? {
      id: `pending:${invite.id}`,
      name: invite.name,
      email: invite.email,
      avatarUrl: null,
      isPending: true,
    } : null,
  }
}
