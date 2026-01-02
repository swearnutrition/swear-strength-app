import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/announcements - List announcements
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'

  if (isCoach) {
    // Coach sees all announcements with read counts
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select(`
        id,
        title,
        content,
        is_pinned,
        send_push,
        target_type,
        created_at,
        announcement_recipients(id, client_id, read_at)
      `)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching announcements:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const processedAnnouncements = (announcements || []).map((a) => {
      const recipients = a.announcement_recipients || []
      const readCount = recipients.filter((r) => r.read_at).length
      const totalCount = recipients.length

      return {
        id: a.id,
        title: a.title,
        content: a.content,
        isPinned: a.is_pinned,
        sendPush: a.send_push,
        targetType: a.target_type,
        createdAt: a.created_at,
        readCount,
        totalCount,
      }
    })

    return NextResponse.json({ announcements: processedAnnouncements })
  } else {
    // Client sees only their announcements
    const { data: recipients, error } = await supabase
      .from('announcement_recipients')
      .select(`
        id,
        read_at,
        announcement:announcements(
          id,
          title,
          content,
          is_pinned,
          created_at
        )
      `)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching client announcements:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const processedAnnouncements = (recipients || [])
      .filter((r) => r.announcement)
      .map((r) => {
        // Supabase returns joined data as array for foreign key joins
        const announcement = Array.isArray(r.announcement) ? r.announcement[0] : r.announcement
        const a = announcement as {
          id: string
          title: string
          content: string
          is_pinned: boolean
          created_at: string
        }
        return {
          id: a.id,
          recipientId: r.id,
          title: a.title,
          content: a.content,
          isPinned: a.is_pinned,
          createdAt: a.created_at,
          readAt: r.read_at,
        }
      })
      .sort((a, b) => {
        // Pinned first, then by date
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

    return NextResponse.json({ announcements: processedAnnouncements })
  }
}

// POST /api/announcements - Create announcement (coach only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

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
  const title = body.title
  const content = body.content
  const isPinned = body.isPinned ?? body.is_pinned ?? false
  const sendPush = body.sendPush ?? body.send_push ?? false
  const targetType = body.targetType ?? body.target_type ?? 'all'
  const selectedClientIds = body.selectedClientIds ?? body.selected_client_ids ?? []

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
  }

  // Create announcement
  const { data: announcement, error: insertError } = await supabase
    .from('announcements')
    .insert({
      title,
      content,
      is_pinned: isPinned,
      send_push: sendPush,
      target_type: targetType,
      created_by: user.id,
    })
    .select('id, title, content, is_pinned, send_push, target_type, created_at')
    .single()

  if (insertError) {
    console.error('Error creating announcement:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Get target clients
  let clientIds: string[] = []
  if (targetType === 'all') {
    const { data: clients } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'client')

    clientIds = (clients || []).map((c) => c.id)
  } else {
    clientIds = selectedClientIds
  }

  // Create recipients
  if (clientIds.length > 0) {
    const recipients = clientIds.map((clientId) => ({
      announcement_id: announcement.id,
      client_id: clientId,
    }))

    const { error: recipientError } = await supabase
      .from('announcement_recipients')
      .insert(recipients)

    if (recipientError) {
      console.error('Error creating recipients:', recipientError)
      // Don't fail the whole request, announcement is created
    }
  }

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      isPinned: announcement.is_pinned,
      sendPush: announcement.send_push,
      targetType: announcement.target_type,
      createdAt: announcement.created_at,
      readCount: 0,
      totalCount: clientIds.length,
    }
  })
}
