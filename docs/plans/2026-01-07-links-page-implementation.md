# Links Page & Leads Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public linktree-style page at `/links` with inquiry form, social links, and LyteBite sponsorship, plus a coach dashboard for managing leads.

**Architecture:** Public Next.js page with form submission to API route, Supabase database for leads storage, Resend for email notifications, and a protected coach dashboard page for lead management.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Supabase, Resend

---

## Task 1: Database Migration for Leads Table

**Files:**
- Create: `supabase/migrations/079_leads.sql`

**Step 1: Create the migration file**

```sql
-- Leads table for training inquiry form submissions
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  training_experience TEXT NOT NULL,
  goals TEXT[] NOT NULL,
  training_format TEXT NOT NULL,
  current_situation TEXT NOT NULL,
  anything_else TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for filtering by status and sorting by date
CREATE INDEX IF NOT EXISTS idx_leads_status_created
  ON leads(status, created_at DESC);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Public can submit leads (no auth required)
CREATE POLICY "Public can submit leads"
  ON leads FOR INSERT
  WITH CHECK (true);

-- Only coaches can view leads
CREATE POLICY "Coaches can view leads"
  ON leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Coaches can update leads (status, notes)
CREATE POLICY "Coaches can update leads"
  ON leads FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_leads_updated_at();
```

**Step 2: Apply migration**

Run: `npx supabase db push` or apply via Supabase dashboard

**Step 3: Commit**

```bash
git add supabase/migrations/079_leads.sql
git commit -m "feat: add leads table for training inquiries"
```

---

## Task 2: Create Lead Types

**Files:**
- Create: `src/types/lead.ts`

**Step 1: Create the types file**

```typescript
// Lead management types

export type LeadStatus = 'new' | 'contacted' | 'converted' | 'closed'

export type TrainingExperience =
  | 'Brand new to lifting'
  | 'Less than 1 year'
  | '1-3 years'
  | '3-5 years'
  | '5+ years'

export type TrainingFormat =
  | 'online'
  | 'hybrid'
  | 'in-person'

export type TrainingGoal =
  | 'Build strength'
  | 'Fix/improve technique'
  | 'General health & fitness'
  | 'Fat loss / weight loss'
  | 'Build muscle'
  | 'Improve posture'
  | 'Other'

export interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  trainingExperience: TrainingExperience
  goals: TrainingGoal[]
  trainingFormat: TrainingFormat
  currentSituation: string
  anythingElse: string | null
  status: LeadStatus
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateLeadPayload {
  name: string
  email: string
  phone?: string
  trainingExperience: TrainingExperience
  goals: TrainingGoal[]
  trainingFormat: TrainingFormat
  currentSituation: string
  anythingElse?: string
}

export interface UpdateLeadPayload {
  status?: LeadStatus
  notes?: string
}

// Database row type (snake_case)
export interface LeadRow {
  id: string
  name: string
  email: string
  phone: string | null
  training_experience: string
  goals: string[]
  training_format: string
  current_situation: string
  anything_else: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

// Transform database row to frontend type
export function transformLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    trainingExperience: row.training_experience as TrainingExperience,
    goals: row.goals as TrainingGoal[],
    trainingFormat: row.training_format as TrainingFormat,
    currentSituation: row.current_situation,
    anythingElse: row.anything_else,
    status: row.status as LeadStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
```

**Step 2: Commit**

```bash
git add src/types/lead.ts
git commit -m "feat: add lead types for inquiry form"
```

---

## Task 3: Create POST API Route for Lead Submission

**Files:**
- Create: `src/app/api/leads/route.ts`

**Step 1: Create the API route**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/app/api/leads/route.ts
git commit -m "feat: add POST /api/leads endpoint for form submission"
```

---

## Task 4: Create GET and PATCH API Routes for Lead Management

**Files:**
- Modify: `src/app/api/leads/route.ts` (add GET)
- Create: `src/app/api/leads/[id]/route.ts`

**Step 1: Add GET to existing route**

Add this to `src/app/api/leads/route.ts`:

```typescript
import { transformLead } from '@/types/lead'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get optional status filter
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching leads:', error)
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 })
  }

  const leads = (data || []).map(transformLead)
  return NextResponse.json({ leads })
}
```

**Step 2: Create PATCH route**

Create `src/app/api/leads/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transformLead } from '@/types/lead'

