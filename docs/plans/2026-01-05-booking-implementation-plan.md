# Booking Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a booking system for in-person training sessions and virtual check-ins with Google Calendar integration.

**Architecture:** Supabase tables with RLS for data, Next.js API routes for business logic, React hooks for state management, Edge Functions for scheduled jobs (reminders, streak calculation). Google Calendar API for calendar sync and Meet link generation.

**Tech Stack:** Next.js 16, Supabase (Postgres + Edge Functions + pg_cron), Google Calendar API, web-push for notifications, Resend for emails.

---

## Phase 1: Database Schema

### Task 1.1: Create Session Packages Migration

**Files:**
- Create: `supabase/migrations/060_session_packages.sql`

**Step 1: Write the migration**

```sql
-- Session packages for in-person training clients
-- Migration: 060_session_packages.sql

-- Session packages table
CREATE TABLE IF NOT EXISTS session_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
  remaining_sessions INTEGER NOT NULL CHECK (remaining_sessions >= 0),
  session_duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (session_duration_minutes > 0),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Package adjustment history
CREATE TABLE IF NOT EXISTS session_package_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES session_packages(id) ON DELETE CASCADE,
  adjustment INTEGER NOT NULL,
  previous_balance INTEGER NOT NULL,
  new_balance INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_packages_client_id ON session_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_coach_id ON session_packages(coach_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_expires_at ON session_packages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_package_adjustments_package_id ON session_package_adjustments(package_id);

-- Enable RLS
ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_package_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_packages
CREATE POLICY "Coaches can view their clients packages"
  ON session_packages FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own packages"
  ON session_packages FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can create packages for their clients"
  ON session_packages FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "Coaches can update their clients packages"
  ON session_packages FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their clients packages"
  ON session_packages FOR DELETE
  USING (coach_id = auth.uid());

-- RLS Policies for session_package_adjustments
CREATE POLICY "Coaches can view adjustments for their packages"
  ON session_package_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.id = package_id AND sp.coach_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view adjustments for their packages"
  ON session_package_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.id = package_id AND sp.client_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can create adjustments"
  ON session_package_adjustments FOR INSERT
  WITH CHECK (
    adjusted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.id = package_id AND sp.coach_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_session_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_session_packages_updated_at
  BEFORE UPDATE ON session_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
```

**Step 2: Apply migration locally**

Run: `npx supabase db push` or apply via Supabase dashboard

**Step 3: Commit**

```bash
git add supabase/migrations/060_session_packages.sql
git commit -m "feat(db): add session_packages and adjustments tables"
```

---

### Task 1.2: Create Bookings Migration

**Files:**
- Create: `supabase/migrations/061_bookings.sql`

**Step 1: Write the migration**

```sql
-- Bookings table for sessions and check-ins
-- Migration: 061_bookings.sql

-- Booking type enum
DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM ('session', 'checkin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Booking status enum
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed', 'no_show');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES session_packages(id) ON DELETE SET NULL,
  booking_type booking_type NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  google_event_id TEXT,
  google_meet_link TEXT,
  rescheduled_from_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (ends_at > starts_at),
  CONSTRAINT checkin_has_no_package CHECK (
    (booking_type = 'session' AND package_id IS NOT NULL) OR
    (booking_type = 'checkin' AND package_id IS NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_coach_id ON bookings(coach_id);
CREATE INDEX IF NOT EXISTS idx_bookings_package_id ON bookings(package_id) WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type_status ON bookings(booking_type, status);

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Coaches can view all their bookings"
  ON bookings FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own bookings"
  ON bookings FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "Clients can create their own bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'client'
    )
  );

CREATE POLICY "Coaches can update their bookings"
  ON bookings FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Clients can update their own bookings"
  ON bookings FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER trigger_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
```

**Step 2: Apply migration locally**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/061_bookings.sql
git commit -m "feat(db): add bookings table with RLS"
```

---

### Task 1.3: Create Availability Templates Migration

**Files:**
- Create: `supabase/migrations/062_coach_availability.sql`

**Step 1: Write the migration**

```sql
-- Coach availability templates and overrides
-- Migration: 062_coach_availability.sql

