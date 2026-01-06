import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AdjustSessionPackagePayload } from '@/types/booking'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params
  const supabase = await createClient()

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

  // 3. Parse request body
  let payload: { adjustment: number; reason?: string }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof payload.adjustment !== 'number' || payload.adjustment === 0) {
    return NextResponse.json(
      { error: 'adjustment must be a non-zero number' },
      { status: 400 }
    )
  }

  // 4. Get current package
  const { data: currentPackage, error: fetchError } = await supabase
    .from('session_packages')
    .select('*')
    .eq('id', packageId)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !currentPackage) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  const newBalance = currentPackage.remaining_sessions + payload.adjustment
  if (newBalance < 0) {
    return NextResponse.json(
      { error: 'Cannot reduce balance below 0' },
      { status: 400 }
    )
  }

  // 5. Update package and create adjustment record
  try {
    // Update remaining sessions
    const { error: updateError } = await supabase
      .from('session_packages')
      .update({
        remaining_sessions: newBalance,
        total_sessions: payload.adjustment > 0
          ? currentPackage.total_sessions + payload.adjustment
          : currentPackage.total_sessions,
      })
      .eq('id', packageId)

    if (updateError) throw updateError

    // Create adjustment record
    const { data: adjustment, error: adjustmentError } = await supabase
      .from('session_package_adjustments')
      .insert({
        package_id: packageId,
        adjustment: payload.adjustment,
        previous_balance: currentPackage.remaining_sessions,
        new_balance: newBalance,
        reason: payload.reason || null,
        adjusted_by: user.id,
      })
      .select()
      .single()

    if (adjustmentError) throw adjustmentError

    // Fetch updated package
    const { data: updatedPackage } = await supabase
      .from('session_packages')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url)
      `)
      .eq('id', packageId)
      .single()

    return NextResponse.json({
      package: updatedPackage,
      adjustment,
    })
  } catch (error) {
    console.error('Error adjusting session package:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to adjust package' },
      { status: 500 }
    )
  }
}
