import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUsers } from '@/lib/push-server'

// GET /api/group-chats/[id]/messages - Get messages for a group chat
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
    .select('id')
    .eq('group_chat_id', id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
  }

  // Get messages
  const { data: messages, error } = await supabase
    .from('group_messages')
    .select(`
      id,
      sender_id,
      content,
      content_type,
      media_url,
      is_deleted,
      created_at,
      sender:profiles!group_messages_sender_id_fkey(id, name, avatar_url)
    `)
    .eq('group_chat_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching group messages:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get read status for messages not sent by current user
  const otherMessageIds = messages
    ?.filter(m => m.sender_id !== user.id)
    .map(m => m.id) || []

  let readMessageIds = new Set<string>()
  if (otherMessageIds.length > 0) {
    const { data: reads } = await supabase
      .from('group_message_reads')
      .select('message_id')
      .eq('user_id', user.id)
      .in('message_id', otherMessageIds)

    readMessageIds = new Set(reads?.map(r => r.message_id) || [])
  }

  const processedMessages = (messages || []).map(m => {
    const sender = Array.isArray(m.sender) ? m.sender[0] : m.sender
    return {
      id: m.id,
      senderId: m.sender_id,
      senderName: sender?.name || 'Unknown',
      senderAvatar: sender?.avatar_url,
      content: m.is_deleted ? null : m.content,
      contentType: m.content_type,
      mediaUrl: m.is_deleted ? null : m.media_url,
      isDeleted: m.is_deleted,
      createdAt: m.created_at,
      isRead: m.sender_id === user.id || readMessageIds.has(m.id),
    }
  })

  return NextResponse.json({ messages: processedMessages })
}

// POST /api/group-chats/[id]/messages - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify membership and get profile
  const { data: membership } = await supabase
    .from('group_chat_members')
    .select('id')
    .eq('group_chat_id', id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, avatar_url')
    .eq('id', user.id)
    .single()

  const body = await request.json()
  const { content, contentType = 'text', mediaUrl } = body

  // Validate
  if (contentType === 'text' && !content) {
    return NextResponse.json({ error: 'Content is required for text messages' }, { status: 400 })
  }
  if (['image', 'gif', 'video'].includes(contentType) && !mediaUrl) {
    return NextResponse.json({ error: 'Media URL is required for media messages' }, { status: 400 })
  }

  // Insert message
  const { data: message, error } = await supabase
    .from('group_messages')
    .insert({
      group_chat_id: id,
      sender_id: user.id,
      content: content || null,
      content_type: contentType,
      media_url: mediaUrl || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error sending group message:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Send push notifications to other members with notifications enabled
  const { data: members } = await supabase
    .from('group_chat_members')
    .select('user_id')
    .eq('group_chat_id', id)
    .eq('notifications_enabled', true)
    .neq('user_id', user.id)

  if (members && members.length > 0) {
    const { data: groupChat } = await supabase
      .from('group_chats')
      .select('name')
      .eq('id', id)
      .single()

    const memberIds = members.map(m => m.user_id)
    const messagePreview = contentType === 'text'
      ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
      : contentType === 'gif' ? 'Sent a GIF' : `Sent ${contentType}`

    sendPushToUsers(memberIds, {
      title: `${groupChat?.name || 'Group Chat'}`,
      body: `${profile?.name || 'Someone'}: ${messagePreview}`,
      url: '/messages',
    }).catch(err => {
      console.error('Error sending group push notifications:', err)
    })
  }

  return NextResponse.json({
    message: {
      id: message.id,
      senderId: message.sender_id,
      senderName: profile?.name || 'Unknown',
      senderAvatar: profile?.avatar_url,
      content: message.content,
      contentType: message.content_type,
      mediaUrl: message.media_url,
      isDeleted: message.is_deleted,
      createdAt: message.created_at,
    },
  })
}
