import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Parse request body - client passes userId directly since session cookies
    // may not be reliably available immediately after signUp()
    const { inviteId, clientType, userId } = await request.json()

    if (!inviteId || !userId) {
      return NextResponse.json({ error: 'Missing inviteId or userId' }, { status: 400 })
    }

    // Use admin client to bypass RLS for reliable updates
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get invite details and verify it matches the user's email
    const { data: invite, error: inviteError } = await adminClient
      .from('invites')
      .select('id, email, created_by, name, client_type')
      .eq('id', inviteId)
      .single()

    if (inviteError || !invite) {
      console.error('Failed to find invite:', inviteError)
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    // Verify the user exists and email matches the invite (security check)
    const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(userId)
    if (authError || !authUser?.user) {
      console.error('Failed to verify user:', authError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (authUser.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      console.error('Email mismatch:', authUser.user.email, 'vs', invite.email)
      return NextResponse.json({ error: 'Email mismatch' }, { status: 403 })
    }

    console.log('Processing invite acceptance for user:', userId, 'invite:', inviteId)

    // Mark invite as accepted
    const { error: inviteUpdateError } = await adminClient
      .from('invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', inviteId)

    if (inviteUpdateError) {
      console.error('Failed to mark invite as accepted:', inviteUpdateError)
    }

    // Update profile with invite info - this triggers the welcome message
    const { data: updatedProfile, error: profileError } = await adminClient
      .from('profiles')
      .update({
        invited_by: invite.created_by,
        invite_accepted_at: new Date().toISOString(),
        client_type: clientType || invite.client_type || 'online',
      })
      .eq('id', userId)
      .select()

    if (profileError) {
      console.error('Failed to update profile:', profileError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    console.log('Profile updated:', updatedProfile)

    // Migrate pending client data (packages, habits, programs, conversations, bookings)
    const { data: migrateResult, error: migrateError } = await adminClient.rpc('migrate_pending_client_data', {
      p_invite_id: inviteId,
      p_client_id: userId,
    })

    if (migrateError) {
      console.error('Failed to migrate pending client data:', migrateError)
      // Don't fail the whole request, but log the error
    } else {
      console.log('Migration completed:', migrateResult)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
