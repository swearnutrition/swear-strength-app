import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH - Update package (e.g., reassign client_id)
export async function PATCH(
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

  // 3. Verify package exists and belongs to this coach
  const { data: pkg, error: fetchError } = await supabase
    .from('session_packages')
    .select('id, coach_id, client_id')
    .eq('id', packageId)
    .single()

  if (fetchError || !pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  if (pkg.coach_id !== user.id) {
    return NextResponse.json({ error: 'You can only update your own packages' }, { status: 403 })
  }

  // 4. Parse request body
  const body = await request.json()
  const { clientId, expiresAt } = body

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (clientId !== undefined) {
    updateData.client_id = clientId
  }
  if (expiresAt !== undefined) {
    updateData.expires_at = expiresAt
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // 5. Update the package
  const { data: updatedPkg, error: updateError } = await supabase
    .from('session_packages')
    .update(updateData)
    .eq('id', packageId)
    .select()
    .single()

  if (updateError) {
    console.error('Error updating package:', updateError)
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 })
  }

  return NextResponse.json({ package: updatedPkg })
}

export async function DELETE(
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

  // 3. Verify package exists and belongs to this coach
  const { data: pkg, error: fetchError } = await supabase
    .from('session_packages')
    .select('id, coach_id')
    .eq('id', packageId)
    .single()

  if (fetchError || !pkg) {
    return NextResponse.json({ error: 'Package not found' }, { status: 404 })
  }

  if (pkg.coach_id !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own packages' }, { status: 403 })
  }

  // 4. Delete any adjustments first (if foreign key constraint exists)
  await supabase
    .from('session_package_adjustments')
    .delete()
    .eq('package_id', packageId)

  // 5. Delete the package
  const { error: deleteError } = await supabase
    .from('session_packages')
    .delete()
    .eq('id', packageId)

  if (deleteError) {
    console.error('Error deleting package:', deleteError)
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
