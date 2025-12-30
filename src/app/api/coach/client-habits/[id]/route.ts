import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/coach/client-habits/[id] - Unassign a habit (set is_active to false)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientHabitId } = await params
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
      return NextResponse.json({ error: 'Only coaches can unassign habits' }, { status: 403 })
    }

    // Verify this client_habit belongs to this coach
    const { data: clientHabit } = await supabase
      .from('client_habits')
      .select('id, coach_id, is_active')
      .eq('id', clientHabitId)
      .single()

    if (!clientHabit) {
      return NextResponse.json({ error: 'Habit assignment not found' }, { status: 404 })
    }

    if (clientHabit.coach_id !== user.id) {
      return NextResponse.json({ error: 'You do not have permission to modify this habit assignment' }, { status: 403 })
    }

    // Parse the request body for the action
    let body: { is_active?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // Default to unassigning if no body provided
      body = { is_active: false }
    }

    // Update the habit assignment
    const { error: updateError } = await supabase
      .from('client_habits')
      .update({ is_active: body.is_active ?? false })
      .eq('id', clientHabitId)

    if (updateError) {
      console.error('Error updating client_habit:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: body.is_active ? 'Habit reassigned' : 'Habit unassigned'
    })

  } catch (error) {
    console.error('Error in client-habits PATCH:', error)
    return NextResponse.json(
      { error: 'Failed to update habit assignment' },
      { status: 500 }
    )
  }
}

// DELETE /api/coach/client-habits/[id] - Permanently delete a habit assignment (and its completions)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientHabitId } = await params
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
      return NextResponse.json({ error: 'Only coaches can delete habit assignments' }, { status: 403 })
    }

    // Verify this client_habit belongs to this coach
    const { data: clientHabit } = await supabase
      .from('client_habits')
      .select('id, coach_id')
      .eq('id', clientHabitId)
      .single()

    if (!clientHabit) {
      return NextResponse.json({ error: 'Habit assignment not found' }, { status: 404 })
    }

    if (clientHabit.coach_id !== user.id) {
      return NextResponse.json({ error: 'You do not have permission to delete this habit assignment' }, { status: 403 })
    }

    // Delete the habit assignment (habit_completions will cascade delete due to FK)
    const { error: deleteError } = await supabase
      .from('client_habits')
      .delete()
      .eq('id', clientHabitId)

    if (deleteError) {
      console.error('Error deleting client_habit:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Habit assignment deleted'
    })

  } catch (error) {
    console.error('Error in client-habits DELETE:', error)
    return NextResponse.json(
      { error: 'Failed to delete habit assignment' },
      { status: 500 }
    )
  }
}
