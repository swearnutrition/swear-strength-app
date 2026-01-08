# Client Subscriptions Design

## Overview

Add support for client subscriptions alongside existing prepaid session packages. Two subscription types:

1. **Hybrid** - Monthly session allocation that carries over (capped at 2x monthly)
2. **Online Only** - Pure subscription tracking with no session allocation

## Data Model

### New table: `client_subscriptions`

```sql
CREATE TABLE client_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_id UUID REFERENCES invites(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),

  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('hybrid', 'online_only')),

  -- For hybrid subscriptions only
  monthly_sessions INTEGER,
  available_sessions INTEGER,
  session_duration_minutes INTEGER,

  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT subscription_client_or_invite CHECK (
    (client_id IS NOT NULL AND invite_id IS NULL) OR
    (client_id IS NULL AND invite_id IS NOT NULL)
  ),
  CONSTRAINT hybrid_requires_sessions CHECK (
    subscription_type != 'hybrid' OR
    (monthly_sessions IS NOT NULL AND available_sessions IS NOT NULL AND session_duration_minutes IS NOT NULL)
  )
);
```

### Booking table addition

```sql
ALTER TABLE bookings ADD COLUMN subscription_id UUID REFERENCES client_subscriptions(id);
```

## Session Deduction Logic

When booking a session for a client:

1. Check for active hybrid subscription with `available_sessions > 0`
2. If found, deduct from subscription
3. If not, fall back to prepaid packages (existing behavior)
4. If neither, session is booked without deduction

## Monthly Credit (Hybrid Only)

pg_cron job runs on 1st of each month:

```sql
UPDATE client_subscriptions
SET
  available_sessions = LEAST(available_sessions + monthly_sessions, monthly_sessions * 2),
  updated_at = now()
WHERE is_active = true AND subscription_type = 'hybrid';
```

Cap at 2x monthly allocation prevents unlimited accumulation.

## UI

Packages page gains a "Subscriptions" tab showing:

| Client | Type | Status | Sessions |
|--------|------|--------|----------|
| Jane Doe | Hybrid | Active | 6/8 available (4/mo) |
| Bob Smith | Online Only | Active | — |

Actions: Edit, Adjust Balance, Delete

## Implementation

1. Migration: `083_client_subscriptions.sql`
2. API: `/api/subscriptions/route.ts` (GET, POST)
3. API: `/api/subscriptions/[id]/route.ts` (PATCH, DELETE)
4. Types: Add `ClientSubscription` interface
5. UI: Add tabs and subscription management to PackagesClient
6. Booking API: Check subscriptions before packages
