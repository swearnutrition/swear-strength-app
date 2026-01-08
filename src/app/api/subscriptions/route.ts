import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateSubscriptionPayload } from '@/types/booking'

export async function GET() {
  const supabase = await createClient()

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

  // 3. Fetch all subscriptions for this coach with client info
  try {
    const { data: subscriptions, error } = await supabase
      .from('client_subscriptions')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        invite:invites!invite_id(id, name, email)
      `)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform to camelCase for frontend
    const transformedSubscriptions = (subscriptions || []).map((sub) => ({
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
      // Client info from either confirmed profile or pending invite
      client: sub.client ? {
        id: sub.client.id,
        name: sub.client.name,
        email: sub.client.email,
        avatarUrl: sub.client.avatar_url,
        isPending: false,
      } : sub.invite ? {
        id: `pending:${sub.invite.id}`,
        name: sub.invite.name,
        email: sub.invite.email,
        avatarUrl: null,
        isPending: true,
      } : null,
    }))

    return NextResponse.json({ subscriptions: transformedSubscriptions })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch subscriptions' },
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

  // 2. Verify coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse request body
  let payload: CreateSubscriptionPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 4. Validate required fields
  const isPendingClient = payload.clientId?.startsWith('pending:')
  const actualClientId = isPendingClient ? null : payload.clientId
  const inviteId = isPendingClient ? payload.clientId.replace('pending:', '') : null

  if (!actualClientId && !inviteId) {
    return NextResponse.json(
      { error: 'Missing required field: clientId' },
      { status: 400 }
    )
  }

  if (!payload.subscriptionType) {
    return NextResponse.json(
      { error: 'Missing required field: subscriptionType' },
      { status: 400 }
    )
  }

  // Hybrid subscriptions require session fields
  if (payload.subscriptionType === 'hybrid') {
    if (!payload.monthlySessions || !payload.sessionDurationMinutes) {
      return NextResponse.json(
        { error: 'Hybrid subscriptions require monthlySessions and sessionDurationMinutes' },
        { status: 400 }
      )
    }
  }

  // 5. If using invite_id, verify the invite exists and belongs to this coach
  if (inviteId) {
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, created_by')
      .eq('id', inviteId)
      .is('accepted_at', null)
      .single()

    if (inviteError || !invite || invite.created_by !== user.id) {
      return NextResponse.json({ error: 'Invalid pending client' }, { status: 400 })
    }
  }

  // 6. Create the subscription
  try {
    const { data: newSubscription, error } = await supabase
      .from('client_subscriptions')
      .insert({
        client_id: actualClientId,
        invite_id: inviteId,
        coach_id: user.id,
        subscription_type: payload.subscriptionType,
        monthly_sessions: payload.subscriptionType === 'hybrid' ? payload.monthlySessions : null,
        available_sessions: payload.subscriptionType === 'hybrid'
          ? (payload.availableSessions ?? payload.monthlySessions)
          : null,
        session_duration_minutes: payload.subscriptionType === 'hybrid'
          ? payload.sessionDurationMinutes
          : null,
        notes: payload.notes || null,
      })
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        invite:invites!invite_id(id, name, email)
      `)
      .single()

    if (error) throw error

    // Transform to camelCase for frontend
    const transformedSubscription = {
      id: newSubscription.id,
      clientId: newSubscription.client_id,
      inviteId: newSubscription.invite_id,
      coachId: newSubscription.coach_id,
      subscriptionType: newSubscription.subscription_type,
      monthlySessions: newSubscription.monthly_sessions,
      availableSessions: newSubscription.available_sessions,
      sessionDurationMinutes: newSubscription.session_duration_minutes,
      isActive: newSubscription.is_active,
      notes: newSubscription.notes,
      createdAt: newSubscription.created_at,
      updatedAt: newSubscription.updated_at,
      client: newSubscription.client ? {
        id: newSubscription.client.id,
        name: newSubscription.client.name,
        email: newSubscription.client.email,
        avatarUrl: newSubscription.client.avatar_url,
        isPending: false,
      } : newSubscription.invite ? {
        id: `pending:${newSubscription.invite.id}`,
        name: newSubscription.invite.name,
        email: newSubscription.invite.email,
        avatarUrl: null,
        isPending: true,
      } : null,
    }

    return NextResponse.json({ subscription: transformedSubscription }, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create subscription' },
      { status: 500 }
    )
  }
}
