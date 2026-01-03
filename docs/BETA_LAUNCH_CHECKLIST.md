# Swear Strength Beta Launch Checklist

**Target:** Closed beta with real clients, rock-solid stability
**Estimated Timeline:** 3-4 weeks at 2-4 hours/day
**Created:** January 2, 2025

---

## Phase 1: Critical Messaging Fixes (3-5 days) ✅ COMPLETED

### 1.1 Group Chat Realtime Support ✅
- [x] Add `group_messages` to Supabase realtime publication
- [x] Add `group_message_reads` to Supabase realtime publication
- [x] Add `group_chats` to Supabase realtime publication
- [x] Add `group_chat_members` to Supabase realtime publication
- [ ] Test: Send group message → verify it appears instantly for all members

**File:** `supabase/migrations/046_add_group_tables_to_realtime.sql` ✅

### 1.2 Group Message Deletion ✅
- [x] Create DELETE endpoint at `/api/group-chats/[id]/messages/[messageId]/route.ts`
- [x] Implement soft delete (set `is_deleted = true`)
- [x] Update `useGroupMessages` hook to call the endpoint (already existed)
- [ ] Test: Delete message → verify it disappears for all users

### 1.3 Group Message Read Tracking ✅
- [x] Create POST endpoint at `/api/group-chats/[id]/messages/read/route.ts`
- [x] Insert records into `group_message_reads` table
- [x] Add `markAsRead()` function to `useGroupMessages` hook
- [ ] Call `markAsRead()` when user views messages (UI integration pending)
- [ ] Test: Open group chat → verify read status updates

### 1.4 Messaging Error Handling ✅
- [x] In `useMessages.ts`: Return error state from `markAsRead()`
- [x] In `useMessages.ts`: Return error details from `sendMessage()` failures
- [x] In `useGroupMessages.ts`: Add proper error state for all operations
- [x] In `useUnreadCounts.ts`: Fix `.single()` crash when conversation doesn't exist
- [x] Add error display UI in ClientMessagesClient and CoachMessagesClient

---

## Phase 2: Core Workout Stability (4-6 days)

### 2.1 Auto-Save User Feedback
- [ ] Add `saveStatus` state to `WorkoutDayClient.tsx` ('saving' | 'saved' | 'error')
- [ ] Show saving indicator in UI (spinner or "Saving...")
- [ ] Show error toast/banner when auto-save fails
- [ ] Add retry button for failed saves
- [ ] Test: Disconnect network → make change → verify error shown

**File:** `src/app/(client)/workouts/[dayId]/WorkoutDayClient.tsx`

### 2.2 Input Validation
- [ ] Validate weight field: must be positive number or empty
- [ ] Validate reps field: must be positive integer or empty
- [ ] Validate sets field in program builder: must be positive integer
- [ ] Show inline validation errors (red border + message)
- [ ] Prevent save of invalid data
- [ ] Test: Enter "abc" in weight field → verify rejection with message

### 2.3 PR Detection Race Condition Fix
- [ ] Update `prMap` after successful PR save (currently stale)
- [ ] Add timestamp validation: PR must be newer than existing
- [ ] Add unit consistency check (lbs vs kg)
- [ ] Consider: Lock mechanism or queue for concurrent PR checks
- [ ] Test: Rapidly enter PRs in multiple sets → verify no duplicates

**File:** `src/app/(client)/workouts/[dayId]/WorkoutDayClient.tsx` (~lines 385-510)

### 2.4 Program Assignment Atomicity
- [ ] Wrap deactivate + create in a transaction (or use single RPC call)
- [ ] Validate program has weeks/days before assignment
- [ ] Validate client doesn't already have this program active
- [ ] Rollback if any step fails
- [ ] Test: Simulate failure mid-assignment → verify no orphaned state

**Files:**
- `src/app/coach/clients/[id]/ClientDetailClient.tsx`
- Consider: New RPC function `assign_program_to_client()`

---

## Phase 3: Error Handling & Validation (3-4 days)

### 3.1 API Route Validation
- [ ] Add null checks after all `.single()` calls
- [ ] Validate request body schema on POST/PUT routes
- [ ] Return proper HTTP status codes (400 for validation, 404 for not found)
- [ ] Add coach-client relationship validation before operations

**Priority routes:**
- [ ] `/api/coach/clients/[id]/program/route.ts`
- [ ] `/api/coach/clients/[id]/reset/route.ts`
- [ ] `/api/group-chats/route.ts`
- [ ] `/api/messages/conversations/route.ts`

### 3.2 User-Facing Error Messages
- [ ] Replace `console.error` with user-visible errors in:
  - [ ] `WorkoutDayClient.tsx` (4+ locations)
  - [ ] `ProgramBuilderClient.tsx` (auto-save, block operations)
  - [ ] `ClientDetailClient.tsx` (reset, assignment)
  - [ ] `useGroupChats.ts`
- [ ] Create reusable error toast/notification component
- [ ] Add error boundary for unexpected crashes

### 3.3 Conversation Race Condition
- [ ] Use upsert or transaction for conversation creation
- [ ] Prevent duplicate conversations between same users
- [ ] Test: Rapidly create conversations → verify no duplicates

