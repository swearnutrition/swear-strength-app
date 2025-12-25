import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CoachHeader } from '../CoachHeader'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get coach profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <CoachHeader profile={profile} user={user} />
      <SettingsClient />
    </div>
  )
}