-- Availability type enum
DO $$ BEGIN
  CREATE TYPE availability_type AS ENUM ('session', 'checkin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Weekly availability templates
CREATE TABLE IF NOT EXISTS coach_availability_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  availability_type availability_type NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_concurrent_clients INTEGER NOT NULL DEFAULT 2 CHECK (max_concurrent_clients > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT unique_coach_day_type UNIQUE (coach_id, availability_type, day_of_week, start_time)
);

-- Date-specific overrides (blackouts or extra availability)
CREATE TABLE IF NOT EXISTS coach_availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  availability_type availability_type NOT NULL,
  override_date DATE NOT NULL,
  start_time TIME, -- NULL means entire day
  end_time TIME,
  is_blocked BOOLEAN NOT NULL DEFAULT true,
  max_concurrent_clients INTEGER CHECK (max_concurrent_clients > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_override_time CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_templates_coach ON coach_availability_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_availability_templates_lookup ON coach_availability_templates(coach_id, availability_type, day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_coach ON coach_availability_overrides(coach_id);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_lookup ON coach_availability_overrides(coach_id, availability_type, override_date);

-- Enable RLS
ALTER TABLE coach_availability_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_availability_overrides ENABLE ROW LEVEL SECURITY;

-- RLS for templates
CREATE POLICY "Coaches can manage their own templates"
  ON coach_availability_templates FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Anyone can view coach templates"
  ON coach_availability_templates FOR SELECT
  USING (true);

-- RLS for overrides
CREATE POLICY "Coaches can manage their own overrides"
  ON coach_availability_overrides FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Anyone can view coach overrides"
  ON coach_availability_overrides FOR SELECT
  USING (true);
```

**Step 2: Apply migration locally**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/062_coach_availability.sql
git commit -m "feat(db): add coach availability templates and overrides"
```

---

### Task 1.4: Create Check-in Forms Migration

**Files:**
- Create: `supabase/migrations/063_checkin_forms.sql`

**Step 1: Write the migration**

```sql
-- Check-in forms for virtual appointments
-- Migration: 063_checkin_forms.sql

-- Question type enum
DO $$ BEGIN
  CREATE TYPE checkin_question_type AS ENUM ('text', 'textarea', 'select', 'checkbox', 'radio');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Coach-defined form questions
CREATE TABLE IF NOT EXISTS checkin_form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type checkin_question_type NOT NULL DEFAULT 'text',
  options JSONB, -- For select/radio/checkbox: ["Option 1", "Option 2"]
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client responses to form questions
CREATE TABLE IF NOT EXISTS checkin_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  responses JSONB NOT NULL, -- { "question_id": "answer", ... }
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_booking_response UNIQUE (booking_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkin_questions_coach ON checkin_form_questions(coach_id);
CREATE INDEX IF NOT EXISTS idx_checkin_questions_order ON checkin_form_questions(coach_id, sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_checkin_responses_booking ON checkin_form_responses(booking_id);
CREATE INDEX IF NOT EXISTS idx_checkin_responses_client ON checkin_form_responses(client_id);

-- Enable RLS
ALTER TABLE checkin_form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_form_responses ENABLE ROW LEVEL SECURITY;

-- RLS for questions
CREATE POLICY "Coaches can manage their own questions"
  ON checkin_form_questions FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Clients can view active questions from their coach"
  ON checkin_form_questions FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.client_id = auth.uid() AND b.coach_id = checkin_form_questions.coach_id
    )
  );

-- RLS for responses
CREATE POLICY "Coaches can view responses for their bookings"
  ON checkin_form_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.coach_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their own responses"
  ON checkin_form_responses FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can submit responses for their bookings"
  ON checkin_form_responses FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update their own responses"
  ON checkin_form_responses FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Updated at trigger for questions
CREATE TRIGGER trigger_checkin_questions_updated_at
  BEFORE UPDATE ON checkin_form_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
```

**Step 2: Apply migration locally**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/063_checkin_forms.sql
git commit -m "feat(db): add check-in form questions and responses"
```

---

### Task 1.5: Create Client Booking Stats Migration

**Files:**
- Create: `supabase/migrations/064_client_booking_stats.sql`

**Step 1: Write the migration**

```sql
-- Client booking statistics and check-in usage tracking
-- Migration: 064_client_booking_stats.sql

-- Client booking stats (streaks, flags, favorites)
CREATE TABLE IF NOT EXISTS client_booking_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak_weeks INTEGER NOT NULL DEFAULT 0,
  longest_streak_weeks INTEGER NOT NULL DEFAULT 0,
  no_show_count_90d INTEGER NOT NULL DEFAULT 0,
  cancellation_count_90d INTEGER NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  favorite_times JSONB DEFAULT '[]', -- [{ "day": 1, "time": "16:00" }, ...]
  last_streak_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_client_coach_stats UNIQUE (client_id, coach_id)
);

-- Monthly check-in usage tracking
CREATE TABLE IF NOT EXISTS client_checkin_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First of month (e.g., 2026-01-01)
  used BOOLEAN NOT NULL DEFAULT false,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_client_coach_month UNIQUE (client_id, coach_id, month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_stats_client ON client_booking_stats(client_id);
CREATE INDEX IF NOT EXISTS idx_booking_stats_coach ON client_booking_stats(coach_id);
CREATE INDEX IF NOT EXISTS idx_booking_stats_flagged ON client_booking_stats(coach_id) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_checkin_usage_lookup ON client_checkin_usage(client_id, coach_id, month);

-- Enable RLS
ALTER TABLE client_booking_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_checkin_usage ENABLE ROW LEVEL SECURITY;

-- RLS for stats
CREATE POLICY "Coaches can view their clients stats"
  ON client_booking_stats FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own stats"
  ON client_booking_stats FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "System can manage stats"
  ON client_booking_stats FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS for check-in usage
CREATE POLICY "Coaches can view their clients checkin usage"
  ON client_checkin_usage FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own checkin usage"
  ON client_checkin_usage FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "System can manage checkin usage"
  ON client_checkin_usage FOR ALL
  USING (true)
  WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER trigger_booking_stats_updated_at
  BEFORE UPDATE ON client_booking_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
```

**Step 2: Apply migration locally**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/064_client_booking_stats.sql
git commit -m "feat(db): add client booking stats and checkin usage tracking"
```

---

### Task 1.6: Create Google Calendar Credentials Migration

**Files:**
- Create: `supabase/migrations/065_google_calendar_credentials.sql`

**Step 1: Write the migration**

```sql
-- Google Calendar OAuth credentials storage
-- Migration: 065_google_calendar_credentials.sql

CREATE TABLE IF NOT EXISTS google_calendar_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  calendar_id TEXT, -- Which calendar to use (null = primary)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_coach_google_creds UNIQUE (coach_id)
);

-- Booking settings per coach
CREATE TABLE IF NOT EXISTS coach_booking_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_window_days INTEGER NOT NULL DEFAULT 90, -- 3 months
  min_notice_hours INTEGER NOT NULL DEFAULT 12,
  renewal_reminder_threshold INTEGER NOT NULL DEFAULT 2, -- sessions remaining
  session_slot_interval_minutes INTEGER NOT NULL DEFAULT 30,
  checkin_duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_coach_booking_settings UNIQUE (coach_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_google_creds_coach ON google_calendar_credentials(coach_id);
CREATE INDEX IF NOT EXISTS idx_booking_settings_coach ON coach_booking_settings(coach_id);

-- Enable RLS
ALTER TABLE google_calendar_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_booking_settings ENABLE ROW LEVEL SECURITY;

-- RLS for google credentials (coach only)
CREATE POLICY "Coaches can manage their own google credentials"
  ON google_calendar_credentials FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- RLS for booking settings
CREATE POLICY "Coaches can manage their own booking settings"
  ON coach_booking_settings FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Clients can view their coach booking settings"
  ON coach_booking_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.client_id = auth.uid() AND b.coach_id = coach_booking_settings.coach_id
    )
    OR EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.client_id = auth.uid() AND sp.coach_id = coach_booking_settings.coach_id
    )
  );

-- Updated at triggers
CREATE TRIGGER trigger_google_creds_updated_at
  BEFORE UPDATE ON google_calendar_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();

CREATE TRIGGER trigger_booking_settings_updated_at
  BEFORE UPDATE ON coach_booking_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
```

**Step 2: Apply migration locally**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/065_google_calendar_credentials.sql
git commit -m "feat(db): add google calendar credentials and booking settings"
```

---

## Phase 2: TypeScript Types

### Task 2.1: Create Booking Types

**Files:**
- Create: `src/types/booking.ts`

**Step 1: Write the types**

```typescript
// Booking system types

export type BookingType = 'session' | 'checkin'
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type AvailabilityType = 'session' | 'checkin'
export type CheckinQuestionType = 'text' | 'textarea' | 'select' | 'checkbox' | 'radio'

// Session Packages
export interface SessionPackage {
  id: string
  clientId: string
  coachId: string
  totalSessions: number
  remainingSessions: number
  sessionDurationMinutes: number
  expiresAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  // Joined fields
  client?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

export interface SessionPackageAdjustment {
  id: string
  packageId: string
  adjustment: number
  previousBalance: number
  newBalance: number
  reason: string | null
  adjustedBy: string
  createdAt: string
}

export interface CreateSessionPackagePayload {
  clientId: string
  totalSessions: number
  sessionDurationMinutes: number
  expiresAt?: string | null
  notes?: string
}

export interface AdjustSessionPackagePayload {
  packageId: string
  adjustment: number
  reason?: string
}

// Bookings
export interface Booking {
  id: string
  clientId: string
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
  createdAt: string
  updatedAt: string
  // Joined fields
  client?: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  package?: SessionPackage
  formResponse?: CheckinFormResponse
}

export interface CreateBookingPayload {
  clientId: string
  bookingType: BookingType
  startsAt: string
  endsAt: string
  packageId?: string // Required for sessions
}

export interface RescheduleBookingPayload {
  bookingId: string
  newStartsAt: string
  newEndsAt: string
}

// Availability
export interface AvailabilityTemplate {
  id: string
  coachId: string
  availabilityType: AvailabilityType
  dayOfWeek: number // 0-6 (Sunday-Saturday)
  startTime: string // "09:00"
  endTime: string // "17:00"
  maxConcurrentClients: number
}

export interface AvailabilityOverride {
  id: string
  coachId: string
  availabilityType: AvailabilityType
  overrideDate: string // "2026-01-15"
  startTime: string | null // null = entire day
  endTime: string | null
  isBlocked: boolean
  maxConcurrentClients: number | null
}

export interface CreateAvailabilityTemplatePayload {
  availabilityType: AvailabilityType
  dayOfWeek: number
  startTime: string
  endTime: string
  maxConcurrentClients?: number
}

export interface CreateAvailabilityOverridePayload {
  availabilityType: AvailabilityType
  overrideDate: string
  startTime?: string
  endTime?: string
  isBlocked: boolean
  maxConcurrentClients?: number
}

// Available time slots (computed)
export interface AvailableSlot {
  startsAt: string
  endsAt: string
  availableCapacity: number
  isFavorite?: boolean
}

// Check-in Forms
export interface CheckinFormQuestion {
  id: string
  coachId: string
  question: string
  questionType: CheckinQuestionType
  options: string[] | null
  sortOrder: number
  isRequired: boolean
  isActive: boolean
  createdAt: string
}

export interface CheckinFormResponse {
  id: string
  bookingId: string
  clientId: string
  responses: Record<string, string | string[]> // questionId -> answer
  submittedAt: string
}

export interface CreateCheckinQuestionPayload {
  question: string
  questionType: CheckinQuestionType
  options?: string[]
  isRequired?: boolean
}

export interface SubmitCheckinFormPayload {
  bookingId: string
  responses: Record<string, string | string[]>
}

// Client Stats
export interface ClientBookingStats {
  id: string
  clientId: string
  coachId: string
  currentStreakWeeks: number
  longestStreakWeeks: number
  noShowCount90d: number
  cancellationCount90d: number
  isFlagged: boolean
  favoriteTimes: Array<{ day: number; time: string }>
  lastStreakUpdate: string | null
}

export interface ClientCheckinUsage {
  id: string
  clientId: string
  coachId: string
  month: string // "2026-01-01"
  used: boolean
  bookingId: string | null
}

// Booking Settings
export interface CoachBookingSettings {
  id: string
  coachId: string
  bookingWindowDays: number
  minNoticeHours: number
  renewalReminderThreshold: number
  sessionSlotIntervalMinutes: number
  checkinDurationMinutes: number
}

// Google Calendar
export interface GoogleCalendarCredentials {
  id: string
  coachId: string
  accessToken: string
  refreshToken: string
  tokenExpiry: string
  calendarId: string | null
}

// Dashboard views
export interface BookingWithDetails extends Booking {
  client: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  formResponse?: CheckinFormResponse
}

export interface ClientBookingSummary {
  client: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
  activePackage: SessionPackage | null
  upcomingBookings: Booking[]
  stats: ClientBookingStats | null
  checkinUsage: ClientCheckinUsage | null
}

export interface DailySummary {
  date: string
  bookings: BookingWithDetails[]
  clientsNeedingRenewal: Array<{
    client: { id: string; name: string }
    package: SessionPackage
    reason: 'low_sessions' | 'expiring_soon'
  }>
}
```

**Step 2: Commit**

```bash
git add src/types/booking.ts
git commit -m "feat: add booking system TypeScript types"
```

---

## Phase 3: Core API Routes

### Task 3.1: Session Packages API - GET & POST

**Files:**
- Create: `src/app/api/session-packages/route.ts`

**Step 1: Write the failing test**

Create `src/app/api/session-packages/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the createClient function
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('Session Packages API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 if user is not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any)

    const { GET } = await import('../route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 403 if user is not a coach', async () => {
    const { createClient } = await import('@/lib/supabase/server')
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'client' } }),
          }),
        }),
      }),
    } as any)

    const { GET } = await import('../route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Forbidden')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm test src/app/api/session-packages/__tests__/route.test.ts`

Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `src/app/api/session-packages/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateSessionPackagePayload } from '@/types/booking'

