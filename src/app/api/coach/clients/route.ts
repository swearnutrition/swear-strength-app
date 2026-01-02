import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/coach/clients - Get all clients
export async function GET() {
  try {
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
      return NextResponse.json({ error: 'Only coaches can view clients' }, { status: 403 })
    }

    // Fetch all clients
    const { data: clients, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('role', 'client')
      .order('name')

    if (error) {
      console.error('Error fetching clients:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ clients: clients || [] })

  } catch (error) {
    console.error('Error in clients GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}
