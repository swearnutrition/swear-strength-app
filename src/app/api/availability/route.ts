import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateAvailabilityTemplatePayload } from '@/types/booking'

// GET coach availability templates
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const coachId = searchParams.get('coachId')
  const type = searchParams.get('type') // 'session' or 'checkin'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get templates
    let templatesQuery = supabase
      .from('coach_availability_templates')
      .select('*')
      .order('day_of_week')
      .order('start_time')

    if (coachId) {
      templatesQuery = templatesQuery.eq('coach_id', coachId)
    } else {
      templatesQuery = templatesQuery.eq('coach_id', user.id)
    }

    if (type) {
      templatesQuery = templatesQuery.eq('availability_type', type)
    }

    const { data: templates, error: templatesError } = await templatesQuery
    if (templatesError) throw templatesError

    // Get overrides
    let overridesQuery = supabase
      .from('coach_availability_overrides')
      .select('*')
      .gte('override_date', new Date().toISOString().split('T')[0])
      .order('override_date')

    if (coachId) {
      overridesQuery = overridesQuery.eq('coach_id', coachId)
    } else {
      overridesQuery = overridesQuery.eq('coach_id', user.id)
    }

    if (type) {
      overridesQuery = overridesQuery.eq('availability_type', type)
    }

    const { data: overrides, error: overridesError } = await overridesQuery
    if (overridesError) throw overridesError

    // Transform snake_case to camelCase
    const transformedTemplates = (templates || []).map((t: Record<string, unknown>) => ({
      id: t.id,
      coachId: t.coach_id,
      availabilityType: t.availability_type,
      dayOfWeek: t.day_of_week,
      startTime: t.start_time,
      endTime: t.end_time,
      maxConcurrentClients: t.max_concurrent_clients,
    }))

    const transformedOverrides = (overrides || []).map((o: Record<string, unknown>) => ({
      id: o.id,
      coachId: o.coach_id,
      availabilityType: o.availability_type,
      overrideDate: o.override_date,
      startTime: o.start_time,
      endTime: o.end_time,
      isBlocked: o.is_blocked,
      maxConcurrentClients: o.max_concurrent_clients,
    }))

    return NextResponse.json({
      templates: transformedTemplates,
      overrides: transformedOverrides,
    })
  } catch (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}

// POST - Create template or override
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload: CreateAvailabilityTemplatePayload & { overrideDate?: string; isBlocked?: boolean }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    // If overrideDate is provided, create an override
    if (payload.overrideDate) {
      const { data: override, error } = await supabase
        .from('coach_availability_overrides')
        .insert({
          coach_id: user.id,
          availability_type: payload.availabilityType,
          override_date: payload.overrideDate,
          start_time: payload.startTime || null,
          end_time: payload.endTime || null,
          is_blocked: payload.isBlocked ?? true,
          max_concurrent_clients: payload.maxConcurrentClients || null,
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ override }, { status: 201 })
    }

    // Otherwise create a template
    if (payload.dayOfWeek === undefined) {
      return NextResponse.json(
        { error: 'dayOfWeek is required for templates' },
        { status: 400 }
      )
    }

    const { data: template, error } = await supabase
      .from('coach_availability_templates')
      .insert({
        coach_id: user.id,
        availability_type: payload.availabilityType,
        day_of_week: payload.dayOfWeek,
        start_time: payload.startTime,
        end_time: payload.endTime,
        max_concurrent_clients: payload.maxConcurrentClients || 2,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ template }, { status: 201 })
  } catch (error) {
    console.error('Error creating availability:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create availability' },
      { status: 500 }
    )
  }
}
