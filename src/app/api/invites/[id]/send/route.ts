import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 })
    }

    // Get coach name for email
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const coachName = coachProfile?.name || 'Your Coach'
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL

    // Use admin client to check if user exists in auth
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if client already exists in auth (has an account but needs password setup)
    // Use admin API to look up user by email in auth.users
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === invite.email.toLowerCase()
    )

    if (existingAuthUser) {
      // Client already has an account - send password reset instead of invite

      // Generate password reset link
      const { data: resetData, error: resetError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: invite.email,
        options: {
          redirectTo: `${baseUrl}/login`,
        },
      })

      if (resetError) {
        console.error('Error generating reset link:', resetError)
        return NextResponse.json({ error: 'Failed to send password setup email' }, { status: 500 })
      }

      // Update invite to mark as sent
      await supabase
        .from('invites')
        .update({
          invite_sent_at: new Date().toISOString(),
        })
        .eq('id', id)

      // Send custom password setup email
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: invite.email,
            template: 'client-password-setup',
            data: {
              resetLink: resetData.properties.action_link,
              coachName,
              clientName: invite.name,
            },
          },
        })
      } catch (emailErr) {
        console.error('Failed to send password setup email:', emailErr)
      }

      return NextResponse.json({
        success: true,
        type: 'password_reset',
        message: 'Password setup email sent',
      })
    }

    // Client doesn't exist - send normal invite
    // Generate new token and set 7-day expiry
    const newToken = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Update invite with new token, expiry, and sent timestamp
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
        invite_sent_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating invite:', updateError)
      return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
    }

    const inviteLink = `${baseUrl}/invite/${newToken}`

    // Send email
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: invite.email,
          template: 'client-invite',
          data: {
            inviteLink,
            coachName,
            clientName: invite.name,
          },
        },
      })
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr)
      // Don't fail the request if email fails - invite is still updated
    }

    return NextResponse.json({
      success: true,
      type: 'invite',
      inviteLink, // Return link in case email fails
    })
  } catch (error) {
    console.error('Send invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
