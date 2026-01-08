import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

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
      return NextResponse.json({ error: 'Only coaches can delete clients' }, { status: 403 })
    }

    // Verify the client exists and is a client
    const { data: clientProfile } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', clientId)
      .single()

    if (!clientProfile) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    if (clientProfile.role !== 'client') {
      return NextResponse.json({ error: 'Cannot delete a coach account' }, { status: 403 })
    }

    // Delete all client data in proper order (respecting FK constraints)
    const errors: string[] = []

    // 1. Delete personal records (references set_logs)
    const { error: prsError } = await adminClient
      .from('personal_records')
      .delete()
      .eq('user_id', clientId)

    if (prsError) {
      console.error('Error deleting personal_records:', prsError)
      errors.push(`personal_records: ${prsError.message}`)
    }

    // 2. Get workout log IDs for cascading deletions
    const { data: workoutLogs } = await adminClient
      .from('workout_logs')
      .select('id')
      .eq('user_id', clientId)

    if (workoutLogs && workoutLogs.length > 0) {
      const logIds = workoutLogs.map(l => l.id)

      // Delete workout completions
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

    // 3. Delete workout logs
    const { error: workoutLogsError } = await adminClient
      .from('workout_logs')
      .delete()
      .eq('user_id', clientId)

    if (workoutLogsError) {
      console.error('Error deleting workout_logs:', workoutLogsError)
      errors.push(`workout_logs: ${workoutLogsError.message}`)
    }

    // 4. Delete habit completions
    const { error: habitCompletionsError } = await adminClient
      .from('habit_completions')
      .delete()
      .eq('client_id', clientId)

    if (habitCompletionsError) {
      console.error('Error deleting habit_completions:', habitCompletionsError)
      errors.push(`habit_completions: ${habitCompletionsError.message}`)
    }

    // 5. Delete client habits
    const { error: clientHabitsError } = await adminClient
      .from('client_habits')
      .delete()
      .eq('client_id', clientId)

    if (clientHabitsError) {
      console.error('Error deleting client_habits:', clientHabitsError)
      errors.push(`client_habits: ${clientHabitsError.message}`)
    }

    // 6. Delete program assignments
    const { error: assignmentsError } = await adminClient
      .from('user_program_assignments')
      .delete()
      .eq('user_id', clientId)

    if (assignmentsError) {
      console.error('Error deleting user_program_assignments:', assignmentsError)
      errors.push(`user_program_assignments: ${assignmentsError.message}`)
    }

    // 7. Delete client subscriptions
    const { error: subscriptionsError } = await adminClient
      .from('client_subscriptions')
      .delete()
      .eq('client_id', clientId)

    if (subscriptionsError) {
      console.error('Error deleting client_subscriptions:', subscriptionsError)
      errors.push(`client_subscriptions: ${subscriptionsError.message}`)
    }

    // 8. Delete bookings
    const { error: bookingsError } = await adminClient
      .from('bookings')
      .delete()
      .eq('client_id', clientId)

    if (bookingsError) {
      console.error('Error deleting bookings:', bookingsError)
      errors.push(`bookings: ${bookingsError.message}`)
    }

    // 9. Delete checkin usage
    const { error: checkinUsageError } = await adminClient
      .from('client_checkin_usage')
      .delete()
      .eq('client_id', clientId)

    if (checkinUsageError) {
      console.error('Error deleting client_checkin_usage:', checkinUsageError)
      errors.push(`client_checkin_usage: ${checkinUsageError.message}`)
    }

    // 10. Delete session packages
    const { error: packagesError } = await adminClient
      .from('session_packages')
      .delete()
      .eq('client_id', clientId)

    if (packagesError) {
      console.error('Error deleting session_packages:', packagesError)
      errors.push(`session_packages: ${packagesError.message}`)
    }

    // 11. Finally, delete the profile
    const { error: profileError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', clientId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      errors.push(`profile: ${profileError.message}`)
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Some operations failed: ${errors.join('; ')}`,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Client and all associated data deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    )
  }
}
