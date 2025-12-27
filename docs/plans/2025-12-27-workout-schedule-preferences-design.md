# Workout Schedule Preferences Design

## Overview

Allow clients to configure how they want to be held accountable for their workout program. Two modes: scheduled days (strict) or flexible (with configurable reminder thresholds).

## Schedule Modes

### 1. Scheduled Days
- Client picks specific days (Mon/Wed/Fri, etc.)
- Gets notified if they miss a scheduled day
- Backup: coach notified after 7+ days inactivity

### 2. Flexible
- No specific days - workout whenever
- Client picks reminder threshold:
  - 2 days (aggressive)
  - 3 days (moderate) - default
  - 4 days (relaxed)
  - 1 week (very flexible)
  - No reminders (self-paced)

## Notification Behavior

### Client Notifications (automated email + in-app)

| Mode | Trigger | When |
|------|---------|------|
| Scheduled | Missed scheduled day | Next morning |
| Flexible | Hit chosen threshold | When threshold reached |
| All modes | 7 days inactive | Automated nudge |

- Client only gets ONE notification per "miss" (not daily nagging)
- Counter resets when client completes a workout

### Coach Notifications

| Trigger | Where | Format |
|---------|-------|--------|
| Any client 4+ days inactive | Dashboard + daily digest email | Grouped list |
| Missed scheduled day | Dashboard | Individual alert |

- Coach digest email sent to: notifications@swearnutrition.com
- Dashboard shows in "Needs Attention" section (already built)
- Coach can dismiss notifications

## Database Changes

Add to `user_program_assignments`:

```sql
-- Schedule mode
schedule_mode TEXT DEFAULT 'flexible'
  CHECK (schedule_mode IN ('scheduled', 'flexible'))

-- Reminder threshold (days) for flexible mode
-- NULL means "no reminders" (self-paced)
reminder_threshold INTEGER DEFAULT 3

-- Prevent duplicate notifications
last_reminder_sent_at TIMESTAMPTZ DEFAULT NULL

-- Denormalized for fast queries
last_workout_at TIMESTAMPTZ DEFAULT NULL
```

Already exists:
- `scheduled_days INTEGER[]` - for day picker
- `schedule_set_at TIMESTAMPTZ` - when configured

## UI Flow

### Step 1: Mode Selection

Client sees two options after receiving program assignment:
- "Scheduled Days" - I know which days I'll work out
- "Flexible" - I'll work out when I can

### Step 2a: Scheduled Days
Shows existing day picker (already built)

### Step 2b: Flexible
Shows reminder threshold picker:
- After 2 days
- After 3 days (recommended)
- After 4 days
- After 1 week
- No reminders (self-paced)

## Edge Function Logic

Daily cron job `check-workout-activity`:

1. Get all active assignments with `last_workout_at`
2. Calculate `days_inactive` for each
3. **Client notifications:**
   - Scheduled mode + missed yesterday → notify client
   - Flexible mode + days_inactive >= reminder_threshold → notify client
   - Any mode + days_inactive >= 7 → notify client (if no recent notification)
4. **Coach alerts:**
   - Any client with days_inactive >= 4 → add to digest list
5. Send coach digest email if list not empty
6. Update `last_reminder_sent_at` to prevent duplicates

## Trigger: Update last_workout_at

On `workout_logs` insert where `completed_at IS NOT NULL`:
- Find user's active assignment
- Update `last_workout_at = NOW()`

## Files to Modify/Create

1. `supabase/migrations/031_schedule_preferences.sql` - new columns
2. `src/components/WorkoutScheduleModal.tsx` - update with mode selection
3. `supabase/functions/check-workout-activity/index.ts` - new edge function (replaces check-missed-workouts)
4. Email template for coach digest
5. Email template for client reminder
