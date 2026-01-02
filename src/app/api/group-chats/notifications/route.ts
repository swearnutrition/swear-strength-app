import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/group-chats/notifications - Check if user has group notifications enabled
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has any group memberships with notifications disabled
  const { data: memberships } = await supabase
    .from('group_chat_members')
    .select('notifications_enabled')
    .eq('user_id', user.id)

  // If no memberships, default to enabled
  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ enabled: true })
  }

  // If any membership has notifications disabled, return false
  // (we treat this as a global toggle that affects all groups)
  const allEnabled = memberships.every(m => m.notifications_enabled)

  return NextResponse.json({ enabled: allEnabled })
}

// PATCH /api/group-chats/notifications - Toggle group notifications for all groups
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { enabled } = body

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  // Update all user's group memberships
  const { error } = await supabase
    .from('group_chat_members')
    .update({ notifications_enabled: enabled })
    .eq('user_id', user.id)

  if (error) {
    console.error('Error updating group notifications:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, enabled })
}
