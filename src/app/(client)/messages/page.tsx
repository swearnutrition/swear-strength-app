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

  return (
    <ClientMessagesClient
      userId={user.id}
      userName={profile?.name || 'Client'}
      conversationId={conversation?.id || null}
    />
  )
}
