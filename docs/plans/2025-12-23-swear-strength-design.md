# Swear Strength - App Design Document

## Overview

**Swear Strength** is a premium fitness coaching platform enabling coaches to build programs and clients to log workouts with a sleek, polished experience.

### Tech Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4, 100% custom components, CSS variables for theming
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deployment:** Vercel

### User Roles
- **Coach:** Single coach (admin), full access to program builder, client management, exercise library
- **Client:** Invite-only, views assigned programs, logs workouts, tracks habits

---

## Architecture

```
/src
  /app
    /(auth)        → Login, accept-invite pages
    /(client)      → Client dashboard, workouts, habits, progress
    /(coach)       → Program builder, client management, exercise library
    /api           → Server actions + API routes
  /components
    /ui            → Custom component library (buttons, cards, modals, etc.)
    /workout       → Workout-specific components
    /program       → Program builder components
  /lib
    /supabase      → Client, server, types
    /utils         → Helpers, formatters
  /hooks           → Custom React hooks
```

---

## Database Schema

### Users & Auth
- `profiles` - Extends Supabase auth: role (coach/client), name, avatar_url, last_login, invited_by, invite_accepted_at
- `invites` - email, token, expires_at, created_by, accepted_at

### Programs
- `programs` - name, type (strength/mobility/cardio), description, is_indefinite, is_archived, created_by
- `program_weeks` - program_id, week_number, name (optional)
- `workout_days` - week_id, day_number, name, subtitle, is_rest_day, rest_day_notes

### Exercises
- `exercises` - name, equipment, muscle_groups[], type, demo_url, cues, instructions, is_approved, submitted_by
- `workout_exercises` - day_id, section (warmup/strength/cooldown), label (A1, A2, B1), exercise_id, sets, reps, rest_seconds, rpe, notes, order, alternative_exercise_id

### Logging
- `workout_logs` - user_id, workout_day_id, started_at, completed_at
- `set_logs` - workout_log_id, workout_exercise_id, set_number, weight, weight_unit, reps_completed, is_bodyweight, notes
- `workout_completions` - workout_log_id, difficulty_rating, energy_level, feeling, notes, media_url

### Progress
- `personal_records` - user_id, exercise_id, record_type (max_weight/max_reps/estimated_1rm), value, achieved_at
- `habits` - user_id, date, water, sleep, protein, creatine

### Assignments
- `user_program_assignments` - user_id, program_id, start_date, is_active, current_week, current_day

---

## Authentication Flow

### Coach Login
1. Coach visits `/login`
2. Email/password auth via Supabase
3. 7-day session
4. Redirects to `/coach/dashboard`

### Client Invite Flow
1. Coach goes to `/coach/clients` → "Invite Client"
2. Enters client email → creates `invites` record with unique token
3. Email sent with link: `/invite/[token]`
4. Client clicks link → sets name and password
5. Creates auth user + profile (role: client)
6. Redirects to `/dashboard`

### Route Protection
```
/(auth)/*     → Public (login, invite)
/(client)/*   → Requires auth + client role
/(coach)/*    → Requires auth + coach role
```

---

## Client Workout Experience

### Hybrid UI Flow
1. **Workout Overview** (`/workouts/[dayId]`)
   - Header: workout name + week/day context
   - Scrollable list of exercises grouped by section
   - Checkmarks on completed exercises
   - Tap exercise → Focus Mode

2. **Focus Mode** (full-screen logging)
   - Circuit grouping: "Circuit A - Round 1 of 3" with progress segments
   - Workout/Video tabs
   - Exercise cards with:
     - Name + "Replace" for alternatives
     - Prescription (sets, reps, time)
     - Set logging: Set # | Previous | Weight | Reps | Checkbox
     - "Add notes" expandable
     - "View history" expandable
   - Pause / Finish in header

3. **Workout Completion**
   - Difficulty rating (1-10)
   - Energy level
   - Overall feeling (6-point scale)
   - Notes + media upload
   - PR detection runs on submit

---

## Program Builder (Coach)

