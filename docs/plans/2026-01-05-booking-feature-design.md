# Booking Feature Design

## Overview

A booking system for in-person training sessions and virtual check-ins. Clients with session packages can book training sessions; all clients can book one free virtual check-in per month.

## Core Features

### Session Packages

- Assign packages with custom session counts, durations, and expiration dates
- Easy +/- adjustments with history logging
- Package templates for quick assignment (e.g., "8-session package, 60 min, 3 month expiry")
- Custom packages when needed
- Purchase history tracked per client

### Client Booking

- Multi-select slots (book multiple sessions at once)
- Up to 3 months ahead
- 12-hour minimum notice for client bookings
- Favorite times highlighted (learned from booking history)
- Quick rebook ("Book same time next week?")
- Booking streaks displayed ("🔥 6 weeks in a row!")

### Coach Booking

- Book/reschedule for clients with no time restrictions
- Bulk booking (select multiple slots at once)
- Drag-and-drop reschedule on calendar
- No minimum notice requirement

### Staggered Sessions

Capacity-based availability handles overlapping sessions:
- Set max concurrent clients (e.g., 2)
- System calculates availability at 30-min intervals
- Checks overlap: if 2 clients booked 4pm-5pm, 4:30pm slot unavailable, but 5pm opens when first client leaves
- Clients see available/unavailable only; coach sees capacity usage

### Availability Management

**Weekly Template:**
- Set hours for each day of week
- Set max concurrent clients
- Separate templates for sessions vs check-ins

**Overrides & Blackouts:**
- Block entire days
- Block specific time ranges
- Add extra availability outside normal hours
- Warning if blackout conflicts with existing bookings

### Google Calendar Sync (One-Way)

- App → Google Calendar only
- Booking creates event on coach's calendar
- Client added as attendee (receives invite)
- Reschedule updates the event
- Cancellation removes the event
- OAuth setup in coach settings

### Virtual Check-ins (Google Meet)

- Any client can book (not just package holders)
- 1 free check-in per calendar month (resets on 1st)
- Always 30 minutes
- Separate availability template from sessions
- Auto-generates Google Meet link
- Pre-booking form (see below)

### Check-in Form

- Coach defines questions in settings (add/edit/reorder)
- Client can complete at booking time
- If incomplete, reminder sent 24-48 hours before
- On submission:
  - Email sent to coach
  - Saved on client profile (history)
  - Visible in appointment details

### Rescheduling

- Direct reschedule in one step (pick new time, old slot freed)
- No time restriction for rescheduling
- Session credit not affected

### Cancellations

- Always refunds session credit (no penalty)
- Tracks cancellation count per client

### Attendance Tracking

- Mark sessions as: completed, cancelled, no-show
- Track patterns per client over time
- Auto-flag clients with 3+ no-shows or 3+ cancellations in rolling 3 months
- Flag displayed as badge on client profile

---

## Data Model

### session_packages

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| client_id | uuid | FK to profiles |
| coach_id | uuid | FK to profiles |
| total_sessions | integer | Sessions purchased |
| remaining_sessions | integer | Current balance |
| session_duration_minutes | integer | 30, 45, 60, etc. |
| expires_at | timestamp | Nullable |
| notes | text | Optional ("Birthday discount") |
| created_at | timestamp | |

### session_package_adjustments

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| package_id | uuid | FK to session_packages |
| adjustment | integer | +1, -1, etc. |
| reason | text | Optional note |
| created_at | timestamp | |

### bookings

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| client_id | uuid | FK to profiles |
| coach_id | uuid | FK to profiles |
| package_id | uuid | FK to session_packages (null for check-ins) |
| booking_type | enum | 'session' or 'checkin' |
| starts_at | timestamp | |
| ends_at | timestamp | |
| status | enum | confirmed, cancelled, completed, no_show |
| google_event_id | text | For calendar sync |
| google_meet_link | text | For check-ins |
| rescheduled_from_id | uuid | FK to bookings (if rescheduled) |
| created_at | timestamp | |
| cancelled_at | timestamp | Nullable |

