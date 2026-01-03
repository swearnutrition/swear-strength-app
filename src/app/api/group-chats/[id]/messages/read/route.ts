import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/group-chats/[id]/messages/read - Mark messages as read
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupChatId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('group_chat_members')
    .select('id')
    .eq('group_chat_id', groupChatId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this group' }, { status: 403 })
  }

  const body = await request.json()
  const { messageIds } = body

  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    return NextResponse.json({ error: 'messageIds array is required' }, { status: 400 })
  }

  // Verify messages belong to this group and weren't sent by the current user
  const { data: messages } = await supabase
    .from('group_messages')
    .select('id')
    .eq('group_chat_id', groupChatId)
    .neq('sender_id', user.id)
    .in('id', messageIds)

  if (!messages || messages.length === 0) {
    return NextResponse.json({ success: true, marked: 0 })
  }

  const validMessageIds = messages.map(m => m.id)

  // Insert read records (ignore conflicts for already-read messages)
  const readRecords = validMessageIds.map(messageId => ({
    message_id: messageId,
    user_id: user.id,
  }))

  const { error } = await supabase
    .from('group_message_reads')
    .upsert(readRecords, {
      onConflict: 'message_id,user_id',
      ignoreDuplicates: true
    })

  if (error) {
    console.error('Error marking messages as read:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, marked: validMessageIds.length })
}