const VALID_STATUSES = ['new', 'contacted', 'converted', 'closed']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Build update object
  const updates: Record<string, unknown> = {}

  if (payload.status !== undefined) {
    if (!VALID_STATUSES.includes(payload.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = payload.status
  }

  if (payload.notes !== undefined) {
    updates.notes = payload.notes?.trim() || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating lead:', error)
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 })
  }

  return NextResponse.json({ lead: transformLead(data) })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check coach role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 })
  }

  return NextResponse.json({ lead: transformLead(data) })
}
```

**Step 3: Commit**

```bash
git add src/app/api/leads/route.ts src/app/api/leads/[id]/route.ts
git commit -m "feat: add GET and PATCH endpoints for lead management"
```

---

## Task 5: Create Public Links Page

**Files:**
- Create: `src/app/links/page.tsx`
- Create: `src/app/links/InquiryForm.tsx`

**Step 1: Create the main page**

Create `src/app/links/page.tsx`:

```typescript
import { Metadata } from 'next'
import Image from 'next/image'
import { InquiryForm } from './InquiryForm'

export const metadata: Metadata = {
  title: 'Swear Strength | Links',
  description: 'I fix messy technique and build strong lifters. Connect with me on social media or inquire about training.',
}

const socialLinks = [
  {
    name: 'Instagram',
    url: 'https://instagram.com/swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    name: 'TikTok',
    url: 'https://tiktok.com/@swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
      </svg>
    ),
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/@swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    name: 'Facebook',
    url: 'https://facebook.com/swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/heatherswear/',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
]

export default function LinksPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <Image
              src="/icon.png"
              alt="Swear Strength"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Swear Strength
          </h1>
          <p className="text-slate-300 text-lg mb-1">
            I fix messy technique and build strong lifters.
          </p>
          <p className="text-slate-500 text-sm">
            Rancho Cucamonga, CA
          </p>
        </div>

        {/* Inquiry Form */}
        <div className="mb-8">
          <InquiryForm />
        </div>

        {/* LyteBite Sponsor Card */}
        <div className="mb-8 p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/50 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <span className="text-cyan-400 font-bold text-sm">LB</span>
            </div>
            <div>
              <h3 className="font-semibold text-white">LyteBite</h3>
              <p className="text-slate-400 text-sm">Clean Eats & Meal Prep</p>
            </div>
          </div>
          <p className="text-slate-300 text-sm mb-3">
            Fuel your training with clean eats. Use code <span className="font-bold text-cyan-400">SWEAR</span> for a discount!
          </p>
          <a
            href="https://www.lytebite.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-medium text-center transition-all hover:scale-[1.02]"
          >
            Shop LyteBite
          </a>
        </div>

        {/* Social Links */}
        <div className="space-y-3">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-3 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/25"
            >
              {link.icon}
              {link.name}
            </a>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-sm mt-12">
          swearstrength.com
        </p>
      </div>
    </div>
  )
}
```

**Step 2: Create the inquiry form component**

Create `src/app/links/InquiryForm.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { TrainingExperience, TrainingFormat, TrainingGoal, CreateLeadPayload } from '@/types/lead'

const experienceOptions: TrainingExperience[] = [
  'Brand new to lifting',
  'Less than 1 year',
  '1-3 years',
  '3-5 years',
  '5+ years',
]

const goalOptions: TrainingGoal[] = [
  'Build strength',
  'Fix/improve technique',
  'General health & fitness',
  'Fat loss / weight loss',
  'Build muscle',
  'Improve posture',
  'Other',
]

const formatOptions: { value: TrainingFormat; label: string }[] = [
  { value: 'online', label: 'Online (independent/busy lifestyle)' },
  { value: 'hybrid', label: 'Hybrid (see me sometimes, workout on own most of the time)' },
  { value: 'in-person', label: 'Fully in-person' },
]

