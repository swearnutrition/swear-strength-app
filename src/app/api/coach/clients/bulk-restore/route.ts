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
      return NextResponse.json({ error: 'Only coaches can restore clients' }, { status: 403 })
    }

    let restored = 0
    let failed = 0

    for (const clientId of clientIds) {
      try {
        // Verify the client exists and is archived
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('id, role, archived_at')
          .eq('id', clientId)
          .single()

        if (!clientProfile || clientProfile.role !== 'client' || !clientProfile.archived_at) {
          failed++
          continue
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
          console.error(`Error restoring client ${clientId}:`, unarchiveError)
          failed++
          continue
        }

        restored++
      } catch (err) {
        console.error(`Error processing client ${clientId}:`, err)
        failed++
      }
    }

    return NextResponse.json({ success: true, restored, failed })

  } catch (error) {
    console.error('Error bulk restoring clients:', error)
    return NextResponse.json(
      { error: 'Failed to restore clients' },
      { status: 500 }
    )
  }
}
