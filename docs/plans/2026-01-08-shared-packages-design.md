# Shared Session Packages Design

## Overview

Allow multiple clients (e.g., family members) to share a single session package. Each member can book independently from a shared pool of sessions, with usage tracked per person.

## Use Case

A mom buys a 12-session package. Her daughter can also book sessions from the same pool. Each booking deducts 1 session regardless of who books. Coach can see breakdown of who used what.

## Data Model

### New table: `session_package_members`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| package_id | uuid | FK to session_packages |
| client_id | uuid | FK to profiles (the additional member) |
| added_at | timestamptz | When they were added |
| added_by | uuid | FK to profiles (coach who added them) |

**Constraints:**
- UNIQUE(package_id, client_id) - can't add same member twice
- client_id cannot equal package owner's client_id

### How it works

- Existing `session_packages.client_id` = **owner** (e.g., mom)
- Additional members (e.g., daughter) get rows in `session_package_members`
- Both owner and members book from same `remaining_sessions` pool
- Same `decrement_session` function runs for any booking
- Usage tracking: query `bookings` grouped by `client_id` where `package_id = X`

## Access & Permissions

| Action | Owner | Member | Coach |
|--------|-------|--------|-------|
| View package details | Yes | Yes | Yes |
| See remaining sessions | Yes | Yes | Yes |
| Book sessions from pool | Yes | Yes | Yes |
| See usage breakdown | No | No | Yes |
| Add/remove members | No | No | Yes |
| Adjust session count | No | No | Yes |

### RLS Policies

**session_packages:**
- Allow SELECT if `client_id = auth.uid()` OR user exists in `session_package_members` for that package

**session_package_members:**
- Members can see their own membership row
- Coaches see all members for packages they own

### Booking Validation

When client books with a package:
1. Check if `client_id` = package owner, OR
2. Check if `client_id` exists in `session_package_members` for that package
3. If neither, reject booking

## User Interface

### Coach: Client Profile Package Card

Current display:
```
6 of 12 sessions remaining
```

With members:
```
6 of 12 sessions remaining
Shared with: Sarah (daughter)
[Manage Members]
```

### Coach: Manage Members Modal

- List of current members with "Remove" button
- "Add Member" dropdown showing coach's other clients
- Simple add/remove operations

### Coach: Package Usage Breakdown

New section in package details:
```
Usage Breakdown
- Mom: 3 sessions used
- Sarah: 1 session used
```

### Client: Booking Page

- Shared packages appear in available packages list
- Display: "Family Package - 8 sessions remaining (shared)"
- No visibility into other members' usage

### Client: Package Display

Owner sees:
```
8 sessions remaining (shared with Sarah)
```

Member sees:
```
8 sessions remaining (shared with Mom)
```

### Package Selection (Multiple Packages)

If client has access to multiple active packages:
- Show package selector dropdown at booking time
- Default to package with more remaining sessions

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Package expires | All members lose access |
| Package hits 0 sessions | No one can book, owner gets notification |
| Member removed | Can't book new sessions, existing bookings stay valid |
| Owner deleted from system | Package remains, members keep access, coach manages |
| Member has own package too | Can have both, chooses at booking time |

## Notifications

| Notification | Recipient |
|--------------|-----------|
| Low session warning | Owner only |
| Expiration warning | Owner only |
| Booking confirmation | Whoever booked |

## Implementation Summary

1. **Database migration:** Create `session_package_members` table with RLS policies
2. **API updates:**
   - Add/remove member endpoints
   - Update package fetch to include members
   - Update booking validation to check membership
3. **Coach UI:**
   - Add "Shared with" display on package cards
   - Create Manage Members modal
   - Add usage breakdown view
4. **Client UI:**
   - Update package display to show shared status
   - Add package selector when multiple packages available