export async function GET() {
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

  // 3. Fetch all packages for this coach with client info
  try {
    const { data: packages, error } = await supabase
      .from('session_packages')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url)
      `)
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ packages: packages || [] })
  } catch (error) {
    console.error('Error fetching session packages:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch packages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
  let payload: CreateSessionPackagePayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 4. Validate required fields
  if (!payload.clientId || !payload.totalSessions || !payload.sessionDurationMinutes) {
    return NextResponse.json(
      { error: 'Missing required fields: clientId, totalSessions, sessionDurationMinutes' },
      { status: 400 }
    )
  }

  // 5. Create the package
  try {
    const { data: newPackage, error } = await supabase
      .from('session_packages')
      .insert({
        client_id: payload.clientId,
        coach_id: user.id,
        total_sessions: payload.totalSessions,
        remaining_sessions: payload.totalSessions,
        session_duration_minutes: payload.sessionDurationMinutes,
        expires_at: payload.expiresAt || null,
        notes: payload.notes || null,
      })
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ package: newPackage }, { status: 201 })
  } catch (error) {
    console.error('Error creating session package:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create package' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/app/api/session-packages/__tests__/route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/session-packages/
git commit -m "feat: add session packages API (GET, POST)"
```

---

### Task 3.2: Session Packages API - Adjust Sessions

**Files:**
- Create: `src/app/api/session-packages/[id]/adjust/route.ts`

**Step 1: Write the implementation**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/app/api/session-packages/[id]/adjust/route.ts
git commit -m "feat: add session package adjustment API"
```

---

### Task 3.3: Bookings API - GET & POST

**Files:**
- Create: `src/app/api/bookings/route.ts`

**Step 1: Write the implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { CreateBookingPayload } from '@/types/booking'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const status = searchParams.get('status')
  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. Build query based on role
  try {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        package:session_packages(id, total_sessions, remaining_sessions, session_duration_minutes),
        formResponse:checkin_form_responses(id, responses, submitted_at)
      `)
      .order('starts_at', { ascending: true })

    if (profile?.role === 'coach') {
      query = query.eq('coach_id', user.id)
      if (clientId) {
        query = query.eq('client_id', clientId)
      }
    } else {
      // Client can only see their own bookings
      query = query.eq('client_id', user.id)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (fromDate) {
      query = query.gte('starts_at', fromDate)
    }

    if (toDate) {
      query = query.lte('starts_at', toDate)
    }

    const { data: bookings, error } = await query

    if (error) throw error

    return NextResponse.json({ bookings: bookings || [] })
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 1. Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. Parse request body
  let payload: CreateBookingPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 4. Validate required fields
  if (!payload.startsAt || !payload.endsAt || !payload.bookingType) {
    return NextResponse.json(
      { error: 'Missing required fields: startsAt, endsAt, bookingType' },
      { status: 400 }
    )
  }

  // 5. Determine client and coach IDs
  let clientId: string
  let coachId: string

  if (profile?.role === 'coach') {
    if (!payload.clientId) {
      return NextResponse.json(
        { error: 'Coach must specify clientId' },
        { status: 400 }
      )
    }
    clientId = payload.clientId
    coachId = user.id
  } else {
    // Client booking for themselves
    clientId = user.id
    // Get the coach ID from their package or existing relationship
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
    coachId = existingPackage.coach_id
  }

  // 6. For sessions, validate package
  let packageId: string | null = null
  if (payload.bookingType === 'session') {
    if (payload.packageId) {
      packageId = payload.packageId
    } else {
      // Find active package for client
      const { data: activePackage } = await supabase
        .from('session_packages')
        .select('id, remaining_sessions')
        .eq('client_id', clientId)
        .eq('coach_id', coachId)
        .gt('remaining_sessions', 0)
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      if (!activePackage) {
        return NextResponse.json(
          { error: 'No active session package found' },
          { status: 400 }
        )
      }
      packageId = activePackage.id
    }
  }

  // 7. For check-ins, verify monthly usage
  if (payload.bookingType === 'checkin') {
    const startOfMonth = new Date(payload.startsAt)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const monthStr = startOfMonth.toISOString().split('T')[0]

    const { data: usage } = await supabase
      .from('client_checkin_usage')
      .select('used')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .eq('month', monthStr)
      .single()

    if (usage?.used) {
      return NextResponse.json(
        { error: 'Monthly check-in already used' },
        { status: 400 }
      )
    }
  }

  // 8. Check minimum notice (12 hours for clients)
  if (profile?.role === 'client') {
    const { data: settings } = await supabase
      .from('coach_booking_settings')
      .select('min_notice_hours')
      .eq('coach_id', coachId)
      .single()

    const minNotice = settings?.min_notice_hours || 12
    const bookingTime = new Date(payload.startsAt)
    const minAllowedTime = new Date()
    minAllowedTime.setHours(minAllowedTime.getHours() + minNotice)

    if (bookingTime < minAllowedTime) {
      return NextResponse.json(
        { error: `Bookings require ${minNotice} hours notice` },
        { status: 400 }
      )
    }
  }

  // 9. Create the booking
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        client_id: clientId,
        coach_id: coachId,
        package_id: packageId,
        booking_type: payload.bookingType,
        starts_at: payload.startsAt,
        ends_at: payload.endsAt,
        status: 'confirmed',
      })
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url)
      `)
      .single()

    if (error) throw error

    // 10. Deduct session from package if session type
    if (payload.bookingType === 'session' && packageId) {
      await supabase.rpc('decrement_session', { package_id: packageId })
    }

    // 11. Mark check-in usage if check-in type
    if (payload.bookingType === 'checkin') {
      const startOfMonth = new Date(payload.startsAt)
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const monthStr = startOfMonth.toISOString().split('T')[0]

      await supabase
        .from('client_checkin_usage')
        .upsert({
          client_id: clientId,
          coach_id: coachId,
          month: monthStr,
          used: true,
          booking_id: booking.id,
        })
    }

    // TODO: Create Google Calendar event
    // TODO: Send notifications

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create booking' },
      { status: 500 }
    )
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/bookings/route.ts
git commit -m "feat: add bookings API (GET, POST)"
```

