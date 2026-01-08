import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateSessionPackagePayload } from '@/types/booking'

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

  // 3. Fetch all packages for this coach with client info (both confirmed and pending)
  try {
    const { data: packages, error } = await supabase
      .from('session_packages')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        invite:invites!invite_id(id, name, email)
      `)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform to camelCase for frontend
    const transformedPackages = (packages || []).map((pkg) => ({
      id: pkg.id,
      clientId: pkg.client_id,
      inviteId: pkg.invite_id,
      coachId: pkg.coach_id,
      totalSessions: pkg.total_sessions,
      remainingSessions: pkg.remaining_sessions,
      sessionDurationMinutes: pkg.session_duration_minutes,
      expiresAt: pkg.expires_at,
      notes: pkg.notes,
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at,
      // Client info from either confirmed profile or pending invite
      client: pkg.client ? {
        id: pkg.client.id,
        name: pkg.client.name,
        email: pkg.client.email,
        avatarUrl: pkg.client.avatar_url,
        isPending: false,
      } : pkg.invite ? {
        id: `pending:${pkg.invite.id}`,
        name: pkg.invite.name,
        email: pkg.invite.email,
        avatarUrl: null,
        isPending: true,
      } : null,
    }))

    return NextResponse.json({ packages: transformedPackages })
  } catch (error) {
    console.error('Error fetching session packages:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch packages' },
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
  let payload: CreateSessionPackagePayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 4. Validate required fields - either clientId or inviteId must be provided
  const isPendingClient = payload.clientId?.startsWith('pending:')
  const actualClientId = isPendingClient ? null : payload.clientId
  const inviteId = isPendingClient ? payload.clientId.replace('pending:', '') : null

  if ((!actualClientId && !inviteId) || !payload.totalSessions || !payload.sessionDurationMinutes) {
    return NextResponse.json(
      { error: 'Missing required fields: clientId (or pending:inviteId), totalSessions, sessionDurationMinutes' },
      { status: 400 }
    )
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

  // 6. Create the package
  try {
    const { data: newPackage, error } = await supabase
      .from('session_packages')
      .insert({
        client_id: actualClientId,
        invite_id: inviteId,
        coach_id: user.id,
        total_sessions: payload.totalSessions,
        remaining_sessions: payload.totalSessions,
        session_duration_minutes: payload.sessionDurationMinutes,
        expires_at: payload.expiresAt || null,
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
    const transformedPackage = {
      id: newPackage.id,
      clientId: newPackage.client_id,
      inviteId: newPackage.invite_id,
      coachId: newPackage.coach_id,
      totalSessions: newPackage.total_sessions,
      remainingSessions: newPackage.remaining_sessions,
      sessionDurationMinutes: newPackage.session_duration_minutes,
      expiresAt: newPackage.expires_at,
      notes: newPackage.notes,
      createdAt: newPackage.created_at,
      updatedAt: newPackage.updated_at,
      client: newPackage.client ? {
        id: newPackage.client.id,
        name: newPackage.client.name,
        email: newPackage.client.email,
        avatarUrl: newPackage.client.avatar_url,
        isPending: false,
      } : newPackage.invite ? {
        id: `pending:${newPackage.invite.id}`,
        name: newPackage.invite.name,
        email: newPackage.invite.email,
        avatarUrl: null,
        isPending: true,
      } : null,
    }

    return NextResponse.json({ package: transformedPackage }, { status: 201 })
  } catch (error) {
    console.error('Error creating session package:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create package' },
      { status: 500 }
    )
  }
}
