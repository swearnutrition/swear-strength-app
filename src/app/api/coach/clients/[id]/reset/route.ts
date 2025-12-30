import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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

    const { workoutHistory, habitHistory, unassignProgram, unassignHabits } = body

    const supabase = await createClient()
    // Use admin client for deletions to bypass RLS (after verifying permissions)
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
      // Delete personal records FIRST (they reference set_logs via set_log_id FK)
      // Use admin client to bypass RLS
      const { error: prsError } = await adminClient
        .from('personal_records')
        .delete()
        .eq('user_id', clientId)

      if (prsError) {
        console.error('Error deleting personal_records:', prsError)
        errors.push(`personal_records: ${prsError.message}`)
      }

      // Get workout log IDs for deleting set logs
      const { data: workoutLogs } = await adminClient
        .from('workout_logs')
        .select('id')
        .eq('user_id', clientId)

      if (workoutLogs && workoutLogs.length > 0) {
        const logIds = workoutLogs.map(l => l.id)

        // Delete workout completions (references workout_logs)
        const { error: completionsError } = await adminClient
          .from('workout_completions')
          .delete()
          .in('workout_log_id', logIds)

        if (completionsError) {
          console.error('Error deleting workout_completions:', completionsError)
          errors.push(`workout_completions: ${completionsError.message}`)
        }

        // Delete set logs
        const { error: setLogsError } = await adminClient
          .from('set_logs')
          .delete()
          .in('workout_log_id', logIds)

        if (setLogsError) {
          console.error('Error deleting set_logs:', setLogsError)
          errors.push(`set_logs: ${setLogsError.message}`)
        }
      }

      // Delete workout logs
      const { error: workoutLogsError } = await adminClient
        .from('workout_logs')
        .delete()
        .eq('user_id', clientId)

      if (workoutLogsError) {
        console.error('Error deleting workout_logs:', workoutLogsError)
        errors.push(`workout_logs: ${workoutLogsError.message}`)
      }

      results.push('Deleted workout history and personal records')
    }

    if (habitHistory) {
      // Delete habit completions using admin client to bypass RLS
      const { error: habitError } = await adminClient
        .from('habit_completions')
        .delete()
        .eq('client_id', clientId)

      if (habitError) {
        console.error('Error deleting habit_completions:', habitError)
        errors.push(`habit_completions: ${habitError.message}`)
      }

      // Also delete all client_habits (both active and archived) since we're deleting history
      const { error: clientHabitsError } = await adminClient
        .from('client_habits')
        .delete()
        .eq('client_id', clientId)

      if (clientHabitsError) {
        console.error('Error deleting client_habits:', clientHabitsError)
        errors.push(`client_habits: ${clientHabitsError.message}`)
      }

      results.push('Deleted habit history and assignments')
    }

    if (unassignProgram) {
      // Mark active program assignments as inactive using admin client
      const { error: assignmentError } = await adminClient
        .from('user_program_assignments')
        .update({ is_active: false })
        .eq('user_id', clientId)
        .eq('is_active', true)

      if (assignmentError) {
        console.error('Error updating assignments:', assignmentError)
        errors.push(`assignments: ${assignmentError.message}`)
      }

      results.push('Unassigned program')
    }

    if (unassignHabits) {
      // Mark active habit assignments as inactive (keeps history) using admin client
      const { error: habitsError } = await adminClient
        .from('client_habits')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('is_active', true)

      if (habitsError) {
        console.error('Error unassigning habits:', habitsError)
        errors.push(`habits: ${habitsError.message}`)
      }

      results.push('Unassigned habits')
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
