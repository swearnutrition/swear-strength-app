import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/messages/[id] - Soft delete a message
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

  // Verify user owns this message
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('id, sender_id')
    .eq('id', id)
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete
  const { error: updateError } = await supabase
    .from('messages')
    .update({ is_deleted: true })
    .eq('id', id)

  if (updateError) {
    console.error('Error deleting message:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