---

### Task 3.4: Bookings API - Reschedule & Cancel

**Files:**
- Create: `src/app/api/bookings/[id]/route.ts`

**Step 1: Write the implementation**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BookingStatus } from '@/types/booking'

// GET single booking
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
    const { data: booking, error } = await supabase
      .from('bookings')
      .select(`
        *,
        client:profiles!client_id(id, name, email, avatar_url),
        package:session_packages(id, total_sessions, remaining_sessions, session_duration_minutes),
        formResponse:checkin_form_responses(id, responses, submitted_at)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    // Verify access
    if (booking.coach_id !== user.id && booking.client_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ booking })
  } catch (error) {
    console.error('Error fetching booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch booking' },
      { status: 500 }
    )
  }
}

// PATCH - Update status (cancel, complete, no-show) or reschedule
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  let payload: {
    status?: BookingStatus
    startsAt?: string
    endsAt?: string
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Get current booking
  const { data: currentBooking, error: fetchError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !currentBooking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Verify access
  if (currentBooking.coach_id !== user.id && currentBooking.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Handle status change
    if (payload.status) {
      const updates: Record<string, unknown> = { status: payload.status }

      if (payload.status === 'cancelled') {
        updates.cancelled_at = new Date().toISOString()

        // Refund session if session type and was confirmed
        if (
          currentBooking.booking_type === 'session' &&
          currentBooking.package_id &&
          currentBooking.status === 'confirmed'
        ) {
          await supabase.rpc('increment_session', {
            package_id: currentBooking.package_id,
          })
        }

        // Reset check-in usage if check-in type
        if (currentBooking.booking_type === 'checkin') {
          const startOfMonth = new Date(currentBooking.starts_at)
          startOfMonth.setDate(1)
          const monthStr = startOfMonth.toISOString().split('T')[0]

          await supabase
            .from('client_checkin_usage')
            .update({ used: false, booking_id: null })
            .eq('client_id', currentBooking.client_id)
            .eq('coach_id', currentBooking.coach_id)
            .eq('month', monthStr)
        }

        // Update attendance stats
        await updateAttendanceStats(
          supabase,
          currentBooking.client_id,
          currentBooking.coach_id,
          'cancellation'
        )
      }

      if (payload.status === 'no_show') {
        await updateAttendanceStats(
          supabase,
          currentBooking.client_id,
          currentBooking.coach_id,
          'no_show'
        )
      }

      const { data: updatedBooking, error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          client:profiles!client_id(id, name, email, avatar_url)
        `)
        .single()

      if (error) throw error

      // TODO: Update/delete Google Calendar event
      // TODO: Send notifications

      return NextResponse.json({ booking: updatedBooking })
    }

    // Handle reschedule
    if (payload.startsAt && payload.endsAt) {
      // Create new booking linked to original
      const { data: newBooking, error: createError } = await supabase
        .from('bookings')
        .insert({
          client_id: currentBooking.client_id,
          coach_id: currentBooking.coach_id,
          package_id: currentBooking.package_id,
          booking_type: currentBooking.booking_type,
          starts_at: payload.startsAt,
          ends_at: payload.endsAt,
          status: 'confirmed',
          rescheduled_from_id: id,
        })
        .select(`
          *,
          client:profiles!client_id(id, name, email, avatar_url)
        `)
        .single()

      if (createError) throw createError

      // Cancel old booking (but don't refund since it's a reschedule)
      await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id)

      // TODO: Update Google Calendar event
      // TODO: Send reschedule notification

      return NextResponse.json({ booking: newBooking })
    }

    return NextResponse.json({ error: 'No valid update provided' }, { status: 400 })
  } catch (error) {
    console.error('Error updating booking:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update booking' },
      { status: 500 }
    )
  }
}

