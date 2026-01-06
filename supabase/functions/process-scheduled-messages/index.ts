import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Replace message variables with client data.
 * Supported variables: {firstname}, {name} (case-insensitive)
 */
function replaceVariables(content: string, client: { name?: string | null }): string {
  const fullName = client.name || ''
  const firstName = fullName.split(' ')[0] || ''

  return content
    .replace(/\{firstname\}/gi, firstName)
    .replace(/\{name\}/gi, fullName)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledMessage {
  id: string
  coach_id: string
  message_type: 'dm' | 'mass_dm' | 'announcement' | 'group_chat'
  content: string
  content_type: string
  media_url: string | null
  conversation_id: string | null
  recipient_ids: string[] | null
  group_chat_id: string | null
  scheduled_for: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const now = new Date().toISOString()

    console.log(`Processing scheduled messages at ${now}`)

    // Get all pending messages that are due
    const { data: messages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled messages: ${fetchError.message}`)
    }

    console.log(`Found ${messages?.length || 0} messages to process`)

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const msg of (messages || []) as ScheduledMessage[]) {
      try {
        // Get coach profile for push notifications
        const { data: coach } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', msg.coach_id)
          .single()

        const coachName = coach?.name || 'Coach'

        if (msg.message_type === 'dm') {
          await sendDirectMessage(supabase, msg, coachName)
        } else if (msg.message_type === 'mass_dm') {
          await sendMassDirectMessages(supabase, msg, coachName)
        } else if (msg.message_type === 'announcement') {
          await sendAnnouncement(supabase, msg, coachName)
        } else if (msg.message_type === 'group_chat') {
          await sendGroupChatMessage(supabase, msg, coachName)
        }

        // Mark as sent
        await supabase
          .from('scheduled_messages')
          .update({ status: 'sent', sent_at: now })
          .eq('id', msg.id)

        results.push({ id: msg.id, success: true })
        console.log(`Sent message ${msg.id} (${msg.message_type})`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Failed to send message ${msg.id}:`, errorMessage)

        // Mark as failed
        await supabase
          .from('scheduled_messages')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', msg.id)

        results.push({ id: msg.id, success: false, error: errorMessage })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        processed: results.length,
        sent: successCount,
        failed: failCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing scheduled messages:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendDirectMessage(
  supabase: ReturnType<typeof createClient>,
  msg: ScheduledMessage,
  coachName: string
) {
  if (!msg.conversation_id) throw new Error('No conversation_id for DM')

  // Get conversation to find recipient and client name for variable replacement
  const { data: conversation } = await supabase
    .from('conversations')
    .select('client_id, client:profiles!conversations_client_id_fkey(name)')
    .eq('id', msg.conversation_id)
    .single()

  if (!conversation) throw new Error('Conversation not found')

  // Replace variables in content
  const client = Array.isArray(conversation.client) ? conversation.client[0] : conversation.client
  const personalizedContent = replaceVariables(msg.content, { name: client?.name })

  // Insert message
  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: msg.conversation_id,
      sender_id: msg.coach_id,
      content: personalizedContent,
      content_type: msg.content_type,
      media_url: msg.media_url,
    })

  if (error) throw error

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', msg.conversation_id)

  // Send push notification with personalized content
  const msgForPush = { ...msg, content: personalizedContent }
  await sendPush(supabase, [conversation.client_id], msgForPush, coachName, '/messages')
}

async function sendMassDirectMessages(
  supabase: ReturnType<typeof createClient>,
  msg: ScheduledMessage,
  coachName: string
) {
  if (!msg.recipient_ids || msg.recipient_ids.length === 0) {
    throw new Error('No recipient_ids for mass DM')
  }

  // Get client names for variable replacement
  const { data: clientProfiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', msg.recipient_ids)

  const clientNameMap = new Map<string, string>()
  for (const p of clientProfiles || []) {
    clientNameMap.set(p.id, p.name || '')
  }

  for (const clientId of msg.recipient_ids) {
    // Find existing conversation (single coach model - no coach_id in conversations table)
    let { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle()

    // Create if doesn't exist
    if (!conversation) {
      const { data: newConv, error: createError } = await supabase
        .from('conversations')
        .insert({ client_id: clientId })
        .select('id')
        .single()

      if (createError) {
        console.error(`Failed to create conversation for ${clientId}:`, createError)
        continue
      }
      conversation = newConv
    }

    // Replace variables for this recipient
    const clientName = clientNameMap.get(clientId) || ''
    const personalizedContent = replaceVariables(msg.content, { name: clientName })

    // Insert message
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: msg.coach_id,
        content: personalizedContent,
        content_type: msg.content_type,
        media_url: msg.media_url,
      })

    if (msgError) {
      console.error(`Failed to send message to ${clientId}:`, msgError)
      continue
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id)

    // Send push with personalized content
    const msgForPush = { ...msg, content: personalizedContent }
    await sendPush(supabase, [clientId], msgForPush, coachName, '/messages')
  }
}

