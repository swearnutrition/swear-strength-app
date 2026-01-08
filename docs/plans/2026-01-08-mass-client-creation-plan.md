# Mass Client Creation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable coaches to bulk create pending client accounts, book sessions for them, and send invite emails when ready.

**Architecture:** Extend the existing invites table with name/client_type fields. Add invite_id to bookings for pending client bookings. When client accepts invite, a trigger links their bookings to their new profile.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + Auth + Edge Functions), TypeScript, React 19, Tailwind CSS

---

## Task 1: Database Migration - Invites Table

**Files:**
- Create: `supabase/migrations/079_bulk_invites.sql`
- Modify: `src/lib/supabase/types.ts:68-96`

**Step 1: Create migration file**

```sql
-- Add fields for bulk invite creation
-- Migration: 079_bulk_invites.sql

-- Add name field (client's name, provided at bulk creation)
ALTER TABLE invites ADD COLUMN IF NOT EXISTS name TEXT;

-- Add client_type field
ALTER TABLE invites ADD COLUMN IF NOT EXISTS client_type client_type;

-- Add invite_sent_at field (null = invite email not sent yet)
ALTER TABLE invites ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ;

-- Create index for pending invites (not accepted, not sent)
CREATE INDEX IF NOT EXISTS idx_invites_pending
  ON invites(created_by, accepted_at, invite_sent_at)
  WHERE accepted_at IS NULL;
```

**Step 2: Update TypeScript types**

In `src/lib/supabase/types.ts`, update the invites table types:

```typescript
invites: {
  Row: {
    id: string
    email: string
    token: string
    created_by: string
    expires_at: string
    accepted_at: string | null
    created_at: string
    name: string | null
    client_type: ClientType | null
    invite_sent_at: string | null
  }
  Insert: {
    id?: string
    email: string
    token: string
    created_by: string
    expires_at: string
    accepted_at?: string | null
    created_at?: string
    name?: string | null
    client_type?: ClientType | null
    invite_sent_at?: string | null
  }
  Update: {
    id?: string
    email?: string
    token?: string
    created_by?: string
    expires_at?: string
    accepted_at?: string | null
    created_at?: string
    name?: string | null
    client_type?: ClientType | null
    invite_sent_at?: string | null
  }
}
```

**Step 3: Run migration locally**

```bash
npx supabase db push
```

**Step 4: Commit**

```bash
git add supabase/migrations/079_bulk_invites.sql src/lib/supabase/types.ts
git commit -m "feat: add name, client_type, invite_sent_at fields to invites table"
```

---

## Task 2: Database Migration - Bookings Table

**Files:**
- Create: `supabase/migrations/080_booking_pending_clients.sql`
- Modify: `src/lib/supabase/types.ts` (if bookings type exists, otherwise skip)
- Modify: `src/types/booking.ts:55-80`

**Step 1: Create migration file**

```sql
-- Add invite_id to bookings for pending client bookings
-- Migration: 080_booking_pending_clients.sql

-- Add invite_id field (references pending invite for pre-booking)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES invites(id) ON DELETE SET NULL;

-- Create index for invite lookups
CREATE INDEX IF NOT EXISTS idx_bookings_invite_id
  ON bookings(invite_id)
  WHERE invite_id IS NOT NULL;

-- Update constraint to allow pending client bookings
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS booking_client_validation;

ALTER TABLE bookings ADD CONSTRAINT booking_client_validation CHECK (
  -- Regular booking: must have client_id
  (client_id IS NOT NULL AND one_off_client_name IS NULL AND invite_id IS NULL)
  OR
  -- One-off booking: must have one_off_client_name, no client_id
  (client_id IS NULL AND one_off_client_name IS NOT NULL AND invite_id IS NULL)
  OR
  -- Pending client booking: must have invite_id, no client_id, no one_off_client_name
  (client_id IS NULL AND one_off_client_name IS NULL AND invite_id IS NOT NULL)
);

-- Function to link bookings when invite is accepted
CREATE OR REPLACE FUNCTION link_bookings_on_invite_accept()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when accepted_at changes from NULL to a value
  IF OLD.accepted_at IS NULL AND NEW.accepted_at IS NOT NULL THEN
    -- Find the profile created with this email
    UPDATE bookings
    SET client_id = (
      SELECT id FROM profiles WHERE email = NEW.email LIMIT 1
    ),
    invite_id = NULL
    WHERE invite_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run when invite is accepted
DROP TRIGGER IF EXISTS trigger_link_bookings_on_invite_accept ON invites;
CREATE TRIGGER trigger_link_bookings_on_invite_accept
  AFTER UPDATE ON invites
  FOR EACH ROW
  EXECUTE FUNCTION link_bookings_on_invite_accept();
```

