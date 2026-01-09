import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient, SupabaseClient } from '@supabase/supabase-js'

// Helper function to send welcome message (mirrors the trigger logic)
async function sendWelcomeMessage(
  adminClient: SupabaseClient,
  clientId: string,
  coachId: string
) {
  try {
    // Get coach's welcome message settings
    const { data: coach, error: coachError } = await adminClient
      .from('profiles')
      .select('welcome_message, welcome_message_enabled')
      .eq('id', coachId)
      .single()

    if (coachError || !coach) {
      console.log('Could not find coach profile for welcome message')
      return
    }

    if (!coach.welcome_message || coach.welcome_message === '' || coach.welcome_message_enabled === false) {
      console.log('Welcome message not set or disabled for coach')
      return
    }

    // Create or get conversation
    const { data: conversation, error: convError } = await adminClient
      .from('conversations')
      .upsert({ client_id: clientId }, { onConflict: 'client_id' })
      .select('id')
      .single()

    if (convError || !conversation) {
      console.error('Failed to create conversation:', convError)
      return
    }

    // Send welcome message
    const { error: msgError } = await adminClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: coachId,
        content: coach.welcome_message,
        content_type: 'text',
      })

    if (msgError) {
      console.error('Failed to send welcome message:', msgError)
      return
    }

    // Update conversation's last_message_at
    await adminClient
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id)

    console.log('Welcome message sent successfully')
  } catch (error) {
    console.error('Error sending welcome message:', error)
  }
}

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

    // Check if profile exists first
    const { data: existingProfile, error: checkError } = await adminClient
      .from('profiles')
      .select('id, invite_accepted_at')
      .eq('id', userId)
      .single()

    if (checkError || !existingProfile) {
      console.error('Profile not found for user:', userId, 'error:', checkError)
      // Profile might not exist yet if handle_new_user trigger didn't run
      // Try to create it
      const { error: insertError } = await adminClient
        .from('profiles')
        .insert({
          id: userId,
          email: authUser.user.email,
          name: invite.name || authUser.user.email?.split('@')[0],
          role: 'client',
          invited_by: invite.created_by,
          invite_accepted_at: new Date().toISOString(),
          client_type: clientType || invite.client_type || 'online',
        })

      if (insertError) {
        console.error('Failed to create profile:', insertError)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }
      console.log('Profile created for user:', userId)

      // Since we INSERT-ed the profile, the UPDATE trigger won't fire
      // Send welcome message manually
      await sendWelcomeMessage(adminClient, userId, invite.created_by)
    } else {
      // Profile exists, update it - this triggers the welcome message
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

      if (!updatedProfile || updatedProfile.length === 0) {
        console.error('Profile update returned no rows for user:', userId)
      } else {
        console.log('Profile updated:', updatedProfile[0])
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Accept invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
