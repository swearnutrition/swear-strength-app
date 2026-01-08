import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/coach/clients - Get all clients (including pending/imported clients)
export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user and verify they're a coach
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify the current user is a coach
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!coachProfile || coachProfile.role !== 'coach') {
      return NextResponse.json({ error: 'Only coaches can view clients' }, { status: 403 })
    }

    // Fetch confirmed clients
    const { data: clients, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, email')
      .eq('role', 'client')
      .order('name')

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch pending clients (invites that haven't been accepted yet)
    const { data: pendingInvites, error: invitesError } = await supabase
      .from('invites')
      .select('id, name, email')
      .eq('created_by', user.id)
      .is('accepted_at', null)
      .not('name', 'is', null)
      .order('name')

    if (invitesError) {
      console.error('Error fetching pending invites:', invitesError)
      // Don't fail the request, just return confirmed clients
    }

    // Format pending clients with "pending:" prefix to distinguish them
    const pendingClients = (pendingInvites || []).map(invite => ({
      id: `pending:${invite.id}`,
      name: invite.name,
      email: invite.email,
      avatar_url: null,
      isPending: true,
    }))

    // Merge and sort all clients
    const allClients = [
      ...(clients || []).map(c => ({ ...c, isPending: false })),
      ...pendingClients,
    ].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

    return NextResponse.json({ clients: allClients })

  } catch (error) {
    console.error('Error in clients GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}
