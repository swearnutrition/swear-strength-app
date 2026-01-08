import { createClient } from '@/lib/supabase/server'
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

    // Get coach name for email
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const coachName = coachProfile?.name || 'Your Coach'
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
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
      inviteLink, // Return link in case email fails
    })
  } catch (error) {
    console.error('Send invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