// Helper to update attendance stats
async function updateAttendanceStats(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  coachId: string,
  type: 'cancellation' | 'no_show'
) {
  // Get or create stats record
  const { data: stats } = await supabase
    .from('client_booking_stats')
    .select('*')
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .single()

  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

  // Count incidents in last 90 days
  const { count: noShowCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .eq('status', 'no_show')
    .gte('updated_at', ninetyDaysAgo.toISOString())

  const { count: cancelCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .eq('coach_id', coachId)
    .eq('status', 'cancelled')
    .gte('cancelled_at', ninetyDaysAgo.toISOString())

  const isFlagged = (noShowCount || 0) >= 3 || (cancelCount || 0) >= 3

  await supabase
    .from('client_booking_stats')
    .upsert({
      client_id: clientId,
      coach_id: coachId,
      no_show_count_90d: noShowCount || 0,
      cancellation_count_90d: cancelCount || 0,
      is_flagged: isFlagged,
      ...(stats ? {} : { current_streak_weeks: 0, longest_streak_weeks: 0 }),
    })
}
```

**Step 2: Commit**

```bash
git add src/app/api/bookings/[id]/route.ts
git commit -m "feat: add booking update API (reschedule, cancel, complete, no-show)"
```

---

### Task 3.5: Database Functions for Session Management

**Files:**
- Create: `supabase/migrations/066_session_functions.sql`

**Step 1: Write the migration**

```sql
-- Functions to manage session counts atomically
-- Migration: 066_session_functions.sql

-- Decrement session count
CREATE OR REPLACE FUNCTION decrement_session(package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE session_packages
  SET remaining_sessions = remaining_sessions - 1
  WHERE id = package_id AND remaining_sessions > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment session count (for refunds)
CREATE OR REPLACE FUNCTION increment_session(package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE session_packages
  SET remaining_sessions = remaining_sessions + 1
  WHERE id = package_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION decrement_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_session(UUID) TO authenticated;
```

**Step 2: Apply migration**

Run: `npx supabase db push`

**Step 3: Commit**

```bash
git add supabase/migrations/066_session_functions.sql
git commit -m "feat(db): add session increment/decrement functions"
```

---

### Task 3.6: Availability API

**Files:**
- Create: `src/app/api/availability/route.ts`
- Create: `src/app/api/availability/slots/route.ts`

**Step 1: Write availability templates API**

Create `src/app/api/availability/route.ts`:

```typescript
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

    return NextResponse.json({
      templates: templates || [],
      overrides: overrides || [],
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
```

**Step 2: Write available slots API**

Create `src/app/api/availability/slots/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AvailableSlot, AvailabilityType } from '@/types/booking'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const coachId = searchParams.get('coachId')
  const date = searchParams.get('date') // YYYY-MM-DD
  const type = (searchParams.get('type') || 'session') as AvailabilityType
  const durationMinutes = parseInt(searchParams.get('duration') || '60')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!coachId || !date) {
    return NextResponse.json(
      { error: 'coachId and date are required' },
      { status: 400 }
    )
  }

  try {
    const targetDate = new Date(date)
    const dayOfWeek = targetDate.getDay()

    // 1. Get templates for this day
    const { data: templates } = await supabase
      .from('coach_availability_templates')
      .select('*')
      .eq('coach_id', coachId)
      .eq('availability_type', type)
      .eq('day_of_week', dayOfWeek)

    // 2. Get overrides for this date
    const { data: overrides } = await supabase
      .from('coach_availability_overrides')
      .select('*')
      .eq('coach_id', coachId)
      .eq('availability_type', type)
      .eq('override_date', date)

    // 3. Get existing bookings for this date
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('coach_id', coachId)
      .eq('status', 'confirmed')
      .gte('starts_at', dayStart.toISOString())
      .lte('starts_at', dayEnd.toISOString())

    // 4. Get client's favorite times (if client)
    const { data: clientStats } = await supabase
      .from('client_booking_stats')
      .select('favorite_times')
      .eq('client_id', user.id)
      .eq('coach_id', coachId)
      .single()

    const favoriteTimes = clientStats?.favorite_times || []

    // 5. Calculate available slots
    const slots: AvailableSlot[] = []

    // Check for full-day block
    const fullDayBlock = overrides?.find(
      (o) => o.is_blocked && o.start_time === null
    )
    if (fullDayBlock) {
      return NextResponse.json({ slots: [] })
    }

    // Process each template
    for (const template of templates || []) {
      const [startHour, startMin] = template.start_time.split(':').map(Number)
      const [endHour, endMin] = template.end_time.split(':').map(Number)

      // Generate 30-min interval slots
      let slotStart = new Date(date)
      slotStart.setHours(startHour, startMin, 0, 0)

      const templateEnd = new Date(date)
      templateEnd.setHours(endHour, endMin, 0, 0)

      while (slotStart < templateEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)

        // Check if slot end exceeds template end
        if (slotEnd > templateEnd) break

        // Check if slot is blocked by override
        const isBlocked = overrides?.some((o) => {
          if (!o.is_blocked || !o.start_time) return false
          const [oStartH, oStartM] = o.start_time.split(':').map(Number)
          const [oEndH, oEndM] = o.end_time!.split(':').map(Number)
          const overrideStart = new Date(date)
          overrideStart.setHours(oStartH, oStartM, 0, 0)
          const overrideEnd = new Date(date)
          overrideEnd.setHours(oEndH, oEndM, 0, 0)

          return slotStart < overrideEnd && slotEnd > overrideStart
        })

        if (!isBlocked) {
          // Count overlapping bookings
          const overlappingCount = (existingBookings || []).filter((b) => {
            const bStart = new Date(b.starts_at)
            const bEnd = new Date(b.ends_at)
            return slotStart < bEnd && slotEnd > bStart
          }).length

          const maxCapacity = template.max_concurrent_clients
          const availableCapacity = maxCapacity - overlappingCount

          if (availableCapacity > 0) {
            // Check if this is a favorite time
            const slotTime = `${String(slotStart.getHours()).padStart(2, '0')}:${String(slotStart.getMinutes()).padStart(2, '0')}`
            const isFavorite = favoriteTimes.some(
              (ft: { day: number; time: string }) =>
                ft.day === dayOfWeek && ft.time === slotTime
            )

            slots.push({
              startsAt: slotStart.toISOString(),
              endsAt: slotEnd.toISOString(),
              availableCapacity,
              isFavorite,
            })
          }
        }

        // Move to next 30-min slot
        slotStart = new Date(slotStart.getTime() + 30 * 60000)
      }
    }

    // Add extra availability from non-blocked overrides
    for (const override of overrides || []) {
      if (override.is_blocked || !override.start_time) continue

      const [startHour, startMin] = override.start_time.split(':').map(Number)
      const [endHour, endMin] = override.end_time!.split(':').map(Number)

      let slotStart = new Date(date)
      slotStart.setHours(startHour, startMin, 0, 0)

      const overrideEnd = new Date(date)
      overrideEnd.setHours(endHour, endMin, 0, 0)

      while (slotStart < overrideEnd) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000)
        if (slotEnd > overrideEnd) break

        const overlappingCount = (existingBookings || []).filter((b) => {
          const bStart = new Date(b.starts_at)
          const bEnd = new Date(b.ends_at)
          return slotStart < bEnd && slotEnd > bStart
        }).length

        const maxCapacity = override.max_concurrent_clients || 2
        const availableCapacity = maxCapacity - overlappingCount

        if (availableCapacity > 0) {
          // Check if already in slots (from template)
          const exists = slots.some(
            (s) => s.startsAt === slotStart.toISOString()
          )
          if (!exists) {
            slots.push({
              startsAt: slotStart.toISOString(),
              endsAt: slotEnd.toISOString(),
              availableCapacity,
            })
          }
        }

        slotStart = new Date(slotStart.getTime() + 30 * 60000)
      }
    }

    // Sort by time
    slots.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

    return NextResponse.json({ slots })
  } catch (error) {
    console.error('Error calculating slots:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate slots' },
      { status: 500 }
    )
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/availability/
git commit -m "feat: add availability templates and slots API"
```

---

## Phase 4: React Hooks

### Task 4.1: useSessionPackages Hook

**Files:**
- Create: `src/hooks/useSessionPackages.ts`

**Step 1: Write the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  SessionPackage,
  CreateSessionPackagePayload,
  AdjustSessionPackagePayload,
} from '@/types/booking'

interface UseSessionPackagesReturn {
  packages: SessionPackage[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createPackage: (payload: CreateSessionPackagePayload) => Promise<SessionPackage | null>
  adjustPackage: (payload: AdjustSessionPackagePayload) => Promise<SessionPackage | null>
}

export function useSessionPackages(clientId?: string): UseSessionPackagesReturn {
  const [packages, setPackages] = useState<SessionPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true)
      const url = clientId
        ? `/api/session-packages?clientId=${clientId}`
        : '/api/session-packages'
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch packages')
      }

      const data = await res.json()
      setPackages(data.packages || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching packages:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchPackages()
  }, [fetchPackages])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('session_packages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_packages',
        },
        () => {
          fetchPackages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchPackages, supabase])

  const createPackage = async (
    payload: CreateSessionPackagePayload
  ): Promise<SessionPackage | null> => {
    try {
      const res = await fetch('/api/session-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create package')
      }

      await fetchPackages()
      return data.package
    } catch (err) {
      console.error('Error creating package:', err)
      alert(err instanceof Error ? err.message : 'Failed to create package')
      return null
    }
  }

  const adjustPackage = async (
    payload: AdjustSessionPackagePayload
  ): Promise<SessionPackage | null> => {
    try {
      const res = await fetch(`/api/session-packages/${payload.packageId}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adjustment: payload.adjustment,
          reason: payload.reason,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to adjust package')
      }

      await fetchPackages()
      return data.package
    } catch (err) {
      console.error('Error adjusting package:', err)
      alert(err instanceof Error ? err.message : 'Failed to adjust package')
      return null
    }
  }

  return {
    packages,
    loading,
    error,
    refetch: fetchPackages,
    createPackage,
    adjustPackage,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useSessionPackages.ts
git commit -m "feat: add useSessionPackages hook"
```

---

### Task 4.2: useBookings Hook

**Files:**
- Create: `src/hooks/useBookings.ts`

**Step 1: Write the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Booking,
  BookingWithDetails,
  CreateBookingPayload,
  RescheduleBookingPayload,
  BookingStatus,
} from '@/types/booking'

interface UseBookingsOptions {
  clientId?: string
  status?: BookingStatus
  from?: string
  to?: string
}

interface UseBookingsReturn {
  bookings: BookingWithDetails[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createBooking: (payload: CreateBookingPayload) => Promise<Booking | null>
  createMultipleBookings: (payloads: CreateBookingPayload[]) => Promise<Booking[]>
  rescheduleBooking: (payload: RescheduleBookingPayload) => Promise<Booking | null>
  cancelBooking: (bookingId: string) => Promise<boolean>
  updateStatus: (bookingId: string, status: BookingStatus) => Promise<boolean>
}

export function useBookings(options: UseBookingsOptions = {}): UseBookingsReturn {
  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (options.clientId) params.set('clientId', options.clientId)
      if (options.status) params.set('status', options.status)
      if (options.from) params.set('from', options.from)
      if (options.to) params.set('to', options.to)

      const url = `/api/bookings${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch bookings')
      }

      const data = await res.json()
      setBookings(data.bookings || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [options.clientId, options.status, options.from, options.to])

  useEffect(() => {
    fetchBookings()
  }, [fetchBookings])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('bookings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
        },
        () => {
          fetchBookings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchBookings, supabase])

  const createBooking = async (
    payload: CreateBookingPayload
  ): Promise<Booking | null> => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create booking')
      }

      await fetchBookings()
      return data.booking
    } catch (err) {
      console.error('Error creating booking:', err)
      alert(err instanceof Error ? err.message : 'Failed to create booking')
      return null
    }
  }

  const createMultipleBookings = async (
    payloads: CreateBookingPayload[]
  ): Promise<Booking[]> => {
    const results: Booking[] = []
    for (const payload of payloads) {
      const booking = await createBooking(payload)
      if (booking) results.push(booking)
    }
    return results
  }

  const rescheduleBooking = async (
    payload: RescheduleBookingPayload
  ): Promise<Booking | null> => {
    try {
      const res = await fetch(`/api/bookings/${payload.bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startsAt: payload.newStartsAt,
          endsAt: payload.newEndsAt,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule booking')
      }

      await fetchBookings()
      return data.booking
    } catch (err) {
      console.error('Error rescheduling booking:', err)
      alert(err instanceof Error ? err.message : 'Failed to reschedule booking')
      return null
    }
  }

  const cancelBooking = async (bookingId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel booking')
      }

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error cancelling booking:', err)
      alert(err instanceof Error ? err.message : 'Failed to cancel booking')
      return false
    }
  }

  const updateStatus = async (
    bookingId: string,
    status: BookingStatus
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update status')
      }

      await fetchBookings()
      return true
    } catch (err) {
      console.error('Error updating status:', err)
      alert(err instanceof Error ? err.message : 'Failed to update status')
      return false
    }
  }

  return {
    bookings,
    loading,
    error,
    refetch: fetchBookings,
    createBooking,
    createMultipleBookings,
    rescheduleBooking,
    cancelBooking,
    updateStatus,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useBookings.ts
git commit -m "feat: add useBookings hook"
```

---

### Task 4.3: useAvailability Hook

**Files:**
- Create: `src/hooks/useAvailability.ts`

**Step 1: Write the hook**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  AvailabilityTemplate,
  AvailabilityOverride,
  AvailableSlot,
  AvailabilityType,
  CreateAvailabilityTemplatePayload,
  CreateAvailabilityOverridePayload,
} from '@/types/booking'

interface UseAvailabilityOptions {
  coachId?: string
  type?: AvailabilityType
}

interface UseAvailabilityReturn {
  templates: AvailabilityTemplate[]
  overrides: AvailabilityOverride[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createTemplate: (payload: CreateAvailabilityTemplatePayload) => Promise<AvailabilityTemplate | null>
  createOverride: (payload: CreateAvailabilityOverridePayload) => Promise<AvailabilityOverride | null>
  deleteTemplate: (templateId: string) => Promise<boolean>
  deleteOverride: (overrideId: string) => Promise<boolean>
  getAvailableSlots: (date: string, durationMinutes?: number) => Promise<AvailableSlot[]>
}

export function useAvailability(
  options: UseAvailabilityOptions = {}
): UseAvailabilityReturn {
  const [templates, setTemplates] = useState<AvailabilityTemplate[]>([])
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (options.coachId) params.set('coachId', options.coachId)
      if (options.type) params.set('type', options.type)

      const url = `/api/availability${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch availability')
      }

      const data = await res.json()
      setTemplates(data.templates || [])
      setOverrides(data.overrides || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching availability:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [options.coachId, options.type])

  useEffect(() => {
    fetchAvailability()
  }, [fetchAvailability])

  // Real-time subscriptions
  useEffect(() => {
    const templatesChannel = supabase
      .channel('availability_templates_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_availability_templates',
        },
        () => fetchAvailability()
      )
      .subscribe()

    const overridesChannel = supabase
      .channel('availability_overrides_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_availability_overrides',
        },
        () => fetchAvailability()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(templatesChannel)
      supabase.removeChannel(overridesChannel)
    }
  }, [fetchAvailability, supabase])

  const createTemplate = async (
    payload: CreateAvailabilityTemplatePayload
  ): Promise<AvailabilityTemplate | null> => {
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create template')
      }

      await fetchAvailability()
      return data.template
    } catch (err) {
      console.error('Error creating template:', err)
      alert(err instanceof Error ? err.message : 'Failed to create template')
      return null
    }
  }

  const createOverride = async (
    payload: CreateAvailabilityOverridePayload
  ): Promise<AvailabilityOverride | null> => {
    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          overrideDate: payload.overrideDate,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create override')
      }

      await fetchAvailability()
      return data.override
    } catch (err) {
      console.error('Error creating override:', err)
      alert(err instanceof Error ? err.message : 'Failed to create override')
      return null
    }
  }

  const deleteTemplate = async (templateId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('coach_availability_templates')
        .delete()
        .eq('id', templateId)

      if (error) throw error

      await fetchAvailability()
      return true
    } catch (err) {
      console.error('Error deleting template:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete template')
      return false
    }
  }

  const deleteOverride = async (overrideId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('coach_availability_overrides')
        .delete()
        .eq('id', overrideId)

      if (error) throw error

      await fetchAvailability()
      return true
    } catch (err) {
      console.error('Error deleting override:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete override')
      return false
    }
  }

  const getAvailableSlots = async (
    date: string,
    durationMinutes = 60
  ): Promise<AvailableSlot[]> => {
    try {
      const params = new URLSearchParams({
        coachId: options.coachId || '',
        date,
        type: options.type || 'session',
        duration: durationMinutes.toString(),
      })

      const res = await fetch(`/api/availability/slots?${params}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch slots')
      }

      const data = await res.json()
      return data.slots || []
    } catch (err) {
      console.error('Error fetching slots:', err)
      return []
    }
  }

  return {
    templates,
    overrides,
    loading,
    error,
    refetch: fetchAvailability,
    createTemplate,
    createOverride,
    deleteTemplate,
    deleteOverride,
    getAvailableSlots,
  }
}
```

**Step 2: Commit**

```bash
git add src/hooks/useAvailability.ts
git commit -m "feat: add useAvailability hook"
```

---

## Phase 5: Coach Dashboard Components

*Note: This phase contains the UI components. Due to length constraints, I'm providing the structure and key components. The full implementation would follow the same patterns.*

### Task 5.1: Coach Bookings Page

**Files:**
- Create: `src/app/coach/bookings/page.tsx`
- Create: `src/app/coach/bookings/CoachBookingsClient.tsx`

### Task 5.2: Booking Calendar Component

**Files:**
- Create: `src/components/booking/BookingCalendar.tsx`

### Task 5.3: Create Package Modal

**Files:**
- Create: `src/components/booking/CreatePackageModal.tsx`

### Task 5.4: Book Session Modal

**Files:**
- Create: `src/components/booking/BookSessionModal.tsx`

### Task 5.5: Availability Settings Page

**Files:**
- Create: `src/app/coach/settings/availability/page.tsx`

---

## Phase 6: Client Booking Components

### Task 6.1: Client Bookings Page

**Files:**
- Create: `src/app/client/bookings/page.tsx`
- Create: `src/app/client/bookings/ClientBookingsClient.tsx`

### Task 6.2: Slot Picker Component

**Files:**
- Create: `src/components/booking/SlotPicker.tsx`

### Task 6.3: Client Calendar Integration

**Files:**
- Modify: `src/app/client/calendar/page.tsx`

---

## Phase 7: Google Calendar Integration

### Task 7.1: Google OAuth Setup

**Files:**
- Create: `src/app/api/google/auth/route.ts`
- Create: `src/app/api/google/callback/route.ts`

### Task 7.2: Calendar Event Service

**Files:**
- Create: `src/lib/google-calendar.ts`

### Task 7.3: Integrate with Booking Creation

**Files:**
- Modify: `src/app/api/bookings/route.ts`

---

## Phase 8: Notifications & Scheduled Jobs

### Task 8.1: Booking Notifications Edge Function

**Files:**
- Create: `supabase/functions/send-booking-notifications/index.ts`

### Task 8.2: Reminder Cron Job

**Files:**
- Create: `supabase/functions/send-booking-reminders/index.ts`
- Create: `supabase/migrations/067_booking_cron_jobs.sql`

### Task 8.3: Streak Calculation Job

**Files:**
- Create: `supabase/functions/calculate-booking-streaks/index.ts`

### Task 8.4: Package Expiration Reminders

**Files:**
- Create: `supabase/functions/send-package-reminders/index.ts`

---

## Phase 9: Check-in Forms

### Task 9.1: Check-in Form Questions API

**Files:**
- Create: `src/app/api/checkin-forms/route.ts`
- Create: `src/app/api/checkin-forms/[id]/route.ts`

### Task 9.2: Check-in Form Responses API

**Files:**
- Create: `src/app/api/checkin-forms/responses/route.ts`

### Task 9.3: Form Builder Component

**Files:**
- Create: `src/components/booking/CheckinFormBuilder.tsx`

### Task 9.4: Form Submission Component

**Files:**
- Create: `src/components/booking/CheckinFormSubmission.tsx`

---

## Execution Summary

**Total Phases:** 9
**Total Tasks:** ~40 (detailed above for phases 1-4, structured for phases 5-9)

**Recommended Execution Order:**
1. Phase 1 (Database) - Foundation
2. Phase 2 (Types) - Type safety
3. Phase 3 (APIs) - Core functionality
4. Phase 4 (Hooks) - Data management
5. Phase 5 (Coach UI) - Coach experience
6. Phase 6 (Client UI) - Client experience
7. Phase 7 (Google) - Calendar integration
8. Phase 8 (Notifications) - Automated messaging
9. Phase 9 (Forms) - Check-in forms

Each task follows TDD where applicable, with frequent commits after each logical unit.