### coach_availability_templates

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| coach_id | uuid | FK to profiles |
| availability_type | enum | 'session' or 'checkin' |
| day_of_week | integer | 0-6 (Sunday-Saturday) |
| start_time | time | e.g., "09:00" |
| end_time | time | e.g., "17:00" |
| max_concurrent_clients | integer | Capacity per slot |

### coach_availability_overrides

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| coach_id | uuid | FK to profiles |
| availability_type | enum | 'session' or 'checkin' |
| date | date | |
| start_time | time | Null = entire day |
| end_time | time | |
| is_blocked | boolean | True = blackout, false = extra availability |
| max_concurrent_clients | integer | Override capacity |

### checkin_form_questions

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| coach_id | uuid | FK to profiles |
| question | text | The question text |
| question_type | enum | 'text', 'textarea', 'select', etc. |
| options | jsonb | For select/multiple choice |
| sort_order | integer | Display order |
| is_required | boolean | |

### checkin_form_responses

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| booking_id | uuid | FK to bookings |
| client_id | uuid | FK to profiles |
| responses | jsonb | Question ID → answer mapping |
| submitted_at | timestamp | |

### client_booking_stats

| Column | Type | Description |
|--------|------|-------------|
| client_id | uuid | FK to profiles |
| coach_id | uuid | FK to profiles |
| current_streak_weeks | integer | Consecutive weeks with session |
| no_show_count_90d | integer | No-shows in last 90 days |
| cancellation_count_90d | integer | Cancellations in last 90 days |
| is_flagged | boolean | Auto-set when thresholds hit |
| favorite_times | jsonb | Array of {day, time} |

### client_checkin_usage

| Column | Type | Description |
|--------|------|-------------|
| client_id | uuid | FK to profiles |
| coach_id | uuid | FK to profiles |
| month | date | First of month (e.g., 2026-01-01) |
| used | boolean | Whether check-in used this month |
| booking_id | uuid | FK to bookings |

---

## Notifications

### Client Notifications

| Event | Email | Push |
|-------|-------|------|
| Session booking confirmed | ✓ (with cancel/reschedule link) | ✓ |
| Check-in booking confirmed | ✓ (with cancel/reschedule link) | ✓ |
| Session reminder (24hr before) | | ✓ |
| Check-in reminder (24hr before) | ✓ | ✓ |
| Check-in form reminder (if incomplete) | ✓ | ✓ |
| Session rescheduled | ✓ | ✓ |
| Session cancelled | ✓ | ✓ |
| Low sessions remaining | ✓ | |
| Package expiring (1 month before) | ✓ | |
| Package expiring (1 week before) | ✓ | ✓ |

### Coach Notifications

