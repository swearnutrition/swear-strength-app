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

  // 3. Fetch all packages for this coach with client info
  try {
    const { data: packages, error } = await supabase
      .from('session_packages')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url)
      `)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ packages: packages || [] })
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

  // 4. Validate required fields
  if (!payload.clientId || !payload.totalSessions || !payload.sessionDurationMinutes) {
    return NextResponse.json(
      { error: 'Missing required fields: clientId, totalSessions, sessionDurationMinutes' },
      { status: 400 }
    )
  }

  // 5. Create the package
  try {
    const { data: newPackage, error } = await supabase
      .from('session_packages')
      .insert({
        client_id: payload.clientId,
        coach_id: user.id,
        total_sessions: payload.totalSessions,
        remaining_sessions: payload.totalSessions,
        session_duration_minutes: payload.sessionDurationMinutes,
        expires_at: payload.expiresAt || null,
        notes: payload.notes || null,
      })
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ package: newPackage }, { status: 201 })
  } catch (error) {
    console.error('Error creating session package:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create package' },
      { status: 500 }
    )
  }
}
