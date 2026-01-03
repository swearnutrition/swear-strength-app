import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/scheduled-messages - List coach's scheduled messages
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get query params for filtering
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // 'pending', 'sent', 'cancelled', 'failed', or null for all

  let query = supabase
    .from('scheduled_messages')
    .select('*')
    .eq('coach_id', user.id)
    .order('scheduled_for', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: messages, error } = await query

  if (error) {
    console.error('Error fetching scheduled messages:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with recipient names for display
  const enrichedMessages = await Promise.all(
    (messages || []).map(async (msg) => {
      const result: Record<string, unknown> = {
        id: msg.id,
        coachId: msg.coach_id,
        messageType: msg.message_type,
        content: msg.content,
        contentType: msg.content_type,
        mediaUrl: msg.media_url,
        conversationId: msg.conversation_id,
        recipientIds: msg.recipient_ids,
        scheduledFor: msg.scheduled_for,
        status: msg.status,
        sentAt: msg.sent_at,
        errorMessage: msg.error_message,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at,
      }

      // Get conversation client name for DMs
      if (msg.message_type === 'dm' && msg.conversation_id) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('client:profiles!conversations_client_id_fkey(name)')
          .eq('id', msg.conversation_id)
          .single()

        const client = Array.isArray(conv?.client) ? conv.client[0] : conv?.client
        result.conversationClientName = client?.name || 'Unknown'
      }

      // Get recipient names for mass DMs
      if (msg.message_type === 'mass_dm' && msg.recipient_ids?.length) {
        const { data: recipients } = await supabase
          .from('profiles')
          .select('name')
          .in('id', msg.recipient_ids)

        result.recipientNames = recipients?.map(r => r.name) || []
      }

      return result
    })
  )

  return NextResponse.json({ messages: enrichedMessages })
}

// POST /api/scheduled-messages - Create scheduled message
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { messageType, content, contentType, mediaUrl, conversationId, recipientIds, scheduledFor } = body

  // Validate required fields
  if (!messageType || !content || !scheduledFor) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Validate message type specific requirements
  if (messageType === 'dm' && !conversationId) {
    return NextResponse.json({ error: 'conversationId required for DM' }, { status: 400 })
  }
  if (messageType === 'mass_dm' && (!recipientIds || recipientIds.length === 0)) {
    return NextResponse.json({ error: 'recipientIds required for mass DM' }, { status: 400 })
  }

  // Validate scheduled time is in the future
  const scheduledDate = new Date(scheduledFor)
  if (scheduledDate <= new Date()) {
    return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
  }

  // Insert scheduled message
  const { data: message, error } = await supabase
    .from('scheduled_messages')
    .insert({
      coach_id: user.id,
      message_type: messageType,
      content,
      content_type: contentType || 'text',
      media_url: mediaUrl || null,
      conversation_id: conversationId || null,
      recipient_ids: recipientIds || null,
      scheduled_for: scheduledFor,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating scheduled message:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    message: {
      id: message.id,
      coachId: message.coach_id,
      messageType: message.message_type,
      content: message.content,
      contentType: message.content_type,
      mediaUrl: message.media_url,
      conversationId: message.conversation_id,
      recipientIds: message.recipient_ids,
      scheduledFor: message.scheduled_for,
      status: message.status,
      sentAt: message.sent_at,
      errorMessage: message.error_message,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
    }
  }, { status: 201 })
}