| Event | Email | Push | In-App |
|-------|-------|------|--------|
| New booking (session or check-in) | ✓ | ✓ | ✓ |
| Client cancelled | ✓ | ✓ | ✓ |
| Client rescheduled | ✓ | ✓ | ✓ |
| Check-in form submitted | ✓ | | ✓ |
| Client low on sessions | ✓ | | ✓ |
| Client package expiring (1 month) | ✓ | | ✓ |
| Client package expiring (1 week) | ✓ | ✓ | ✓ |
| Daily summary (tomorrow's sessions) | ✓ | | |

---

## User Interface

### Coach Dashboard (`/coach/bookings`)

**Calendar View (Primary)**
- Weekly/monthly toggle
- Sessions and check-ins shown (different colors)
- Click slot to view details or book
- Drag-and-drop to reschedule
- Visual indicators for availability/blackouts

**Quick Actions**
- "Book Session" - client selector → time picker (multi-select)
- "Block Time" - quick blackout
- "Manage Availability" - edit templates/overrides

**Today's Summary Sidebar**
- Today's sessions with client names, times
- Tomorrow's preview
- Clients needing renewal attention

### Client Profile Booking Section

- Package status card: "6 of 12 sessions remaining, expires March 15"
- Check-in status: "1 check-in available" or "Used - resets Feb 1"
- Upcoming sessions list
- Session history with dates
- Check-in form response history
- Attendance flag (if applicable)
- Quick actions: "Book sessions", "Add package", "Adjust sessions (+/-)"

### Client Booking Page (`/book` or `/client/bookings`)

**Package Status Header**
- Sessions remaining
- Expiration date (if applicable)
- Booking streak
- Check-in availability

**Calendar View**
- Next 3 months visible
- Grayed out: past, blackouts, full slots, within 12-hour window
- Highlighted: favorite times
- Multi-select enabled

**Booking Flow**
1. Toggle: "In-Person Session" or "Virtual Check-in"
2. Select slot(s)
3. For check-ins: complete form (or skip for later)
4. Confirm
5. Receive confirmation email + calendar invite

**Quick Rebook**
- Shown after completed sessions
- "Book same time next week?" - one tap

### Client Calendar (`/client/calendar`)

**Unified View**
- Workouts from program: blue
- Booked sessions: green
- Check-ins: purple
- Tap for details, cancel/reschedule buttons

### Coach Settings

**Availability (`/coach/settings/availability`)**
- Session availability template (per day of week)
- Check-in availability template (separate)
- Override calendar for blackouts/extras

**Booking Settings (`/coach/settings/booking`)**
- Booking window: 3 months (configurable)
- Minimum notice: 12 hours (configurable)
- Renewal reminder threshold
- Google Calendar connection

**Check-in Form (`/coach/settings/checkin-form`)**
- Add/edit/delete/reorder questions
- Question types: text, textarea, select, checkbox
- Mark required/optional

---

## Booking Types Comparison

| | In-Person Sessions | Virtual Check-ins |
|---|---|---|
| Who can book | Clients with active package | Any client |
| Uses credits | Yes | No (1 free/month) |
| Duration | Set per package | Always 30 min |
| Availability | Session template | Check-in template |
| Calendar invite | Google Calendar event | Google Meet link + event |
| Pre-booking form | No | Yes (coach-defined) |
| 24hr reminder | Push only | Push + email |

---

## Technical Implementation Notes

### Google Calendar Integration

- Use Google Calendar API with OAuth 2.0
- Store refresh token securely
- Create events with:
  - Summary: "Session with [Client Name]" or "Check-in with [Client Name]"
  - Start/end times
  - Client as attendee
  - For check-ins: auto-generate Google Meet link via conferenceData

### Slot Availability Calculation

```
function getAvailableSlots(date, bookingType):
  1. Get template for day of week + booking type
  2. Apply any overrides for this date
  3. Generate 30-min interval slots within available hours
  4. For each slot:
     - Count existing bookings that overlap with slot → slot + duration
     - If count < max_concurrent_clients: slot is available
  5. Return available slots
```

### Booking Streak Calculation

- Cron job runs weekly (Sunday night)
- For each client: check if they had a completed session in past 7 days
- If yes: increment streak
- If no: reset streak to 0

### Attendance Flag Calculation

- On each booking status change (cancelled, no_show):
  - Count incidents in last 90 days
  - If either count >= 3: set is_flagged = true
  - Else: set is_flagged = false

### Reminder Notifications

- Cron job runs hourly
- Find bookings starting in 23-24 hours
- Send appropriate reminders (push for sessions, push+email for check-ins)
- Find incomplete check-in forms for bookings in 24-48 hours
- Send form reminder

### Expiration/Renewal Reminders

- Daily cron job
- Find packages expiring in exactly 30 days → send 1-month warning
- Find packages expiring in exactly 7 days → send 1-week warning
- Find packages at renewal threshold → send low session warning

---

## Settings Defaults

| Setting | Default |
|---------|---------|
| Booking window | 3 months |
| Client minimum notice | 12 hours |
| Renewal reminder threshold | 2 sessions |
| Max concurrent clients | 2 |
| Check-in duration | 30 minutes |
| No-show/cancellation flag threshold | 3 in 90 days |
