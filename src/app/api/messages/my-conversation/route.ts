import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/messages/my-conversation - Get or create client's conversation
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a client
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'client') {
    return NextResponse.json({ error: 'Forbidden - clients only' }, { status: 403 })
  }

  // Get existing conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, client_id, last_message_at, created_at')
    .eq('client_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error fetching conversation:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (conversation) {
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        clientId: conversation.client_id,
        lastMessageAt: conversation.last_message_at,
        createdAt: conversation.created_at,
      }
    })
  }

  // No conversation exists yet - return null (coach needs to initiate)
  return NextResponse.json({ conversation: null })
}
