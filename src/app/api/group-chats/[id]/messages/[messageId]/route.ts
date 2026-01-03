import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/group-chats/[id]/messages/[messageId] - Soft delete a message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  const { id: groupChatId, messageId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the message exists and belongs to this user
  const { data: message, error: fetchError } = await supabase
    .from('group_messages')
    .select('id, sender_id, group_chat_id')
    .eq('id', messageId)
    .eq('group_chat_id', groupChatId)
    .single()

  if (fetchError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Only the sender can delete their own message
  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 })
  }

  // Soft delete the message
  const { error: updateError } = await supabase
    .from('group_messages')
    .update({ is_deleted: true })
    .eq('id', messageId)

  if (updateError) {
    console.error('Error deleting group message:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
