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
  let payload: { adjustment: number; reason?: string; expiresAt?: string | null }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Either adjustment or expiration change is required
  const hasAdjustment = typeof payload.adjustment === 'number' && payload.adjustment !== 0
  const hasExpiresAtChange = 'expiresAt' in payload

  if (!hasAdjustment && !hasExpiresAtChange) {
    return NextResponse.json(
      { error: 'Must provide adjustment or expiresAt change' },
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

  // Calculate new balance if there's an adjustment
  const newBalance = hasAdjustment
    ? currentPackage.remaining_sessions + payload.adjustment
    : currentPackage.remaining_sessions

  if (hasAdjustment && newBalance < 0) {
    return NextResponse.json(
      { error: 'Cannot reduce balance below 0' },
      { status: 400 }
    )
  }

  // 5. Update package and optionally create adjustment record
  try {
    // Build update object
    const updateData: Record<string, unknown> = {}

    if (hasAdjustment) {
      updateData.remaining_sessions = newBalance
      if (payload.adjustment > 0) {
        updateData.total_sessions = currentPackage.total_sessions + payload.adjustment
      }
    }

    if (hasExpiresAtChange) {
      updateData.expires_at = payload.expiresAt || null
    }

    // Update package
    const { error: updateError } = await supabase
      .from('session_packages')
      .update(updateData)
      .eq('id', packageId)

    if (updateError) throw updateError

    // Create adjustment record only if there was a session adjustment
    let adjustmentRecord = null
    if (hasAdjustment) {
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
      adjustmentRecord = adjustment
    }

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
      adjustment: adjustmentRecord,
    })
  } catch (error) {
    console.error('Error adjusting session package:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to adjust package' },
      { status: 500 }
    )
  }
}
