import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/messages/conversations - List all conversations (coach only)
export async function GET() {
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all conversations with client info and last message
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      id,
      client_id,
      last_message_at,
      created_at,
      client:profiles!conversations_client_id_fkey(id, name, avatar_url),
      messages(
        id,
        content,
        content_type,
        sender_id,
        is_deleted,
        read_at,
        created_at
      )
    `)
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Process conversations to include unread count and last message
  const processedConversations = (conversations || []).map((conv) => {
    const messages = conv.messages || []
    const lastMessage = messages.sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

    // Unread = messages from client that coach hasn't read
    const unreadCount = messages.filter(
      (m: { sender_id: string; read_at: string | null; is_deleted: boolean }) =>
        m.sender_id === conv.client_id && !m.read_at && !m.is_deleted
    ).length

    // Supabase returns joined data as array for foreign key joins
    const client = Array.isArray(conv.client) ? conv.client[0] : conv.client

    return {
      id: conv.id,
      clientId: conv.client_id,
      clientName: client?.name || 'Unknown',
      clientAvatar: client?.avatar_url,
      lastMessageAt: conv.last_message_at,
      lastMessage: lastMessage ? {
        content: lastMessage.is_deleted ? 'Message deleted' : lastMessage.content,
        contentType: lastMessage.content_type,
        senderId: lastMessage.sender_id,
        createdAt: lastMessage.created_at,
      } : null,
      unreadCount,
    }
  })

  return NextResponse.json({ conversations: processedConversations })
}

// POST /api/messages/conversations - Create a conversation (coach only)
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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const clientId = body.clientId || body.client_id

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  // Check if conversation already exists
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('client_id', clientId)
    .single()

  if (existing) {
    return NextResponse.json({ conversation: { id: existing.id, clientId } })
  }

  // Create new conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ client_id: clientId })
    .select('id, client_id')
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      clientId: conversation.client_id,
    }
  })
}