**File:** `src/app/api/messages/conversations/route.ts`

### 3.4 Push Notification Reliability
- [ ] Add retry logic for failed push sends (max 3 attempts)
- [ ] Log push failures to database for debugging
- [ ] Surface "notification may not have been delivered" warning if push fails
- [ ] Test: Invalid subscription → verify graceful handling

---

## Phase 4: Data Integrity (2-3 days)

### 4.1 Soft Delete Consistency
- [ ] Ensure exercises use soft delete (prevent cascade to workouts)
- [ ] Ensure programs can't be deleted if actively assigned
- [ ] Add `deleted_at` column where missing
- [ ] Test: Try to delete assigned program → verify blocked with message

### 4.2 Orphaned Record Prevention
- [ ] Add foreign key constraints where missing
- [ ] Add cleanup job for orphaned records (or prevent creation)
- [ ] Verify block creation rolls back completely on failure

### 4.3 Habit Template Privacy
- [ ] Update RLS policy: clients can only see templates assigned to them
- [ ] Or: Add `coach_id` filter to template visibility
- [ ] Test: Client A cannot see Coach B's templates

**File:** New migration to fix `habit_templates` RLS policy

---

## Phase 5: Testing & QA (3-4 days)

### 5.1 Critical Path Manual Testing
- [ ] **Coach flow:** Create program → Add exercises → Assign to client
- [ ] **Client flow:** View program → Log workout → See PR detected
- [ ] **Messaging:** Send DM → Receive notification → Reply
- [ ] **Group chat:** Create group → Send message → All members see it
- [ ] **Announcements:** Create announcement → All clients notified
- [ ] **Habits:** Assign habit → Client logs completion → Streak updates

### 5.2 Edge Case Testing
- [ ] Test with slow/flaky network (Chrome DevTools throttling)
- [ ] Test rapid successive saves
- [ ] Test concurrent edits (two browser tabs)
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Test PWA installation and offline behavior

### 5.3 Error Scenario Testing
- [ ] Test with expired auth token
- [ ] Test with invalid data inputs
- [ ] Test delete operations on in-use items
- [ ] Test network failure during save

### 5.4 Add Automated Tests (Optional but Recommended)
- [ ] Add tests for PR detection logic
- [ ] Add tests for auto-save mechanism
- [ ] Add tests for message sending/receiving
- [ ] Add E2E test for critical coach→client flow

---

## Phase 6: Deployment Prep (2-3 days)

### 6.1 Environment Setup
- [ ] Verify all environment variables documented
- [ ] Set up production Supabase project (or verify existing)
- [ ] Configure production VAPID keys
- [ ] Set up custom domain (if desired)

### 6.2 Error Monitoring
- [ ] Add error tracking (Sentry, LogRocket, or similar)
- [ ] Set up alerts for critical errors
- [ ] Add basic analytics (page views, feature usage)

### 6.3 Deployment
- [ ] Deploy to Vercel (or preferred host)
- [ ] Run all migrations on production database
- [ ] Test critical flows on production
- [ ] Set up database backups

### 6.4 Beta User Setup
- [ ] Create coach account
- [ ] Create initial program(s)
- [ ] Invite beta testers
- [ ] Prepare feedback collection method (form, Discord, etc.)

---

## Quick Reference: File Locations

| Area | Key Files |
|------|-----------|
| Workout Logging | `src/app/(client)/workouts/[dayId]/WorkoutDayClient.tsx` |
| Program Builder | `src/app/coach/programs/[id]/ProgramBuilderClient.tsx` |
| Client Management | `src/app/coach/clients/[id]/ClientDetailClient.tsx` |
| 1-on-1 Messaging | `src/hooks/useMessages.ts`, `src/hooks/useConversations.ts` |
| Group Chat | `src/hooks/useGroupMessages.ts`, `src/hooks/useGroupChats.ts` |
| Unread Counts | `src/hooks/useUnreadCounts.ts` |
| Push Notifications | `src/lib/push-server.ts`, `src/lib/push-notifications.ts` |
| Migrations | `supabase/migrations/` |

---

## Timeline Summary

| Phase | Days | Hours (at 3hr/day avg) |
|-------|------|------------------------|
| 1. Critical Messaging | 3-5 | 9-15 hrs |
| 2. Workout Stability | 4-6 | 12-18 hrs |
| 3. Error Handling | 3-4 | 9-12 hrs |
| 4. Data Integrity | 2-3 | 6-9 hrs |
| 5. Testing & QA | 3-4 | 9-12 hrs |
| 6. Deployment | 2-3 | 6-9 hrs |
| **Total** | **17-25** | **51-75 hrs** |

**Realistic beta date: January 20-27, 2025** (assuming start Jan 3)

---

## Optional: Reduced Scope Beta

If you want to launch faster, consider deferring:
- Group chat (keep 1-on-1 messaging only) → Saves 2-3 days
- Rivalries → Already working, low risk
- Habit tracking → Lower priority than core workout

**Minimal beta (workout + 1-on-1 messaging only): ~2 weeks**
