import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateCheckinQuestionPayload } from '@/types/booking'

// GET coach's form questions ordered by sort_order
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const coachId = searchParams.get('coachId')
  const activeOnly = searchParams.get('activeOnly') === 'true'

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Determine which coach's questions to fetch
    let targetCoachId = coachId

    if (!targetCoachId) {
      // Check if user is a coach
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'coach') {
        targetCoachId = user.id
      } else {
        // Client - get their coach's ID from existing relationship
        const { data: existingPackage } = await supabase
          .from('session_packages')
          .select('coach_id')
          .eq('client_id', user.id)
          .limit(1)
          .single()

        if (!existingPackage) {
          return NextResponse.json(
            { error: 'No coach relationship found' },
            { status: 400 }
          )
        }
        targetCoachId = existingPackage.coach_id
      }
    }

    let query = supabase
      .from('checkin_form_questions')
      .select('*')
      .eq('coach_id', targetCoachId)
      .order('sort_order', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: questions, error } = await query

    if (error) throw error

    return NextResponse.json({ questions: questions || [] })
  } catch (error) {
    console.error('Error fetching check-in form questions:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}

// POST - Create new question (coach only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload: CreateCheckinQuestionPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate required fields
  if (!payload.question || !payload.questionType) {
    return NextResponse.json(
      { error: 'Missing required fields: question, questionType' },
      { status: 400 }
    )
  }

  // Validate questionType
  const validTypes = ['text', 'textarea', 'select', 'checkbox', 'radio']
  if (!validTypes.includes(payload.questionType)) {
    return NextResponse.json(
      { error: `Invalid questionType. Must be one of: ${validTypes.join(', ')}` },
      { status: 400 }
    )
  }

  // Validate options for select/checkbox/radio types
  if (['select', 'checkbox', 'radio'].includes(payload.questionType)) {
    if (!payload.options || !Array.isArray(payload.options) || payload.options.length === 0) {
      return NextResponse.json(
        { error: 'Options are required for select, checkbox, and radio question types' },
        { status: 400 }
      )
    }
  }

  try {
    // Get the current max sort_order for this coach
    const { data: maxOrderResult } = await supabase
      .from('checkin_form_questions')
      .select('sort_order')
      .eq('coach_id', user.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxOrderResult?.sort_order ?? -1) + 1

    const { data: question, error } = await supabase
      .from('checkin_form_questions')
      .insert({
        coach_id: user.id,
        question: payload.question,
        question_type: payload.questionType,
        options: payload.options || null,
        sort_order: nextSortOrder,
        is_required: payload.isRequired ?? false,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ question }, { status: 201 })
  } catch (error) {
    console.error('Error creating check-in form question:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create question' },
      { status: 500 }
    )
  }
}
