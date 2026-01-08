import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { inviteIds } = await request.json() as { inviteIds: string[] }

    if (!inviteIds || !Array.isArray(inviteIds) || inviteIds.length === 0) {
      return NextResponse.json({ error: 'No invite IDs provided' }, { status: 400 })
    }

    // Get invites
    const { data: invites, error: invitesError } = await supabase
      .from('invites')
      .select('*')
      .in('id', inviteIds)
      .eq('created_by', user.id)
      .is('accepted_at', null)

    if (invitesError || !invites || invites.length === 0) {
      return NextResponse.json({ error: 'No valid invites found' }, { status: 404 })
    }

    // Get coach name for emails
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const coachName = coachProfile?.name || 'Your Coach'
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL

    const results: { id: string; success: boolean; error?: string }[] = []

    // Process each invite
    for (const invite of invites) {
      try {
        // Generate new token and set 7-day expiry
        const newToken = crypto.randomUUID()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        // Update invite
        const { error: updateError } = await supabase
          .from('invites')
          .update({
            token: newToken,
            expires_at: expiresAt.toISOString(),
            invite_sent_at: new Date().toISOString(),
          })
          .eq('id', invite.id)

        if (updateError) {
          results.push({ id: invite.id, success: false, error: 'Failed to update' })
          continue
        }

        // Send email
        const inviteLink = `${baseUrl}/invite/${newToken}`
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

        results.push({ id: invite.id, success: true })
      } catch (err) {
        console.error(`Error sending invite ${invite.id}:`, err)
        results.push({ id: invite.id, success: false, error: 'Email failed' })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      sent: successCount,
      failed: failCount,
      results,
    })
  } catch (error) {
    console.error('Bulk send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
