import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { inviteId, clientType } = await request.json()
    if (!inviteId) {
      return NextResponse.json({ error: 'Missing inviteId' }, { status: 400 })
    }

    // Use admin client to bypass RLS for reliable updates
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get invite details
    const { data: invite, error: inviteError } = await adminClient
      .from('invites')
      .select('id, created_by, name, client_type')
      .eq('id', inviteId)
      .single()

    if (inviteError || !invite) {
      console.error('Failed to find invite:', inviteError)
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Mark invite as accepted
    const { error: inviteUpdateError } = await adminClient
      .from('invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', inviteId)

    if (inviteUpdateError) {
      console.error('Failed to mark invite as accepted:', inviteUpdateError)
    }

    // Update profile with invite info - this triggers the welcome message
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({
        invited_by: invite.created_by,
        invite_accepted_at: new Date().toISOString(),
        client_type: clientType || invite.client_type || 'online',
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('Failed to update profile:', profileError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    // Migrate pending client data (packages, habits, programs, conversations, bookings)
    const { error: migrateError } = await adminClient.rpc('migrate_pending_client_data', {
      p_invite_id: inviteId,
      p_client_id: user.id,
    })

    if (migrateError) {
      console.error('Failed to migrate pending client data:', migrateError)
      // Don't fail the whole request, but log the error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
