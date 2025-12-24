import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ProgramsClient } from './ProgramsClient'

export default async function ProgramsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: programs } = await supabase
    .from('programs')
    .select(`
      *,
      program_weeks(count)
    `)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })

  const programsWithWeekCount = (programs || []).map((p) => ({
    ...p,
    week_count: p.program_weeks?.[0]?.count || 0,
  }))

  return <ProgramsClient programs={programsWithWeekCount} />
}
