import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

    let body
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const { reason } = body

    const supabase = await createClient()
    const adminClient = createAdminClient()

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
      return NextResponse.json({ error: 'Only coaches can archive clients' }, { status: 403 })
    }

    // Verify the client exists and is a client
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, role, archived_at')
      .eq('id', clientId)
      .single()

    if (!clientProfile) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (clientProfile.role !== 'client') {
      return NextResponse.json({ error: 'Cannot archive a coach account' }, { status: 403 })
    }

    if (clientProfile.archived_at) {
      return NextResponse.json({ error: 'Client is already archived' }, { status: 400 })
    }

    // Archive the client
    const { error: archiveError } = await adminClient
      .from('profiles')
      .update({
        archived_at: new Date().toISOString(),
        archived_by: user.id,
        archive_reason: reason || null,
      })
      .eq('id', clientId)

    if (archiveError) {
      console.error('Error archiving client:', archiveError)
      return NextResponse.json({ error: 'Failed to archive client' }, { status: 500 })
    }

    // Deactivate any active program assignments
    await adminClient
      .from('user_program_assignments')
      .update({ is_active: false })
      .eq('user_id', clientId)
      .eq('is_active', true)

    // Deactivate any active habits
    await adminClient
      .from('client_habits')
      .update({ is_active: false })
      .eq('client_id', clientId)
      .eq('is_active', true)

    return NextResponse.json({ success: true, message: 'Client archived successfully' })

  } catch (error) {
    console.error('Error archiving client:', error)
    return NextResponse.json(
      { error: 'Failed to archive client' },
      { status: 500 }
    )
  }
}

// Unarchive a client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

    const supabase = await createClient()
    const adminClient = createAdminClient()

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
      return NextResponse.json({ error: 'Only coaches can unarchive clients' }, { status: 403 })
    }

    // Verify the client exists and is archived
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, role, archived_at')
      .eq('id', clientId)
      .single()

    if (!clientProfile) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (!clientProfile.archived_at) {
      return NextResponse.json({ error: 'Client is not archived' }, { status: 400 })
    }

    // Unarchive the client
    const { error: unarchiveError } = await adminClient
      .from('profiles')
      .update({
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      })
      .eq('id', clientId)

    if (unarchiveError) {
      console.error('Error unarchiving client:', unarchiveError)
      return NextResponse.json({ error: 'Failed to unarchive client' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Client unarchived successfully' })

  } catch (error) {
    console.error('Error unarchiving client:', error)
    return NextResponse.json(
      { error: 'Failed to unarchive client' },
      { status: 500 }
    )
  }
}
