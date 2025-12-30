import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/coach/clients/[id]/program - Unassign program from client
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const supabase = await createClient()

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
      return NextResponse.json({ error: 'Only coaches can unassign programs' }, { status: 403 })
    }

    // Verify the client exists and is a client
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', clientId)
      .single()

    if (!clientProfile) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (clientProfile.role !== 'client') {
      return NextResponse.json({ error: 'Cannot modify a coach account' }, { status: 403 })
    }

    // Mark active program assignments as inactive
    const { error: updateError } = await supabase
      .from('user_program_assignments')
      .update({ is_active: false })
      .eq('user_id', clientId)
      .eq('is_active', true)

    if (updateError) {
      console.error('Error unassigning program:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Program unassigned successfully'
    })

  } catch (error) {
    console.error('Error in program DELETE:', error)
    return NextResponse.json(
      { error: 'Failed to unassign program' },
      { status: 500 }
    )
  }
}