async function sendAnnouncement(
  supabase: ReturnType<typeof createClient>,
  msg: ScheduledMessage,
  coachName: string
) {
  // Insert announcement
  const { error } = await supabase
    .from('announcements')
    .insert({
      coach_id: msg.coach_id,
      content: msg.content,
      content_type: msg.content_type,
      media_url: msg.media_url,
    })

  if (error) throw error

  // Get all clients to send push
  const { data: clients } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'client')

  if (clients && clients.length > 0) {
    const clientIds = clients.map(c => c.id)
    await sendPush(supabase, clientIds, msg, coachName, '/announcements')
  }
}

async function sendGroupChatMessage(
  supabase: ReturnType<typeof createClient>,
  msg: ScheduledMessage,
  coachName: string
) {
  if (!msg.group_chat_id) throw new Error('No group_chat_id for group chat message')

  // Insert message into group_messages table
  const { error } = await supabase
    .from('group_messages')
    .insert({
      group_chat_id: msg.group_chat_id,
      sender_id: msg.coach_id,
      content: msg.content,
      content_type: msg.content_type,
      media_url: msg.media_url,
    })

  if (error) throw error

  // Update group_chats.updated_at (trigger should handle this, but just in case)
  await supabase
    .from('group_chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', msg.group_chat_id)

  // Get all group members (except coach) to send push notifications
  const { data: members } = await supabase
    .from('group_chat_members')
    .select('user_id')
    .eq('group_chat_id', msg.group_chat_id)
    .eq('notifications_enabled', true)
    .neq('user_id', msg.coach_id)

  if (members && members.length > 0) {
    const memberIds = members.map(m => m.user_id)
    // Get group name for notification
    const { data: groupChat } = await supabase
      .from('group_chats')
      .select('name')
      .eq('id', msg.group_chat_id)
      .single()

    const groupName = groupChat?.name || 'Group'
    await sendGroupPush(supabase, memberIds, msg, coachName, groupName)
  }
}

async function sendGroupPush(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  msg: ScheduledMessage,
  senderName: string,
  groupName: string
) {
  const messagePreview = msg.content_type === 'text'
    ? (msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content)
    : msg.content_type === 'gif' ? 'Sent a GIF' : `Sent ${msg.content_type}`

  const title = `${groupName}`
  const body = `${senderName}: ${messagePreview}`

  // Get push subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No push subscriptions found for group members')
    return
  }

  // Import web-push for Deno
  const webPush = await import('npm:web-push@3.6.7')

  const vapidPublicKey = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured')
    return
  }

  webPush.setVapidDetails(
    'mailto:support@swearstrength.com',
    vapidPublicKey,
    vapidPrivateKey
  )

  const payload = JSON.stringify({
    title,
    body,
    url: '/messages',
  })

  for (const sub of subscriptions) {
    try {
      const keys = sub.keys as { p256dh: string; auth: string }
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        },
        payload
      )
      console.log(`Push sent successfully for subscription ${sub.id}`)
    } catch (error: unknown) {
      const pushError = error as { statusCode?: number }
      if (pushError.statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
      } else {
        console.error(`Push failed for subscription ${sub.id}:`, error)
      }
    }
  }
}

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  msg: ScheduledMessage,
  senderName: string,
  url: string
) {
  const messagePreview = msg.content_type === 'text'
    ? (msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content)
    : msg.content_type === 'gif' ? 'Sent a GIF' : `Sent ${msg.content_type}`

  const title = msg.message_type === 'announcement'
    ? `Announcement from ${senderName}`
    : `Message from ${senderName}`

  // Get push subscriptions
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds)

  if (!subscriptions || subscriptions.length === 0) {
    console.log('No push subscriptions found for recipients')
    return
  }

  // Import web-push for Deno
  const webPush = await import('npm:web-push@3.6.7')

  const vapidPublicKey = Deno.env.get('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured')
    return
  }

  webPush.setVapidDetails(
    'mailto:support@swearstrength.com',
    vapidPublicKey,
    vapidPrivateKey
  )

  const payload = JSON.stringify({
    title,
    body: messagePreview,
    url,
  })

  for (const sub of subscriptions) {
    try {
      const keys = sub.keys as { p256dh: string; auth: string }
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
        },
        payload
      )
      console.log(`Push sent successfully for subscription ${sub.id}`)
    } catch (error: unknown) {
      const pushError = error as { statusCode?: number }
      if (pushError.statusCode === 410) {
        // Subscription expired, remove it
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
      } else {
        console.error(`Push failed for subscription ${sub.id}:`, error)
      }
    }
  }
}
