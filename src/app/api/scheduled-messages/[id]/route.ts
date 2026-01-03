import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/scheduled-messages/[id] - Get single scheduled message
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

  const { data: message, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (error || !message) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
  })
}

// PUT /api/scheduled-messages/[id] - Update scheduled message
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify message exists and belongs to user
  const { data: existing } = await supabase
    .from('scheduled_messages')
    .select('status')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Can only edit pending messages
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Can only edit pending messages' }, { status: 400 })
  }

  const body = await request.json()
  const { content, contentType, mediaUrl, scheduledFor } = body

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if (content !== undefined) updates.content = content
  if (contentType !== undefined) updates.content_type = contentType
  if (mediaUrl !== undefined) updates.media_url = mediaUrl
  if (scheduledFor !== undefined) {
    const scheduledDate = new Date(scheduledFor)
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
    }
    updates.scheduled_for = scheduledFor
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: message, error } = await supabase
    .from('scheduled_messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating scheduled message:', error)
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
  })
}

// DELETE /api/scheduled-messages/[id] - Cancel scheduled message
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

  // Verify message exists and belongs to user
  const { data: existing } = await supabase
    .from('scheduled_messages')
    .select('status')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Can only cancel pending messages
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Can only cancel pending messages' }, { status: 400 })
  }

  const { error } = await supabase
    .from('scheduled_messages')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) {
    console.error('Error cancelling scheduled message:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
