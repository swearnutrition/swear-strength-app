import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUsers } from '@/lib/push-server'

// GET /api/messages/conversations/[id] - Get messages for a conversation
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

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'

  // Verify access to conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, client_id')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Clients can only access their own conversation
  if (!isCoach && conversation.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      content,
      content_type,
      media_url,
      is_deleted,
      read_at,
      created_at,
      sender:profiles!messages_sender_id_fkey(id, name, avatar_url, role)
    `)
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const processedMessages = (messages || []).map((m) => {
    // Supabase returns joined data as array for foreign key joins
    const sender = Array.isArray(m.sender) ? m.sender[0] : m.sender
    return {
      id: m.id,
      senderId: m.sender_id,
      senderName: sender?.name || 'Unknown',
      senderAvatar: sender?.avatar_url,
      senderRole: sender?.role,
      content: m.is_deleted ? null : m.content,
      contentType: m.content_type,
      mediaUrl: m.is_deleted ? null : m.media_url,
      isDeleted: m.is_deleted,
      readAt: m.read_at,
      createdAt: m.created_at,
    }
  })

  return NextResponse.json({ messages: processedMessages })
}

// POST /api/messages/conversations/[id] - Send a message
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

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name, avatar_url')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'

  // Verify access to conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, client_id')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Clients can only send to their own conversation
  if (!isCoach && conversation.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const content = body.content
  const contentType = body.contentType || body.content_type || 'text'
  const mediaUrl = body.mediaUrl || body.media_url

  // Validate
  if (contentType === 'text' && !content) {
    return NextResponse.json({ error: 'Content is required for text messages' }, { status: 400 })
  }
  if (['image', 'gif', 'video'].includes(contentType) && !mediaUrl) {
    return NextResponse.json({ error: 'Media URL is required for media messages' }, { status: 400 })
  }

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: user.id,
      content: content || null,
      content_type: contentType,
      media_url: mediaUrl || null,
    })
    .select('id, sender_id, content, content_type, media_url, is_deleted, read_at, created_at')
    .single()

  if (insertError) {
    console.error('Error inserting message:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: message.created_at })
    .eq('id', id)

  // Send push notification to the recipient
  // Coach messages go to client, client messages go to coach
  const recipientId = isCoach ? conversation.client_id : null
  if (recipientId) {
    // Only send push when coach messages client
    const messagePreview = contentType === 'text'
      ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
      : contentType === 'gif' ? 'Sent a GIF' : `Sent ${contentType}`

    sendPushToUsers([recipientId], {
      title: `Message from ${profile?.name || 'Coach'}`,
      body: messagePreview,
      url: '/messages',
    }).catch((err) => {
      console.error('Error sending message push:', err)
    })
  }

  return NextResponse.json({
    message: {
      id: message.id,
      senderId: message.sender_id,
      senderName: profile?.name || 'Unknown',
      senderAvatar: profile?.avatar_url,
      senderRole: profile?.role,
      content: message.content,
      contentType: message.content_type,
      mediaUrl: message.media_url,
      isDeleted: message.is_deleted,
      readAt: message.read_at,
      createdAt: message.created_at,
    }
  })
}
