import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/group-chats - List user's group chats
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's group chats with member count and last message
  const { data: memberships, error } = await supabase
    .from('group_chat_members')
    .select(`
      group_chat_id,
      notifications_enabled,
      group_chats (
        id,
        name,
        description,
        created_by,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching group chats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get member counts for each group
  const groupIds = memberships?.map(m => m.group_chat_id) || []

  if (groupIds.length === 0) {
    return NextResponse.json({ groupChats: [] })
  }

  const { data: memberCounts } = await supabase
    .from('group_chat_members')
    .select('group_chat_id')
    .in('group_chat_id', groupIds)

  // Get last message for each group
  const { data: lastMessages } = await supabase
    .from('group_messages')
    .select(`
      id,
      group_chat_id,
      sender_id,
      content,
      content_type,
      created_at,
      sender:profiles!group_messages_sender_id_fkey(name)
    `)
    .in('group_chat_id', groupIds)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })

  // Get unread counts
  const { data: unreadMessages } = await supabase
    .from('group_messages')
    .select('id, group_chat_id')
    .in('group_chat_id', groupIds)
    .eq('is_deleted', false)
    .not('sender_id', 'eq', user.id)

  const { data: readMessages } = await supabase
    .from('group_message_reads')
    .select('message_id')
    .eq('user_id', user.id)

  const readMessageIds = new Set(readMessages?.map(r => r.message_id) || [])

  // Process groups
  const memberCountMap: Record<string, number> = {}
  memberCounts?.forEach(mc => {
    memberCountMap[mc.group_chat_id] = (memberCountMap[mc.group_chat_id] || 0) + 1
  })

  const lastMessageMap: Record<string, NonNullable<typeof lastMessages>[number]> = {}
  lastMessages?.forEach(msg => {
    if (!lastMessageMap[msg.group_chat_id]) {
      lastMessageMap[msg.group_chat_id] = msg
    }
  })

  const unreadCountMap: Record<string, number> = {}
  unreadMessages?.forEach(msg => {
    if (!readMessageIds.has(msg.id)) {
      unreadCountMap[msg.group_chat_id] = (unreadCountMap[msg.group_chat_id] || 0) + 1
    }
  })

  const groupChats = memberships?.map(m => {
    const group = Array.isArray(m.group_chats) ? m.group_chats[0] : m.group_chats
    if (!group) return null

    const lastMsg = lastMessageMap[group.id]
    const sender = lastMsg?.sender as { name: string }[] | { name: string } | undefined
    const senderName = sender ? (Array.isArray(sender) ? sender[0]?.name : sender?.name) : undefined

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      createdBy: group.created_by,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      memberCount: memberCountMap[group.id] || 0,
      unreadCount: unreadCountMap[group.id] || 0,
      notificationsEnabled: m.notifications_enabled,
      lastMessage: lastMsg ? {
        id: lastMsg.id,
        content: lastMsg.content,
        contentType: lastMsg.content_type,
        senderName,
        createdAt: lastMsg.created_at,
      } : null,
    }
  }).filter(Boolean).sort((a, b) => {
    // Sort by last activity
    const aTime = a?.lastMessage?.createdAt || a?.createdAt || ''
    const bTime = b?.lastMessage?.createdAt || b?.createdAt || ''
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return NextResponse.json({ groupChats })
}

// POST /api/group-chats - Create a new group chat (coach only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Only coaches can create group chats' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, memberIds } = body

  if (!name) {
    return NextResponse.json({ error: 'Group name is required' }, { status: 400 })
  }

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
  }

  // Create group chat
  const { data: groupChat, error: createError } = await supabase
    .from('group_chats')
    .insert({
      name,
      description: description || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (createError) {
    console.error('Error creating group chat:', createError)
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  // Add coach as admin
  const members = [
    { group_chat_id: groupChat.id, user_id: user.id, role: 'admin' },
    ...memberIds.map((memberId: string) => ({
      group_chat_id: groupChat.id,
      user_id: memberId,
      role: 'member',
    })),
  ]

  const { error: membersError } = await supabase
    .from('group_chat_members')
    .insert(members)

  if (membersError) {
    console.error('Error adding group members:', membersError)
    // Rollback group creation
    await supabase.from('group_chats').delete().eq('id', groupChat.id)
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  return NextResponse.json({
    groupChat: {
      id: groupChat.id,
      name: groupChat.name,
      description: groupChat.description,
      createdBy: groupChat.created_by,
      createdAt: groupChat.created_at,
      updatedAt: groupChat.updated_at,
      memberCount: members.length,
    },
  })
}
