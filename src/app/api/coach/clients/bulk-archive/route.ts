import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { clientIds } = await request.json()

    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return NextResponse.json({ error: 'No client IDs provided' }, { status: 400 })
    }

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

    let archived = 0
    let failed = 0

    for (const clientId of clientIds) {
      try {
        // Verify the client exists and is a client (not archived)
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('id, role, archived_at')
          .eq('id', clientId)
          .single()

        if (!clientProfile || clientProfile.role !== 'client' || clientProfile.archived_at) {
          failed++
          continue
        }

        // Archive the client
        const { error: archiveError } = await adminClient
          .from('profiles')
          .update({
            archived_at: new Date().toISOString(),
            archived_by: user.id,
          })
          .eq('id', clientId)

        if (archiveError) {
          console.error(`Error archiving client ${clientId}:`, archiveError)
          failed++
          continue
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

        archived++
      } catch (err) {
        console.error(`Error processing client ${clientId}:`, err)
        failed++
      }
    }

    return NextResponse.json({ success: true, archived, failed })

  } catch (error) {
    console.error('Error bulk archiving clients:', error)
    return NextResponse.json(
      { error: 'Failed to archive clients' },
      { status: 500 }
    )
  }
}
