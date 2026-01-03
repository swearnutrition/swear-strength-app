import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClientMessagesClient } from './ClientMessagesClient'

export const metadata = {
  title: 'Messages | Swear Strength',
}

export default async function ClientMessagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, name, avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'client') {
    redirect('/coach')
  }

  // Get the client's conversation directly from the database
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('client_id', user.id)
    .single()

  // Check if client is a member of any group chats
  const { data: groupMemberships } = await supabase
    .from('group_chat_members')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  const hasGroupChats = (groupMemberships?.length ?? 0) > 0

  return (
    <ClientMessagesClient
      userId={user.id}
      userName={profile?.name || 'Client'}
      conversationId={conversation?.id || null}
      hasGroupChats={hasGroupChats}
    />
  )
}
