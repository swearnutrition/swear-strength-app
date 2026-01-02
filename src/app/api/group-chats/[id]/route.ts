import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/group-chats/[id] - Get group chat details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('group_chat_members')
    .select('role, notifications_enabled')
    .eq('group_chat_id', id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
  }

  // Get group details
  const { data: groupChat, error } = await supabase
    .from('group_chats')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !groupChat) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  // Get members
  const { data: members } = await supabase
    .from('group_chat_members')
    .select(`
      id,
      user_id,
      role,
      notifications_enabled,
      joined_at,
      profiles!group_chat_members_user_id_fkey(name, avatar_url)
    `)
    .eq('group_chat_id', id)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true })

  const processedMembers = (members || []).map(m => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
    return {
      id: m.id,
      userId: m.user_id,
      role: m.role,
      notificationsEnabled: m.notifications_enabled,
      joinedAt: m.joined_at,
      name: profile?.name || 'Unknown',
      avatarUrl: profile?.avatar_url,
    }
  })

  return NextResponse.json({
    groupChat: {
      id: groupChat.id,
      name: groupChat.name,
      description: groupChat.description,
      createdBy: groupChat.created_by,
      createdAt: groupChat.created_at,
      updatedAt: groupChat.updated_at,
      members: processedMembers,
      myRole: membership.role,
      notificationsEnabled: membership.notifications_enabled,
    },
  })
}

// PATCH /api/group-chats/[id] - Update group chat (coach only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership
  const { data: groupChat } = await supabase
    .from('group_chats')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!groupChat || groupChat.created_by !== user.id) {
    return NextResponse.json({ error: 'Not authorized to update this group' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description

  const { error } = await supabase
    .from('group_chats')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating group chat:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/group-chats/[id] - Delete group chat (coach only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify ownership
  const { data: groupChat } = await supabase
    .from('group_chats')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!groupChat || groupChat.created_by !== user.id) {
    return NextResponse.json({ error: 'Not authorized to delete this group' }, { status: 403 })
  }

  const { error } = await supabase
    .from('group_chats')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting group chat:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
