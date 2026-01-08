import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ClientType } from '@/lib/supabase/types'

interface BulkInviteItem {
  email: string
  name: string
  clientType: ClientType
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a coach
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Only coaches can create invites' }, { status: 403 })
    }

    const { invites } = await request.json() as { invites: BulkInviteItem[] }

    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json({ error: 'No invites provided' }, { status: 400 })
    }

    // Check for existing emails (in invites or profiles)
    const emails = invites.map(i => i.email.toLowerCase().trim())

    const { data: existingInvites } = await supabase
      .from('invites')
      .select('email')
      .in('email', emails)
      .is('accepted_at', null)

    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('email', emails)

    const existingEmails = new Set([
      ...(existingInvites || []).map(i => i.email),
      ...(existingProfiles || []).map(p => p.email),
    ])

    // Filter out duplicates
    const validInvites = invites.filter(i => !existingEmails.has(i.email.toLowerCase().trim()))
    const skippedEmails = invites
      .filter(i => existingEmails.has(i.email.toLowerCase().trim()))
      .map(i => i.email)

    if (validInvites.length === 0) {
      return NextResponse.json({
        error: 'All emails already exist',
        skippedEmails
      }, { status: 400 })
    }

    // Create invite records (no expiry or token yet - will be set when email is sent)
    const inviteRecords = validInvites.map(invite => ({
      email: invite.email.toLowerCase().trim(),
      name: invite.name.trim(),
      client_type: invite.clientType,
      token: crypto.randomUUID(), // Generate token now but don't send email
      created_by: user.id,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year expiry (reset when sent)
    }))

    const { data: createdInvites, error: insertError } = await supabase
      .from('invites')
      .insert(inviteRecords)
      .select()

    if (insertError) {
      console.error('Error creating invites:', insertError)
      return NextResponse.json({ error: 'Failed to create invites' }, { status: 500 })
    }

    return NextResponse.json({
      created: createdInvites?.length || 0,
      skippedEmails,
      invites: createdInvites,
    })
  } catch (error) {
    console.error('Bulk invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