### Spreadsheet Builder (Primary)
- Side-by-side weeks as columns
- Workouts as expandable rows within each week
- Inline cell editing with smart parsing:
  - `8-12` → rep range
  - `30s` → seconds
  - `70%` → percentage-based
  - `E/S` → each side
- Exercise autocomplete with library search
- Circuit/superset grouping (A1, A2, A3)
- Keyboard shortcuts:
  - `Cmd+G` → Create circuit
  - `Cmd+Shift+G` → Remove circuit
  - `Cmd+C/P` → Copy/paste
  - `Cmd+Z` → Undo
  - `Tab` → Next cell
  - `Enter` → Confirm
  - Duplicate workout across/down

### Text Import
- Paste formatted template
- Parser validates and shows preview
- Auto-matches exercises to library (creates new if not found)
- Imports into spreadsheet builder for tweaks

### Text Format
```
PROGRAM: Program Name
TYPE: strength
INDEFINITE: yes
DESCRIPTION: Brief description

[WEEK 1]

[DAY 1] Day Name
[WARMUP]
A1. Exercise | 1x10 | Note: Optional

[STRENGTH]
A1. Exercise | 3x10 | Rest: 60s | RPE: 6
A2. Exercise | 3x12 | Rest: 60s

[COOLDOWN]
A1. Stretch | 1x30s per side
```

---

## Premium UI Polish

### Micro-interactions & Animations
- Set completion: Scale + checkmark draw animation
- Circuit progress: Smooth fill animation
- PR achieved: Confetti burst + badge animation
- Weight input: Number ticker when loading previous
- Swipe gestures: Spring physics
- Button presses: Scale-down + shadow lift

### Visual Hierarchy & Depth
- Subtle card shadows (layered, not flat)
- Glass-morphism on overlays (blur + transparency)
- Gradient accents (purple→indigo) on primary actions
- Dark mode: Rich blacks (#0a0a0a) + purple glow accents
- Light mode: Clean whites + subtle warm grays
- Focus states: Soft purple glow ring

### Data-Forward Polish
- "Previous" column shows last logged weight
- PR indicator: Flame icon if PR opportunity
- Post-log feedback: "↑ 5 lbs from last week"
- Streak badges on consistent exercises
- Progress rings throughout (workout %, week %, program %)
- Mini-charts in "View history" expansion

### Typography
- Geist Sans (already configured)
- Bold hierarchy: Exercise names prominent, metadata secondary
- Generous spacing and line-height

---

## Theme System

- Dark mode default
- Light mode available
- Toggle in Settings → Appearance
- CSS variables for all colors
- Tailwind dark mode class strategy
- No flash on page load (SSR-aware)

---

## Build Phases

### Phase 1 - Foundation
1. Supabase setup (database, auth, storage)
2. Database schema (all core tables)
3. Authentication (coach login, client invite flow)
4. Route protection & role-based middleware
5. Custom UI component library
6. Theme system (dark/light)

### Phase 2 - Core Coach Tools
7. Exercise library (CRUD, search, filters)
8. Spreadsheet program builder
9. Text import parser
10. Client management (list, invite, view)
11. Program assignment

### Phase 3 - Core Client Experience
12. Client dashboard
13. Workout overview (hybrid list)
14. Focus mode logging (premium UI)
15. Workout completion flow

### Phase 4 - Progress & Analytics
16. PR detection & display
17. Volume tracking
18. Workout history
19. Consistency tracking

### Phase 5 - Lifestyle
20. Habit tracker (enhanced)
21. Streak tracking
22. Daily progress summary

### Phase 6 - Settings & Polish
23. Settings page (appearance, units, profile)
24. Announcements system
25. PDF export

---

## Key Decisions

- **Database:** Supabase (PostgreSQL) - real-time, auth, storage included
- **Auth:** Invite-only for clients, 7-day sessions
- **Roles:** Single coach, multiple clients (no multi-coach support initially)
- **Messaging:** Deferred - use WhatsApp/email externally for now
- **Theme:** Both dark and light, dark default, toggle in settings
- **Components:** 100% custom (no component library)
- **Program Builder:** Spreadsheet-style primary, text import secondary
- **Workout Logging:** Hybrid (overview list + full-screen focus mode)