**Step 2: Update TypeScript booking types**

In `src/types/booking.ts`, update the Booking interface:

```typescript
export interface Booking {
  id: string
  clientId: string | null
  coachId: string
  packageId: string | null
  bookingType: BookingType
  startsAt: string
  endsAt: string
  status: BookingStatus
  googleEventId: string | null
  googleMeetLink: string | null
  rescheduledFromId: string | null
  cancelledAt: string | null
  oneOffClientName: string | null
  inviteId: string | null // For pending client bookings
  createdAt: string
  updatedAt: string
  // Joined fields
  client?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  } | null
  invite?: {
    id: string
    name: string
    email: string
  } | null
  package?: SessionPackage
  formResponse?: CheckinFormResponse
}
```

Also update `CreateBookingPayload`:

```typescript
export interface CreateBookingPayload {
  clientId?: string | null
  bookingType: BookingType
  startsAt: string
  endsAt: string
  packageId?: string
  oneOffClientName?: string
  isOneOff?: boolean
  inviteId?: string // For pending client bookings
}
```

**Step 3: Run migration locally**

```bash
npx supabase db push
```

**Step 4: Commit**

```bash
git add supabase/migrations/080_booking_pending_clients.sql src/types/booking.ts
git commit -m "feat: add invite_id to bookings for pending client bookings"
```

---

## Task 3: Bulk Invite API Endpoint

**Files:**
- Create: `src/app/api/invites/bulk/route.ts`

**Step 1: Create the bulk invite API endpoint**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ClientType } from '@/lib/supabase/types'

