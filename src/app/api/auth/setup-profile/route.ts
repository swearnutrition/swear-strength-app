import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      return NextResponse.json({ success: true, message: 'Profile already exists' })
    }

    // Use admin client to bypass RLS for profile creation
    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get invite data to find coach and client info
    // Look for the most recent unaccepted invite for this email
    const { data: invite, error: inviteError } = await adminClient
      .from('invites')
      .select('name, created_by, client_type')
      .eq('email', user.email)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    console.log('Setup profile - looking for invite for:', user.email)
    console.log('Setup profile - invite found:', invite, 'error:', inviteError)

    // Create profile using admin client
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        name: invite?.name || user.email?.split('@')[0] || 'User',
        role: 'client',
        coach_id: invite?.created_by || null,
        client_type: invite?.client_type || 'online',
      })

    if (profileError) {
      console.error('Error creating profile:', profileError)
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
    }

    // Mark invite as accepted if found
    if (invite) {
      await adminClient
        .from('invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('email', user.email)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Setup profile error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
