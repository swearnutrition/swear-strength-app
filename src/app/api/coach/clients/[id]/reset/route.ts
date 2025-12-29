import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params
    const body = await request.json()
    const { workoutHistory, habitHistory, unassignProgram } = body

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
      return NextResponse.json({ error: 'Only coaches can reset client data' }, { status: 403 })
    }

    // Verify the client exists and belongs to this coach
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, coach_id')
      .eq('id', clientId)
      .single()

    if (!clientProfile) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (clientProfile.coach_id !== user.id) {
      return NextResponse.json({ error: 'This client does not belong to you' }, { status: 403 })
    }

    // Perform deletions based on options
    const results: string[] = []

    if (workoutHistory) {
      // Delete set logs first (child records)
      const { data: workoutLogs } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', clientId)

      if (workoutLogs && workoutLogs.length > 0) {
        const logIds = workoutLogs.map(l => l.id)
        await supabase
          .from('set_logs')
          .delete()
          .in('workout_log_id', logIds)
      }

      // Delete workout logs
      await supabase
        .from('workout_logs')
        .delete()
        .eq('user_id', clientId)

      // Delete personal records
      await supabase
        .from('personal_records')
        .delete()
        .eq('user_id', clientId)

      results.push('Deleted workout history and personal records')
    }

    if (habitHistory) {
      // Delete habit completions
      await supabase
        .from('habit_completions')
        .delete()
        .eq('client_id', clientId)

      results.push('Deleted habit completions')
    }

    if (unassignProgram) {
      // Mark active program assignments as completed/cancelled
      await supabase
        .from('user_program_assignments')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('user_id', clientId)
        .eq('status', 'active')

      results.push('Unassigned program')
    }

    return NextResponse.json({
      success: true,
      message: results.join(', ') || 'No actions taken'
    })

  } catch (error) {
    console.error('Error resetting client:', error)
    return NextResponse.json(
      { error: 'Failed to reset client data' },
      { status: 500 }
    )
  }
}
