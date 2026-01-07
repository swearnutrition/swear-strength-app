import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadsClient } from './LeadsClient'
import { transformLead } from '@/types/lead'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    redirect('/login')
  }

  const { data: leadsData } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  const leads = (leadsData || []).map(transformLead)

  return <LeadsClient initialLeads={leads} />
}
