import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

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

    // Verify the client exists and is a client (not a coach)
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', clientId)
      .single()

    if (!clientProfile) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (clientProfile.role !== 'client') {
      return NextResponse.json({ error: 'Cannot reset a coach account' }, { status: 403 })
    }

    // Perform deletions based on options
    const results: string[] = []
    const errors: string[] = []

    if (workoutHistory) {
      // Delete set logs first (child records)
      const { data: workoutLogs } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', clientId)

      if (workoutLogs && workoutLogs.length > 0) {
        const logIds = workoutLogs.map(l => l.id)
        const { error: setLogsError } = await supabase
          .from('set_logs')
          .delete()
          .in('workout_log_id', logIds)

        if (setLogsError) {
          console.error('Error deleting set_logs:', setLogsError)
          errors.push(`set_logs: ${setLogsError.message}`)
        }
      }

      // Delete workout logs
      const { error: workoutLogsError } = await supabase
        .from('workout_logs')
        .delete()
        .eq('user_id', clientId)

      if (workoutLogsError) {
        console.error('Error deleting workout_logs:', workoutLogsError)
        errors.push(`workout_logs: ${workoutLogsError.message}`)
      }

      // Delete personal records
      const { error: prsError } = await supabase
        .from('personal_records')
        .delete()
        .eq('user_id', clientId)

      if (prsError) {
        console.error('Error deleting personal_records:', prsError)
        errors.push(`personal_records: ${prsError.message}`)
      }

      results.push('Deleted workout history and personal records')
    }

    if (habitHistory) {
      // Delete habit completions
      const { error: habitError } = await supabase
        .from('habit_completions')
        .delete()
        .eq('client_id', clientId)

      if (habitError) {
        console.error('Error deleting habit_completions:', habitError)
        errors.push(`habit_completions: ${habitError.message}`)
      }

      results.push('Deleted habit completions')
    }

    if (unassignProgram) {
      // Mark active program assignments as inactive
      const { error: assignmentError } = await supabase
        .from('user_program_assignments')
        .update({
          is_active: false,
          completed_at: new Date().toISOString()
        })
        .eq('user_id', clientId)
        .eq('is_active', true)

      if (assignmentError) {
        console.error('Error updating assignments:', assignmentError)
        errors.push(`assignments: ${assignmentError.message}`)
      }

      results.push('Unassigned program')
    }

    // If there were any errors, return them
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Some operations failed: ${errors.join('; ')}`,
        partialResults: results
      }, { status: 500 })
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
