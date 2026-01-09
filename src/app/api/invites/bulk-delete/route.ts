import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { inviteIds } = await request.json()

    if (!Array.isArray(inviteIds) || inviteIds.length === 0) {
      return NextResponse.json({ error: 'No invite IDs provided' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let deleted = 0
    let failed = 0

    for (const inviteId of inviteIds) {
      try {
        // Verify the invite exists and belongs to the user
        const { data: invite, error: fetchError } = await supabase
          .from('invites')
          .select('id, created_by')
          .eq('id', inviteId)
          .single()

        if (fetchError || !invite) {
          failed++
          continue
        }

        if (invite.created_by !== user.id) {
          failed++
          continue
        }

        // Delete the invite
        const { error: deleteError } = await supabase
          .from('invites')
          .delete()
          .eq('id', inviteId)

        if (deleteError) {
          console.error(`Error deleting invite ${inviteId}:`, deleteError)
          failed++
          continue
        }

        deleted++
      } catch (err) {
        console.error(`Error processing invite ${inviteId}:`, err)
        failed++
      }
    }

    return NextResponse.json({ success: true, deleted, failed })

  } catch (error) {
    console.error('Bulk delete invites error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
