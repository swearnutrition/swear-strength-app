import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CheckinQuestionType } from '@/types/booking'

interface UpdateQuestionPayload {
  question?: string
  questionType?: CheckinQuestionType
  options?: string[]
  isRequired?: boolean
  isActive?: boolean
  sortOrder?: number
}

// GET single question
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { data: question, error } = await supabase
      .from('checkin_form_questions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Verify access - only the coach who created it can view
    if (question.coach_id !== user.id) {
      // Check if user is a client of this coach
      const { data: existingPackage } = await supabase
        .from('session_packages')
        .select('id')
        .eq('client_id', user.id)
        .eq('coach_id', question.coach_id)
        .limit(1)
        .single()

      if (!existingPackage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ question })
  } catch (error) {
    console.error('Error fetching question:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch question' },
      { status: 500 }
    )
  }
}

// PATCH - Update question (coach only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  let payload: UpdateQuestionPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Get current question
  const { data: currentQuestion, error: fetchError } = await supabase
    .from('checkin_form_questions')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentQuestion) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Verify ownership
  if (currentQuestion.coach_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate questionType if provided
  if (payload.questionType) {
    const validTypes = ['text', 'textarea', 'select', 'checkbox', 'radio']
    if (!validTypes.includes(payload.questionType)) {
      return NextResponse.json(
        { error: `Invalid questionType. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }
  }

  // Validate options for select/checkbox/radio types
  const effectiveType = payload.questionType || currentQuestion.question_type
  if (['select', 'checkbox', 'radio'].includes(effectiveType)) {
    const effectiveOptions = payload.options !== undefined ? payload.options : currentQuestion.options
    if (!effectiveOptions || !Array.isArray(effectiveOptions) || effectiveOptions.length === 0) {
      return NextResponse.json(
        { error: 'Options are required for select, checkbox, and radio question types' },
        { status: 400 }
      )
    }
  }

  try {
    // Build update object
    const updates: Record<string, unknown> = {}

    if (payload.question !== undefined) updates.question = payload.question
    if (payload.questionType !== undefined) updates.question_type = payload.questionType
    if (payload.options !== undefined) updates.options = payload.options
    if (payload.isRequired !== undefined) updates.is_required = payload.isRequired
    if (payload.isActive !== undefined) updates.is_active = payload.isActive
    if (payload.sortOrder !== undefined) updates.sort_order = payload.sortOrder

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid update provided' }, { status: 400 })
    }

    const { data: question, error } = await supabase
      .from('checkin_form_questions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ question })
  } catch (error) {
    console.error('Error updating question:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update question' },
      { status: 500 }
    )
  }
}

// DELETE - Delete question (coach only)
// Performs soft delete by setting is_active=false
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const hardDelete = searchParams.get('hard') === 'true'

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

  // Get current question
  const { data: currentQuestion, error: fetchError } = await supabase
    .from('checkin_form_questions')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentQuestion) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Verify ownership
  if (currentQuestion.coach_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    if (hardDelete) {
      // Hard delete - actually remove from database
      const { error } = await supabase
        .from('checkin_form_questions')
        .delete()
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({ success: true, deleted: true })
    } else {
      // Soft delete - set is_active to false
      const { data: question, error } = await supabase
        .from('checkin_form_questions')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ success: true, question })
    }
  } catch (error) {
    console.error('Error deleting question:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete question' },
      { status: 500 }
    )
  }
}
