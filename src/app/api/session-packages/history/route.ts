import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Verify coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // 3. Fetch all packages for this client with adjustments
    const { data: packages, error: packagesError } = await supabase
      .from('session_packages')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (packagesError) throw packagesError

    // 4. Fetch adjustments for all packages
    const packageIds = (packages || []).map(p => p.id)
    let adjustments: Array<{
      id: string
      package_id: string
      adjustment: number
      previous_balance: number
      new_balance: number
      reason: string | null
      created_at: string
    }> = []

    if (packageIds.length > 0) {
      const { data: adjustmentData, error: adjustmentsError } = await supabase
        .from('session_package_adjustments')
        .select('*')
        .in('package_id', packageIds)
        .order('created_at', { ascending: false })

      if (adjustmentsError) throw adjustmentsError
      adjustments = adjustmentData || []
    }

    // 5. Group adjustments by package
    const adjustmentsByPackage: Record<string, typeof adjustments> = {}
    for (const adj of adjustments) {
      if (!adjustmentsByPackage[adj.package_id]) {
        adjustmentsByPackage[adj.package_id] = []
      }
      adjustmentsByPackage[adj.package_id].push(adj)
    }

    // 6. Transform to camelCase for frontend
    const transformedPackages = (packages || []).map(pkg => ({
      id: pkg.id,
      clientId: pkg.client_id,
      coachId: pkg.coach_id,
      totalSessions: pkg.total_sessions,
      remainingSessions: pkg.remaining_sessions,
      sessionDurationMinutes: pkg.session_duration_minutes,
      expiresAt: pkg.expires_at,
      notes: pkg.notes,
      createdAt: pkg.created_at,
      updatedAt: pkg.updated_at,
      adjustments: (adjustmentsByPackage[pkg.id] || []).map(adj => ({
        id: adj.id,
        packageId: adj.package_id,
        adjustment: adj.adjustment,
        previousBalance: adj.previous_balance,
        newBalance: adj.new_balance,
        reason: adj.reason,
        createdAt: adj.created_at,
      })),
    }))

    return NextResponse.json({ packages: transformedPackages })
  } catch (error) {
    console.error('Error fetching package history:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch package history' },
      { status: 500 }
    )
  }
}
