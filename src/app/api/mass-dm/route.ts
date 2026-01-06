import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUsers } from '@/lib/push-server'
import { replaceVariables } from '@/lib/replaceVariables'

// POST /api/mass-dm - Send mass DM immediately to multiple clients
export async function POST(request: NextRequest) {
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

  const body = await request.json()
  const { recipientIds, content, contentType, mediaUrl } = body

  // Validate
  if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return NextResponse.json({ error: 'recipientIds required' }, { status: 400 })
  }
  if (!content) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const results: { clientId: string; success: boolean; error?: string }[] = []

  // Get client names for variable replacement
  const { data: clientProfiles } = await adminClient
    .from('profiles')
    .select('id, name')
    .in('id', recipientIds)

  const clientNameMap = new Map<string, string>()
  for (const p of clientProfiles || []) {
    clientNameMap.set(p.id, p.name || '')
  }

  // Send to each recipient
  for (const clientId of recipientIds) {
    try {
      // Find existing conversation (single coach model - no coach_id in conversations table)
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('client_id', clientId)
        .maybeSingle()

      // Create if doesn't exist
      if (!conversation) {
        const { data: newConv, error: createError } = await adminClient
          .from('conversations')
          .insert({ client_id: clientId })
          .select('id')
          .single()

        if (createError) {
          results.push({ clientId, success: false, error: createError.message })
          continue
        }
        conversation = newConv
      }

      // Replace variables for this recipient
      const clientName = clientNameMap.get(clientId) || ''
      const personalizedContent = replaceVariables(content, { name: clientName })

      // Insert message
      const { error: msgError } = await adminClient
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          content: personalizedContent,
          content_type: contentType || 'text',
          media_url: mediaUrl || null,
        })

      if (msgError) {
        results.push({ clientId, success: false, error: msgError.message })
        continue
      }

      // Update conversation last_message_at
      await adminClient
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id)

      // Send push notification
      const messagePreview = (contentType || 'text') === 'text'
        ? (personalizedContent.length > 50 ? personalizedContent.substring(0, 50) + '...' : personalizedContent)
        : contentType === 'gif' ? 'Sent a GIF' : `Sent ${contentType}`

      sendPushToUsers([clientId], {
        title: `Message from ${profile.name || 'Coach'}`,
        body: messagePreview,
        url: '/messages',
      }).catch(err => console.error('Push error:', err))

      results.push({ clientId, success: true })
    } catch (error) {
      results.push({
        clientId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  return NextResponse.json({
    success: failCount === 0,
    sent: successCount,
    failed: failCount,
    results
  })
}