export function InquiryForm() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    trainingExperience: '' as TrainingExperience | '',
    goals: [] as TrainingGoal[],
    trainingFormat: '' as TrainingFormat | '',
    currentSituation: '',
    anythingElse: '',
  })

  const handleGoalToggle = (goal: TrainingGoal) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload: CreateLeadPayload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        trainingExperience: formData.trainingExperience as TrainingExperience,
        goals: formData.goals,
        trainingFormat: formData.trainingFormat as TrainingFormat,
        currentSituation: formData.currentSituation,
        anythingElse: formData.anythingElse || undefined,
      }

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit')
      }

      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Inquiry Sent!</h3>
        <p className="text-slate-400 text-sm">
          Thanks for reaching out! I&apos;ll get back to you soon.
        </p>
      </div>
    )
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/50 hover:border-purple-400 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white mb-1">Train With Me</h3>
            <p className="text-slate-400 text-sm">Inquire about coaching</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Train With Me</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            placeholder="Your name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            placeholder="you@example.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Phone <span className="text-slate-500">(optional)</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Training Experience */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Training Experience <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={formData.trainingExperience}
            onChange={(e) => setFormData({ ...formData, trainingExperience: e.target.value as TrainingExperience })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          >
            <option value="">Select your experience level</option>
            {experienceOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Goals */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Goals <span className="text-red-400">*</span> <span className="text-slate-500">(select all that apply)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {goalOptions.map((goal) => (
              <label
                key={goal}
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  formData.goals.includes(goal)
                    ? 'bg-purple-500/20 border-purple-500 text-white'
                    : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.goals.includes(goal)}
                  onChange={() => handleGoalToggle(goal)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  formData.goals.includes(goal)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-slate-600'
                }`}>
                  {formData.goals.includes(goal) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{goal}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Training Format */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Training Format <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={formData.trainingFormat}
            onChange={(e) => setFormData({ ...formData, trainingFormat: e.target.value as TrainingFormat })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          >
            <option value="">Select your preferred format</option>
            {formatOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Current Situation */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Current Situation <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={formData.currentSituation}
            onChange={(e) => setFormData({ ...formData, currentSituation: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            placeholder="Tell me about your gym setup, current program, and equipment access..."
          />
        </div>

        {/* Anything Else */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Anything else? <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={formData.anythingElse}
            onChange={(e) => setFormData({ ...formData, anythingElse: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            placeholder="Anything else you'd like me to know..."
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || formData.goals.length === 0}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </span>
          ) : (
            'Send Inquiry'
          )}
        </button>
      </form>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/links/page.tsx src/app/links/InquiryForm.tsx
git commit -m "feat: add public links page with inquiry form"
```

---

## Task 6: Create Coach Leads Dashboard Page

**Files:**
- Create: `src/app/coach/leads/page.tsx`
- Create: `src/app/coach/leads/LeadsClient.tsx`
- Create: `src/app/coach/leads/LeadDetailModal.tsx`
- Create: `src/app/coach/leads/loading.tsx`

**Step 1: Create the server page**

Create `src/app/coach/leads/page.tsx`:

```typescript
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
```

**Step 2: Create the client component**

Create `src/app/coach/leads/LeadsClient.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { Lead, LeadStatus } from '@/types/lead'
import { LeadDetailModal } from './LeadDetailModal'

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const statusLabels: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
}

const formatOptions: Record<string, string> = {
  online: 'Online',
  hybrid: 'Hybrid',
  'in-person': 'In-Person',
}

interface LeadsClientProps {
  initialLeads: Lead[]
}

export function LeadsClient({ initialLeads }: LeadsClientProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const filteredLeads = leads.filter((lead) =>
    statusFilter === 'all' || lead.status === statusFilter
  )

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {} as Record<LeadStatus, number>)

  const handleLeadUpdate = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => l.id === updatedLead.id ? updatedLead : l))
    setSelectedLead(updatedLead)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leads</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {leads.length} total inquiries
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
            statusFilter === 'all'
              ? 'bg-purple-500 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
          }`}
        >
          All ({leads.length})
        </button>
        {(['new', 'contacted', 'converted', 'closed'] as LeadStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              statusFilter === status
                ? 'bg-purple-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            {statusLabels[status]} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {/* Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400">No leads found</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
            Share your links page to start receiving inquiries
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Format</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white">{lead.name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.email}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatOptions[lead.trainingFormat] || lead.trainingFormat}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[lead.status]}`}>
                        {statusLabels[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleLeadUpdate}
        />
      )}
    </div>
  )
}
```

**Step 3: Create the detail modal**

Create `src/app/coach/leads/LeadDetailModal.tsx`:

```typescript
'use client'

import { useState } from 'react'
import type { Lead, LeadStatus } from '@/types/lead'

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
]

const formatLabels: Record<string, string> = {
  online: 'Online (independent/busy lifestyle)',
  hybrid: 'Hybrid (see me sometimes, workout on own most of the time)',
  'in-person': 'Fully in-person',
}

interface LeadDetailModalProps {
  lead: Lead
  onClose: () => void
  onUpdate: (lead: Lead) => void
}

export function LeadDetailModal({ lead, onClose, onUpdate }: LeadDetailModalProps) {
  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [notes, setNotes] = useState(lead.notes || '')
  const [isSaving, setIsSaving] = useState(false)

  const hasChanges = status !== lead.status || notes !== (lead.notes || '')

  const handleSave = async () => {
    if (!hasChanges) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: notes || null }),
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      const { lead: updatedLead } = await response.json()
      onUpdate(updatedLead)
    } catch (error) {
      console.error('Error updating lead:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{lead.name}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{formatDate(lead.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
              <a
                href={`mailto:${lead.email}`}
                className="text-purple-600 dark:text-purple-400 hover:underline"
              >
                {lead.email}
              </a>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Phone</label>
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                  {lead.phone}
                </a>
              ) : (
                <span className="text-slate-400">Not provided</span>
              )}
            </div>
          </div>

          {/* Training Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Experience</label>
              <p className="text-slate-900 dark:text-white">{lead.trainingExperience}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Format</label>
              <p className="text-slate-900 dark:text-white">{formatLabels[lead.trainingFormat]}</p>
            </div>
          </div>

          {/* Goals */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Goals</label>
            <div className="flex flex-wrap gap-2">
              {lead.goals.map((goal) => (
                <span
                  key={goal}
                  className="px-3 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-sm"
                >
                  {goal}
                </span>
              ))}
            </div>
          </div>

          {/* Current Situation */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Current Situation</label>
            <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{lead.currentSituation}</p>
          </div>

          {/* Anything Else */}
          {lead.anythingElse && (
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Additional Info</label>
              <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{lead.anythingElse}</p>
            </div>
          )}

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Notes (internal)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this lead..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <a
            href={`mailto:${lead.email}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Create loading state**

Create `src/app/coach/leads/loading.tsx`:

```typescript
export default function LeadsLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="animate-pulse">
        <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-6" />

        <div className="flex gap-2 mb-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add src/app/coach/leads/
git commit -m "feat: add coach leads dashboard page"
```

---

## Task 7: Add Email Notification for New Leads

**Files:**
- Modify: `src/app/api/leads/route.ts`
- Create: `supabase/functions/send-lead-notification/index.ts`

**Step 1: Create the edge function**

Create `supabase/functions/send-lead-notification/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadNotificationPayload {
  name: string
  email: string
  phone: string | null
  trainingExperience: string
  goals: string[]
  trainingFormat: string
  currentSituation: string
  anythingElse: string | null
}

const formatLabels: Record<string, string> = {
  online: 'Online (independent/busy lifestyle)',
  hybrid: 'Hybrid (see me sometimes, workout on own most of the time)',
  'in-person': 'Fully in-person',
}

function generateEmailHtml(lead: LeadNotificationPayload): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(236, 72, 153, 0.1)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 16px; padding: 32px;">
          <h1 style="color: #ffffff; font-size: 24px; margin: 0 0 8px 0;">New Training Inquiry</h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px 0;">Someone wants to train with you!</p>

          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Contact Info</h2>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Name:</strong> ${lead.name}</p>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Email:</strong> <a href="mailto:${lead.email}" style="color: #a855f7;">${lead.email}</a></p>
            ${lead.phone ? `<p style="color: #ffffff; margin: 0;"><strong>Phone:</strong> <a href="tel:${lead.phone}" style="color: #a855f7;">${lead.phone}</a></p>` : ''}
          </div>

          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Training Details</h2>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Experience:</strong> ${lead.trainingExperience}</p>
            <p style="color: #ffffff; margin: 0 0 8px 0;"><strong>Format:</strong> ${formatLabels[lead.trainingFormat] || lead.trainingFormat}</p>
            <p style="color: #ffffff; margin: 0;"><strong>Goals:</strong> ${lead.goals.join(', ')}</p>
          </div>

          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Current Situation</h2>
            <p style="color: #ffffff; margin: 0; white-space: pre-wrap;">${lead.currentSituation}</p>
          </div>

          ${lead.anythingElse ? `
          <div style="background: rgba(15, 15, 15, 0.8); border-radius: 12px; padding: 24px; margin-bottom: 16px;">
            <h2 style="color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Additional Info</h2>
            <p style="color: #ffffff; margin: 0; white-space: pre-wrap;">${lead.anythingElse}</p>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 24px;">
            <a href="mailto:${lead.email}" style="display: inline-block; background: linear-gradient(135deg, #a855f7, #ec4899); color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600;">Reply to ${lead.name}</a>
          </div>
        </div>

        <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
          Swear Strength Coaching Platform
        </p>
      </div>
    </body>
    </html>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const lead: LeadNotificationPayload = await req.json()

    const html = generateEmailHtml(lead)

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Swear Strength <no-reply@swearstrength.com>',
        to: ['coach@swearstrength.com'], // Update with actual coach email
        subject: `New Training Inquiry from ${lead.name}`,
        html,
      }),
    })

    if (!res.ok) {
      const error = await res.text()
      throw new Error(`Resend error: ${error}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error sending lead notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Step 2: Update API route to send notification**

In `src/app/api/leads/route.ts`, after the successful insert, add:

```typescript
  // Send email notification (fire and forget)
  const notificationPayload = {
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone?.trim() || null,
    trainingExperience: payload.trainingExperience,
    goals: payload.goals,
    trainingFormat: payload.trainingFormat,
    currentSituation: payload.currentSituation.trim(),
    anythingElse: payload.anythingElse?.trim() || null,
  }

  // Don't await - let it run in background
  fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-lead-notification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(notificationPayload),
  }).catch((err) => {
    console.error('Failed to send lead notification:', err)
  })
```

**Step 3: Commit**

```bash
git add supabase/functions/send-lead-notification/ src/app/api/leads/route.ts
git commit -m "feat: add email notification for new lead submissions"
```

---

## Task 8: Add Leads Link to Coach Navigation

**Files:**
- Modify: `src/components/coach/CoachSidebar.tsx` (or wherever navigation is defined)

**Step 1: Find and update navigation**

Add a "Leads" link to the coach sidebar/navigation, typically after "Clients" or at a prominent position:

```typescript
{
  name: 'Leads',
  href: '/coach/leads',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
}
```

**Step 2: Commit**

```bash
git add src/components/coach/CoachSidebar.tsx
git commit -m "feat: add leads link to coach navigation"
```

---

## Task 9: Final Testing & Polish

**Step 1: Test the links page**

1. Visit `/links` in browser
2. Verify logo displays with glow effect
3. Verify tagline and location show correctly
4. Click "Train With Me" to expand form
5. Fill out all fields and submit
6. Verify success message shows

**Step 2: Test the API**

1. Check database for new lead record
2. Verify all fields saved correctly
3. Check email notification was sent

**Step 3: Test the leads dashboard**

1. Log in as coach
2. Navigate to `/coach/leads`
3. Verify lead appears in table
4. Click lead to open detail modal
5. Change status and add notes
6. Save and verify changes persist

**Step 4: Test social links**

1. Click each social link
2. Verify they open in new tab
3. Verify correct URLs

**Step 5: Test LyteBite card**

1. Verify styling with cyan accent
2. Click "Shop LyteBite" button
3. Verify it opens lytebite.com

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete links page and leads management system"
```

---

## Summary

**Files Created:**
- `supabase/migrations/079_leads.sql`
- `src/types/lead.ts`
- `src/app/api/leads/route.ts`
- `src/app/api/leads/[id]/route.ts`
- `src/app/links/page.tsx`
- `src/app/links/InquiryForm.tsx`
- `src/app/coach/leads/page.tsx`
- `src/app/coach/leads/LeadsClient.tsx`
- `src/app/coach/leads/LeadDetailModal.tsx`
- `src/app/coach/leads/loading.tsx`
- `supabase/functions/send-lead-notification/index.ts`

**Files Modified:**
- Coach navigation (add Leads link)
