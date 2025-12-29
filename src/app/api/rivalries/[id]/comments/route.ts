import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/rivalries/[id]/comments - Add a comment/reaction/gif to a rivalry
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

  const body = await request.json()
  // Support both camelCase and snake_case for flexibility
  const contentType = body.contentType || body.content_type
  const content = body.content
  const gifUrl = body.gifUrl || body.gif_url

  // Validate content type
  if (!['text', 'reaction', 'gif'].includes(contentType)) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 })
  }

  // Validate required fields based on content type
  if (contentType === 'text' && !content) {
    return NextResponse.json({ error: 'Content is required for text messages' }, { status: 400 })
  }
  if (contentType === 'reaction' && !content) {
    return NextResponse.json({ error: 'Reaction emoji is required' }, { status: 400 })
  }
  if (contentType === 'gif' && !gifUrl) {
    return NextResponse.json({ error: 'GIF URL is required' }, { status: 400 })
  }

  // Verify user has access to this rivalry (is coach, challenger, or opponent)
  const { data: rivalry, error: rivalryError } = await supabase
    .from('habit_rivalries')
    .select('id, coach_id, challenger_id, opponent_id')
    .eq('id', id)
    .single()

  if (rivalryError || !rivalry) {
    return NextResponse.json({ error: 'Rivalry not found' }, { status: 404 })
  }

  const hasAccess =
    rivalry.coach_id === user.id ||
    rivalry.challenger_id === user.id ||
    rivalry.opponent_id === user.id

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Insert the comment
  const { data: comment, error: insertError } = await supabase
    .from('rivalry_comments')
    .insert({
      rivalry_id: id,
      user_id: user.id,
      content_type: contentType,
      content: content || null,
      gif_url: gifUrl || null,
    })
    .select(`
      *,
      user:profiles!rivalry_comments_user_id_fkey(id, name, avatar_url)
    `)
    .single()

  if (insertError) {
    console.error('Error inserting comment:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    comment: {
      id: comment.id,
      userId: comment.user_id,
      userName: comment.user?.name || 'Unknown',
      userAvatar: comment.user?.avatar_url,
      contentType: comment.content_type,
      content: comment.content,
      gifUrl: comment.gif_url,
      createdAt: comment.created_at,
    }
  })
}

// GET /api/rivalries/[id]/comments - Get all comments for a rivalry
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

  // Verify user has access to this rivalry
  const { data: rivalry, error: rivalryError } = await supabase
    .from('habit_rivalries')
    .select('id, coach_id, challenger_id, opponent_id')
    .eq('id', id)
    .single()

  if (rivalryError || !rivalry) {
    return NextResponse.json({ error: 'Rivalry not found' }, { status: 404 })
  }

  const hasAccess =
    rivalry.coach_id === user.id ||
    rivalry.challenger_id === user.id ||
    rivalry.opponent_id === user.id

  if (!hasAccess) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Get all comments
  const { data: comments, error: fetchError } = await supabase
    .from('rivalry_comments')
    .select(`
      *,
      user:profiles!rivalry_comments_user_id_fkey(id, name, avatar_url)
    `)
    .eq('rivalry_id', id)
    .order('created_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  return NextResponse.json({
    comments: (comments || []).map(c => ({
      id: c.id,
      userId: c.user_id,
      userName: c.user?.name || 'Unknown',
      userAvatar: c.user?.avatar_url,
      contentType: c.content_type,
      content: c.content,
      gifUrl: c.gif_url,
      createdAt: c.created_at,
    }))
  })
}
