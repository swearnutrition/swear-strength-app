// src/app/api/announcements/[id]/read/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/announcements/[id]/read - Mark announcement as read by announcement_id (client)
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

  // Update recipient record
  const { error } = await supabase
    .from('announcement_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('announcement_id', id)
    .eq('client_id', user.id)
    .is('read_at', null)

  if (error) {
    console.error('Error marking announcement as read:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// POST /api/announcements/[id]/read - Mark announcement as read by recipient_id
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: recipientId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Update recipient record by its ID
  const { error } = await supabase
    .from('announcement_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('id', recipientId)
    .eq('client_id', user.id)
    .is('read_at', null)

  if (error) {
    console.error('Error marking announcement as read:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