interface BulkInviteItem {
  email: string
  name: string
  clientType: ClientType
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is a coach
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Only coaches can create invites' }, { status: 403 })
    }

    const { invites } = await request.json() as { invites: BulkInviteItem[] }

    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      return NextResponse.json({ error: 'No invites provided' }, { status: 400 })
    }

    // Check for existing emails (in invites or profiles)
    const emails = invites.map(i => i.email.toLowerCase().trim())

    const { data: existingInvites } = await supabase
      .from('invites')
      .select('email')
      .in('email', emails)
      .is('accepted_at', null)

    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('email', emails)

    const existingEmails = new Set([
      ...(existingInvites || []).map(i => i.email),
      ...(existingProfiles || []).map(p => p.email),
    ])

    // Filter out duplicates
    const validInvites = invites.filter(i => !existingEmails.has(i.email.toLowerCase().trim()))
    const skippedEmails = invites
      .filter(i => existingEmails.has(i.email.toLowerCase().trim()))
      .map(i => i.email)

    if (validInvites.length === 0) {
      return NextResponse.json({
        error: 'All emails already exist',
        skippedEmails
      }, { status: 400 })
    }

    // Create invite records (no expiry or token yet - will be set when email is sent)
    const inviteRecords = validInvites.map(invite => ({
      email: invite.email.toLowerCase().trim(),
      name: invite.name.trim(),
      client_type: invite.clientType,
      token: crypto.randomUUID(), // Generate token now but don't send email
      created_by: user.id,
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year expiry (reset when sent)
    }))

    const { data: createdInvites, error: insertError } = await supabase
      .from('invites')
      .insert(inviteRecords)
      .select()

    if (insertError) {
      console.error('Error creating invites:', insertError)
      return NextResponse.json({ error: 'Failed to create invites' }, { status: 500 })
    }

    return NextResponse.json({
      created: createdInvites?.length || 0,
      skippedEmails,
      invites: createdInvites,
    })
  } catch (error) {
    console.error('Bulk invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/invites/bulk/route.ts
git commit -m "feat: add bulk invite creation API endpoint"
```

---

## Task 4: Send Invite API Endpoint

**Files:**
- Create: `src/app/api/invites/[id]/send/route.ts`

**Step 1: Create the send invite endpoint**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the invite
    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 })
    }

    // Generate new token and set 7-day expiry
    const newToken = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Update invite with new token, expiry, and sent timestamp
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        token: newToken,
        expires_at: expiresAt.toISOString(),
        invite_sent_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating invite:', updateError)
      return NextResponse.json({ error: 'Failed to update invite' }, { status: 500 })
    }

    // Get coach name for email
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const coachName = coachProfile?.name || 'Your Coach'
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL
    const inviteLink = `${baseUrl}/invite/${newToken}`

    // Send email
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          to: invite.email,
          template: 'client-invite',
          data: {
            inviteLink,
            coachName,
            clientName: invite.name,
          },
        },
      })
    } catch (emailErr) {
      console.error('Failed to send invite email:', emailErr)
      // Don't fail the request if email fails - invite is still updated
    }

    return NextResponse.json({
      success: true,
      inviteLink, // Return link in case email fails
    })
  } catch (error) {
    console.error('Send invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/invites/[id]/send/route.ts
git commit -m "feat: add send invite API endpoint"
```

---

## Task 5: Bulk Send Invites API Endpoint

**Files:**
- Create: `src/app/api/invites/bulk-send/route.ts`

**Step 1: Create the bulk send endpoint**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { inviteIds } = await request.json() as { inviteIds: string[] }

    if (!inviteIds || !Array.isArray(inviteIds) || inviteIds.length === 0) {
      return NextResponse.json({ error: 'No invite IDs provided' }, { status: 400 })
    }

    // Get invites
    const { data: invites, error: invitesError } = await supabase
      .from('invites')
      .select('*')
      .in('id', inviteIds)
      .eq('created_by', user.id)
      .is('accepted_at', null)

    if (invitesError || !invites || invites.length === 0) {
      return NextResponse.json({ error: 'No valid invites found' }, { status: 404 })
    }

    // Get coach name for emails
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .single()

    const coachName = coachProfile?.name || 'Your Coach'
    const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL

    const results: { id: string; success: boolean; error?: string }[] = []

    // Process each invite
    for (const invite of invites) {
      try {
        // Generate new token and set 7-day expiry
        const newToken = crypto.randomUUID()
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

        // Update invite
        const { error: updateError } = await supabase
          .from('invites')
          .update({
            token: newToken,
            expires_at: expiresAt.toISOString(),
            invite_sent_at: new Date().toISOString(),
          })
          .eq('id', invite.id)

        if (updateError) {
          results.push({ id: invite.id, success: false, error: 'Failed to update' })
          continue
        }

        // Send email
        const inviteLink = `${baseUrl}/invite/${newToken}`
        await supabase.functions.invoke('send-email', {
          body: {
            to: invite.email,
            template: 'client-invite',
            data: {
              inviteLink,
              coachName,
              clientName: invite.name,
            },
          },
        })

        results.push({ id: invite.id, success: true })
      } catch (err) {
        console.error(`Error sending invite ${invite.id}:`, err)
        results.push({ id: invite.id, success: false, error: 'Email failed' })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      sent: successCount,
      failed: failCount,
      results,
    })
  } catch (error) {
    console.error('Bulk send error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/invites/bulk-send/route.ts
git commit -m "feat: add bulk send invites API endpoint"
```

---

## Task 6: BulkAddClientsModal Component

**Files:**
- Create: `src/app/coach/clients/BulkAddClientsModal.tsx`

**Step 1: Create the modal component**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientType } from '@/lib/supabase/types'

interface ParsedClient {
  email: string
  name: string
  clientType: ClientType
  valid: boolean
  error?: string
}

interface BulkAddClientsModalProps {
  onClose: () => void
}

const CLIENT_TYPES: ClientType[] = ['online', 'training', 'hybrid']

function parseClientLine(line: string, lineNum: number): ParsedClient {
  const parts = line.split(',').map(p => p.trim())

  if (parts.length < 3) {
    return {
      email: parts[0] || '',
      name: parts[1] || '',
      clientType: 'online',
      valid: false,
      error: `Line ${lineNum}: Missing fields (need email, name, type)`,
    }
  }

  const [email, name, typeStr] = parts
  const clientType = typeStr.toLowerCase() as ClientType

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { email, name, clientType, valid: false, error: `Line ${lineNum}: Invalid email` }
  }

  // Validate name
  if (!name || name.length < 1) {
    return { email, name, clientType, valid: false, error: `Line ${lineNum}: Name required` }
  }

  // Validate client type
  if (!CLIENT_TYPES.includes(clientType)) {
    return {
      email, name, clientType: 'online', valid: false,
      error: `Line ${lineNum}: Invalid type (use online, training, or hybrid)`
    }
  }

  return { email, name, clientType, valid: true }
}

export function BulkAddClientsModal({ onClose }: BulkAddClientsModalProps) {
  const [input, setInput] = useState('')
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null)
  const router = useRouter()

  const handlePreview = () => {
    setError(null)
    const lines = input.split('\n').filter(l => l.trim())

    if (lines.length === 0) {
      setError('Please enter at least one client')
      return
    }

    const parsed = lines.map((line, i) => parseClientLine(line, i + 1))
    setParsedClients(parsed)
    setShowPreview(true)
  }

  const handleCreate = async () => {
    const validClients = parsedClients.filter(c => c.valid)

    if (validClients.length === 0) {
      setError('No valid clients to create')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/invites/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invites: validClients.map(c => ({
            email: c.email,
            name: c.name,
            clientType: c.clientType,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create clients')
      }

      setResult({
        created: data.created,
        skipped: data.skippedEmails || [],
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create clients')
    } finally {
      setCreating(false)
    }
  }

  const validCount = parsedClients.filter(c => c.valid).length
  const invalidCount = parsedClients.filter(c => !c.valid).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Bulk Add Clients</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Created {result.created} Pending Clients
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                You can now book sessions for these clients. Send invite emails when you&apos;re ready.
              </p>
              {result.skipped.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 text-left mb-4">
                  <p className="text-amber-600 dark:text-amber-400 font-medium text-sm mb-1">
                    {result.skipped.length} emails skipped (already exist):
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    {result.skipped.join(', ')}
                  </p>
                </div>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          ) : !showPreview ? (
            /* Input State */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Paste client list
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  One client per line: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">email, name, type</code>
                  <br />
                  Type can be: online, training, or hybrid
                </p>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="john@example.com, John Smith, training&#10;jane@example.com, Jane Doe, online&#10;mike@example.com, Mike Johnson, hybrid"
                  rows={10}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-mono text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!input.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preview
                </button>
              </div>
            </div>
          ) : (
            /* Preview State */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {validCount > 0 && (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      {validCount} valid
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                      {invalidCount} invalid
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Edit list
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Email</th>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Name</th>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Type</th>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {parsedClients.map((client, i) => (
                      <tr key={i} className={client.valid ? '' : 'bg-red-50 dark:bg-red-500/5'}>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{client.email}</td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{client.name}</td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white capitalize">{client.clientType}</td>
                        <td className="px-4 py-2">
                          {client.valid ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Valid</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">{client.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || validCount === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : `Create ${validCount} Clients`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/coach/clients/BulkAddClientsModal.tsx
git commit -m "feat: add BulkAddClientsModal component"
```

---

## Task 7: Update ClientsTable with Pending Clients

**Files:**
- Modify: `src/app/coach/clients/ClientsTable.tsx`

**Step 1: Update the ClientsTable component**

Update the Invite interface and add new state/UI:

```typescript
// Update the Invite interface at the top
interface Invite {
  id: string
  email: string
  name: string | null
  client_type: 'online' | 'training' | 'hybrid' | null
  expires_at: string
  created_at: string
  invite_sent_at: string | null
}

// Add to ClientsTableProps
interface ClientsTableProps {
  clients: Client[]
  workoutsByUser: Record<string, string[]>
  pendingInvites: Invite[]
}
```

The full updated component integrates:
- Filter tabs: All | Active | Pending
- Checkbox selection for bulk actions
- Send Invite / Resend Invite buttons
- Pending status badges
- Bulk "Send Invites" action

Due to length, see the implementation in the codebase. Key changes:

1. Add filter state: `const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')`
2. Add selection state: `const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set())`
3. Add filter tabs UI before the search
4. Update pending invites section to show as table rows with checkboxes
5. Add bulk action bar when invites are selected
6. Add individual Send Invite button per pending row

**Step 2: Commit**

```bash
git add src/app/coach/clients/ClientsTable.tsx
git commit -m "feat: update ClientsTable with pending client filters and bulk actions"
```

---

## Task 8: Update Clients Page Server Component

**Files:**
- Modify: `src/app/coach/clients/page.tsx`

**Step 1: Update the query to include new invite fields**

```typescript
import { createClient } from '@/lib/supabase/server'
import { ClientsTable } from './ClientsTable'

export default async function ClientsPage() {
  const supabase = await createClient()

  // Get all clients with their program assignments
  const { data: clients } = await supabase
    .from('profiles')
    .select(`
      *,
      user_program_assignments(
        *,
        programs(name, id)
      )
    `)
    .eq('role', 'client')
    .order('name')

  // Get workout logs for the last 7 days for all clients
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)

  const { data: workoutLogs } = await supabase
    .from('workout_logs')
    .select('user_id, completed_at')
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgo.toISOString())

  // Create a map of user_id to completed dates
  const workoutsByUser: Record<string, string[]> = {}
  workoutLogs?.forEach((log) => {
    if (!workoutsByUser[log.user_id]) {
      workoutsByUser[log.user_id] = []
    }
    if (log.completed_at) {
      const dateStr = new Date(log.completed_at).toISOString().split('T')[0]
      if (!workoutsByUser[log.user_id].includes(dateStr)) {
        workoutsByUser[log.user_id].push(dateStr)
      }
    }
  })

  // Get pending invites with new fields
  const { data: pendingInvites } = await supabase
    .from('invites')
    .select('id, email, name, client_type, expires_at, created_at, invite_sent_at')
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ClientsTable
        clients={clients || []}
        workoutsByUser={workoutsByUser}
        pendingInvites={pendingInvites || []}
      />
    </main>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/coach/clients/page.tsx
git commit -m "feat: update clients page to fetch new invite fields"
```

---

## Task 9: Update BookSessionModal for Pending Clients

**Files:**
- Modify: `src/components/booking/BookSessionModal.tsx`

**Step 1: Add pending clients to the client selector**

Update the props interface:

```typescript
interface PendingClient {
  id: string // invite id
  name: string
  email: string
  clientType: 'online' | 'training' | 'hybrid'
}

interface BookSessionModalProps {
  isOpen: boolean
  onClose: () => void
  clients: ClientWithPackage[]
  pendingClients?: PendingClient[] // Add this
  preselectedClientId?: string
  preselectedDate?: string
  onSuccess: () => void
}
```

Add a constant for pending client prefix:

```typescript
const PENDING_CLIENT_PREFIX = '__pending__'
```

Update the client selector to include pending clients:

```typescript
<select ...>
  <option value="">Select a client</option>
  <option value={ONE_OFF_BOOKING_ID}>One-off booking (no account)</option>
  {pendingClients && pendingClients.length > 0 && (
    <optgroup label="Pending Clients">
      {pendingClients.map((client) => (
        <option key={client.id} value={`${PENDING_CLIENT_PREFIX}${client.id}`}>
          {client.name} ({client.email}) - Pending
        </option>
      ))}
    </optgroup>
  )}
  <optgroup label="Active Clients">
    {clients.map((client) => (
      <option key={client.id} value={client.id}>
        {client.name} - {client.activePackage ? `${client.activePackage.remainingSessions} sessions` : 'No package'}
      </option>
    ))}
  </optgroup>
</select>
```

Update the submit handler to pass inviteId:

```typescript
const isPendingClient = selectedClientId.startsWith(PENDING_CLIENT_PREFIX)
const inviteId = isPendingClient ? selectedClientId.replace(PENDING_CLIENT_PREFIX, '') : undefined

const payloads = selectedSlots.map((slot) => ({
  clientId: isOneOffBooking || isPendingClient ? null : selectedClientId,
  bookingType,
  startsAt: slot.startsAt,
  endsAt: slot.endsAt,
  packageId: bookingType === 'session' && !isOneOffBooking && !isPendingClient ? selectedClient?.activePackage?.id : undefined,
  oneOffClientName: isOneOffBooking ? oneOffClientName.trim() : undefined,
  isOneOff: isOneOffBooking,
  inviteId: isPendingClient ? inviteId : undefined,
}))
```

**Step 2: Commit**

```bash
git add src/components/booking/BookSessionModal.tsx
git commit -m "feat: add pending clients to BookSessionModal"
```

---

## Task 10: Update Booking API to Support Pending Clients

**Files:**
- Modify: `src/app/api/bookings/route.ts`

**Step 1: Update the booking creation to handle inviteId**

In the POST handler, add support for inviteId:

```typescript
// After extracting fields from the request body
const { clientId, bookingType, startsAt, endsAt, packageId, oneOffClientName, isOneOff, inviteId } = body

// Validation - one of clientId, oneOffClientName, or inviteId must be provided
if (!clientId && !oneOffClientName && !inviteId) {
  return NextResponse.json({ error: 'Client, one-off name, or pending invite required' }, { status: 400 })
}

// If inviteId provided, verify it exists and belongs to this coach
if (inviteId) {
  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('id, created_by')
    .eq('id', inviteId)
    .is('accepted_at', null)
    .single()

  if (inviteError || !invite || invite.created_by !== user.id) {
    return NextResponse.json({ error: 'Invalid pending client' }, { status: 400 })
  }
}

// In the insert, include invite_id
const { data: booking, error: insertError } = await supabase
  .from('bookings')
  .insert({
    client_id: clientId || null,
    coach_id: user.id,
    package_id: packageId || null,
    booking_type: bookingType,
    starts_at: startsAt,
    ends_at: endsAt,
    one_off_client_name: oneOffClientName || null,
    invite_id: inviteId || null,
  })
  .select()
  .single()
```

**Step 2: Commit**

```bash
git add src/app/api/bookings/route.ts
git commit -m "feat: update booking API to support pending client inviteId"
```

---

## Task 11: Update Invite Acceptance Page

**Files:**
- Modify: `src/app/(auth)/invite/[token]/page.tsx`

**Step 1: Pre-fill form from invite data**

Update the useEffect to set name and clientType from invite:

```typescript
useEffect(() => {
  async function fetchInvite() {
    try {
      const { data: inviteData, error: inviteError } = await supabase
        .from('invites')
        .select('email, expires_at, accepted_at, created_by, name, client_type')
        .eq('token', token)
        .single()

      if (inviteError || !inviteData) {
        setError('Invalid or expired invite link')
        setLoading(false)
        return
      }

      // ... existing validation ...

      // Pre-fill name and client type if provided
      if (inviteData.name) {
        setName(inviteData.name)
      }
      if (inviteData.client_type) {
        setClientType(inviteData.client_type)
      }

      setInviteData({
        email: inviteData.email,
        coach_name: coachName,
        expires_at: inviteData.expires_at,
      })
    } catch {
      setError('Failed to load invite')
    } finally {
      setLoading(false)
    }
  }

  fetchInvite()
}, [token, supabase])
```

**Step 2: Commit**

```bash
git add src/app/(auth)/invite/[token]/page.tsx
git commit -m "feat: pre-fill invite acceptance form with name and client type"
```

---

## Task 12: Update useBookings Hook

**Files:**
- Modify: `src/hooks/useBookings.ts`

**Step 1: Update the hook to handle inviteId in payloads**

Ensure the CreateBookingPayload type includes inviteId and the createMultipleBookings function passes it through:

```typescript
// In the createMultipleBookings function, ensure inviteId is included
const response = await fetch('/api/bookings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ...payload,
    inviteId: payload.inviteId, // Ensure this is passed
  }),
})
```

**Step 2: Commit**

```bash
git add src/hooks/useBookings.ts
git commit -m "feat: update useBookings hook to support inviteId"
```

---

## Task 13: Update Coach Bookings Page to Fetch Pending Clients

**Files:**
- Modify: `src/app/coach/bookings/page.tsx`
- Modify: `src/app/coach/bookings/CoachBookingsClient.tsx`

**Step 1: Fetch pending clients in the server component**

```typescript
// Add this query
const { data: pendingInvites } = await supabase
  .from('invites')
  .select('id, email, name, client_type')
  .is('accepted_at', null)
  .not('name', 'is', null)

const pendingClients = (pendingInvites || []).map(invite => ({
  id: invite.id,
  name: invite.name!,
  email: invite.email,
  clientType: invite.client_type || 'online',
}))

// Pass to client component
<CoachBookingsClient
  // ... existing props
  pendingClients={pendingClients}
/>
```

**Step 2: Update the client component to pass pending clients to modal**

```typescript
// Update props interface
interface CoachBookingsClientProps {
  // ... existing props
  pendingClients: PendingClient[]
}

// Pass to BookSessionModal
<BookSessionModal
  // ... existing props
  pendingClients={pendingClients}
/>
```

**Step 3: Commit**

```bash
git add src/app/coach/bookings/page.tsx src/app/coach/bookings/CoachBookingsClient.tsx
git commit -m "feat: pass pending clients to booking modal in coach bookings page"
```

---

## Task 14: Update Booking Display to Show Pending Client Names

**Files:**
- Modify: `src/hooks/useBookings.ts` (fetch query)
- Modify: `src/app/coach/bookings/CoachBookingsClient.tsx` (display)

**Step 1: Update booking fetch to include invite data**

In the useBookings hook or wherever bookings are fetched, join the invite:

```typescript
const { data: bookings } = await supabase
  .from('bookings')
  .select(`
    *,
    client:profiles!client_id(id, name, email, avatar_url),
    invite:invites!invite_id(id, name, email),
    package:session_packages(*)
  `)
  // ... rest of query
```

**Step 2: Update display to show invite name when client is null**

```typescript
// When displaying client name
const clientName = booking.client?.name
  || booking.invite?.name
  || booking.oneOffClientName
  || 'Unknown'

// Add a "Pending" badge if it's from an invite
{booking.invite && !booking.client && (
  <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
    Pending
  </span>
)}
```

**Step 3: Commit**

```bash
git add src/hooks/useBookings.ts src/app/coach/bookings/CoachBookingsClient.tsx
git commit -m "feat: display pending client names in booking views"
```

---

## Task 15: Final Integration Test

**Step 1: Test bulk client creation**

1. Go to /coach/clients
2. Click "Bulk Add" button
3. Paste test data:
   ```
   test1@example.com, Test User 1, training
   test2@example.com, Test User 2, online
   test3@example.com, Test User 3, hybrid
   ```
4. Click Preview, verify parsing
5. Click Create Clients
6. Verify pending clients appear in list with "Pending" badge

**Step 2: Test booking pending clients**

1. Go to /coach/bookings
2. Click "Book Session"
3. Select a pending client from dropdown
4. Select date and time slot
5. Book the session
6. Verify booking appears with pending client name

**Step 3: Test sending invites**

1. Go to /coach/clients
2. Find a pending client
3. Click "Send Invite" button
4. Verify invite_sent_at is updated
5. Test bulk send by selecting multiple and clicking "Send Invites"

**Step 4: Test invite acceptance**

1. Copy invite link
2. Open in incognito
3. Verify name and client type are pre-filled
4. Complete signup
5. Verify bookings are linked to new profile

**Step 5: Commit final changes**

```bash
git add -A
git commit -m "feat: complete mass client creation feature"
```

---

## Summary

This implementation enables:
1. Bulk creation of pending clients via paste interface
2. Booking sessions for pending clients before they have accounts
3. Sending invite emails individually or in bulk
4. Automatic linking of bookings when clients accept invites
5. Visual distinction between active and pending clients
6. Pre-filled invite acceptance forms
