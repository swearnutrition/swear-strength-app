import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUsers } from '@/lib/push-server'

// POST /api/scheduled-messages/[id]/send-now - Send scheduled message immediately
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

  // Get coach profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get the scheduled message
  const { data: scheduled, error: fetchError } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !scheduled) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (scheduled.status !== 'pending') {
    return NextResponse.json({ error: 'Message is not pending' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  try {
    if (scheduled.message_type === 'dm') {
      // Send single DM
      await sendDirectMessage(
        adminClient,
        scheduled.conversation_id!,
        user.id,
        scheduled.content,
        scheduled.content_type,
        scheduled.media_url,
        profile.name
      )
    } else if (scheduled.message_type === 'mass_dm') {
      // Send to each recipient
      await sendMassDirectMessages(
        adminClient,
        supabase,
        user.id,
        scheduled.recipient_ids!,
        scheduled.content,
        scheduled.content_type,
        scheduled.media_url,
        profile.name
      )
    } else if (scheduled.message_type === 'announcement') {
      // Create announcement
      await sendAnnouncement(
        adminClient,
        user.id,
        scheduled.content,
        scheduled.content_type,
        scheduled.media_url,
        profile.name
      )
    }

    // Mark as sent
    await supabase
      .from('scheduled_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending scheduled message:', error)

    // Mark as failed
    await supabase
      .from('scheduled_messages')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('id', id)

    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}

async function sendDirectMessage(
  adminClient: ReturnType<typeof createAdminClient>,
  conversationId: string,
  senderId: string,
  content: string,
  contentType: string,
  mediaUrl: string | null,
  senderName: string
) {
  // Get conversation to find recipient
  const { data: conversation } = await adminClient
    .from('conversations')
    .select('client_id')
    .eq('id', conversationId)
    .single()

  if (!conversation) throw new Error('Conversation not found')

  // Insert message
  const { error } = await adminClient
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      content_type: contentType,
      media_url: mediaUrl,
    })

  if (error) throw error

  // Update conversation last_message_at
  await adminClient
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  // Send push notification
  const messagePreview = contentType === 'text'
    ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
    : contentType === 'gif' ? 'Sent a GIF' : `Sent ${contentType}`

  sendPushToUsers([conversation.client_id], {
    title: `Message from ${senderName || 'Coach'}`,
    body: messagePreview,
    url: '/messages',
  }).catch(err => console.error('Push error:', err))
}

async function sendMassDirectMessages(
  adminClient: ReturnType<typeof createAdminClient>,
  supabase: Awaited<ReturnType<typeof createClient>>,
  senderId: string,
  recipientIds: string[],
  content: string,
  contentType: string,
  mediaUrl: string | null,
  senderName: string
) {
  // Get or create conversations for each recipient
  for (const clientId of recipientIds) {
    // Find existing conversation
    let { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', clientId)
      .eq('coach_id', senderId)
      .maybeSingle()

    // Create if doesn't exist
    if (!conversation) {
      const { data: newConv, error: createError } = await adminClient
        .from('conversations')
        .insert({ client_id: clientId, coach_id: senderId })
        .select('id')
        .single()

      if (createError) {
        console.error(`Failed to create conversation for ${clientId}:`, createError)
        continue
      }
      conversation = newConv
    }

    // Send message to this conversation
    await sendDirectMessage(
      adminClient,
      conversation.id,
      senderId,
      content,
      contentType,
      mediaUrl,
      senderName
    )
  }
}

async function sendAnnouncement(
  adminClient: ReturnType<typeof createAdminClient>,
  coachId: string,
  content: string,
  contentType: string,
  mediaUrl: string | null,
  coachName: string
) {
  // Insert announcement
  const { error } = await adminClient
    .from('announcements')
    .insert({
      coach_id: coachId,
      content,
      content_type: contentType,
      media_url: mediaUrl,
    })

  if (error) throw error

  // Get all clients to send push
  const { data: clients } = await adminClient
    .from('profiles')
    .select('id')
    .eq('role', 'client')

  if (clients && clients.length > 0) {
    const clientIds = clients.map(c => c.id)
    const messagePreview = contentType === 'text'
      ? (content.length > 50 ? content.substring(0, 50) + '...' : content)
      : contentType === 'gif' ? 'Sent a GIF' : `Sent ${contentType}`

    sendPushToUsers(clientIds, {
      title: `Announcement from ${coachName || 'Coach'}`,
      body: messagePreview,
      url: '/announcements',
    }).catch(err => console.error('Push error:', err))
  }
}
