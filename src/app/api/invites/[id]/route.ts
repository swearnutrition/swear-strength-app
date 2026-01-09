import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user and verify they're a coach
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Only coaches can update invites' }, { status: 403 })
    }

    // Verify the invite exists and belongs to this coach
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.created_by !== user.id) {
      return NextResponse.json({ error: 'You can only update your own invites' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { name, clientType } = body

    // Build update object
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) {
      updateData.name = name?.trim() || null
    }
    if (clientType !== undefined) {
      updateData.client_type = clientType
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Update the invite
    const { data: updatedInvite, error: updateError } = await supabase
      .from('invites')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating invite:', updateError)
      return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
    }

    return NextResponse.json({ invite: updatedInvite })
  } catch (error) {
    console.error('Update invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user and verify they're a coach
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Only coaches can delete invites' }, { status: 403 })
    }

    // Verify the invite exists and belongs to this coach
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.created_by !== user.id) {
      return NextResponse.json({ error: 'You can only delete your own invites' }, { status: 403 })
    }

    // First, delete any bookings associated with this invite
    // This is needed because bookings.invite_id has ON DELETE SET NULL which would
    // violate the booking_client_validation constraint
    const { error: bookingsDeleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('invite_id', id)

    if (bookingsDeleteError) {
      console.error('Error deleting associated bookings:', bookingsDeleteError)
      return NextResponse.json({ error: 'Failed to delete associated bookings' }, { status: 500 })
    }

    // Delete the invite
    const { error: deleteError } = await supabase
      .from('invites')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting invite:', deleteError)
      return NextResponse.json({ error: 'Failed to delete invite' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
