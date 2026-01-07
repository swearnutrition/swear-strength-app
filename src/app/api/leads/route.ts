import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_EXPERIENCES = [
  'Brand new to lifting',
  'Less than 1 year',
  '1-3 years',
  '3-5 years',
  '5+ years',
]

const VALID_GOALS = [
  'Build strength',
  'Fix/improve technique',
  'General health & fitness',
  'Fat loss / weight loss',
  'Build muscle',
  'Improve posture',
  'Other',
]

const VALID_FORMATS = ['online', 'hybrid', 'in-person']

export async function POST(request: NextRequest) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate required fields
  if (!payload.name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!payload.email?.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
  if (!payload.trainingExperience) {
    return NextResponse.json({ error: 'Training experience is required' }, { status: 400 })
  }
  if (!payload.goals || !Array.isArray(payload.goals) || payload.goals.length === 0) {
    return NextResponse.json({ error: 'At least one goal is required' }, { status: 400 })
  }
  if (!payload.trainingFormat) {
    return NextResponse.json({ error: 'Training format is required' }, { status: 400 })
  }
  if (!payload.currentSituation?.trim()) {
    return NextResponse.json({ error: 'Current situation is required' }, { status: 400 })
  }

  // Validate enum values
  if (!VALID_EXPERIENCES.includes(payload.trainingExperience)) {
    return NextResponse.json({ error: 'Invalid training experience' }, { status: 400 })
  }
  if (!VALID_FORMATS.includes(payload.trainingFormat)) {
    return NextResponse.json({ error: 'Invalid training format' }, { status: 400 })
  }
  for (const goal of payload.goals) {
    if (!VALID_GOALS.includes(goal)) {
      return NextResponse.json({ error: `Invalid goal: ${goal}` }, { status: 400 })
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(payload.email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  const supabase = await createClient()

  // Insert lead
  const { data, error } = await supabase
    .from('leads')
    .insert({
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || null,
      training_experience: payload.trainingExperience,
      goals: payload.goals,
      training_format: payload.trainingFormat,
      current_situation: payload.currentSituation.trim(),
      anything_else: payload.anythingElse?.trim() || null,
      status: 'new',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating lead:', error)
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
  }

  // TODO: Send email notification (Task 7)

  return NextResponse.json({ success: true, id: data.id }, { status: 201 })
}
