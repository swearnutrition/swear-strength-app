import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Get coach info if available
  let coachName = null
  if (profile.invited_by) {
    const { data: coach } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', profile.invited_by)
      .single()
    coachName = coach?.name || null
  }

  return (
    <SettingsClient
      profile={profile}
      coachName={coachName}
      userEmail={user.email || ''}
    />
  )
}
