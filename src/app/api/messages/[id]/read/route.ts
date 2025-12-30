import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/messages/[id]/read - Mark a message as read
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

  // Get message with conversation info
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      conversation_id,
      conversations!messages_conversation_id_fkey(client_id)
    `)
    .eq('id', id)
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'
  const conversation = message.conversations as { client_id: string }

  // Verify access: coach can mark any, client can only mark in their conversation
  if (!isCoach && conversation.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Don't mark your own messages as read
  if (message.sender_id === user.id) {
    return NextResponse.json({ success: true, message: 'Own message, no action needed' })
  }

  // Mark as read
  const { error: updateError } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)

  if (updateError) {
    console.error('Error marking message as read:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
