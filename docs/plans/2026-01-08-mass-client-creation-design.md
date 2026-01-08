# Mass Client Creation Feature Design

## Overview

Enable coaches to bulk create client accounts, book sessions for them, and send invite emails when ready. Clients receive an email to set their password and can immediately see their booked sessions upon login.

## Data Model Changes

### Invites Table Additions

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Client's name, provided at bulk creation |
| `client_type` | enum (online/training/hybrid) | Training type |
| `invite_sent_at` | timestamp (nullable) | When invite email was sent (null = not sent yet) |

### Bookings Table Addition

| Field | Type | Description |
|-------|------|-------------|
| `client_email` | string (nullable) | Used when booking pending clients (client_id is null) |

### State Definitions

- **Pending client**: Invite record exists, `accepted_at` is null
- **Invite sent**: `invite_sent_at` is not null
- **Active client**: Profile exists (invite was accepted)

## UI Components

### 1. Bulk Add Clients Modal

Location: Clients page, alongside existing "Invite Client" button

**Input format:**
```
john@email.com, John Smith, training
jane@email.com, Jane Doe, online
mike@email.com, Mike Johnson, hybrid
```

- One client per line
- Comma-separated: email, name, client type
- Client type accepts: `online`, `training`, `hybrid` (case-insensitive)

**Flow:**
1. Paste list into text area
2. Click "Preview" → shows parsed table with validation
   - Green rows = valid
   - Red rows = errors (invalid email, missing fields, duplicate, etc.)
3. Fix errors and re-preview, or proceed with valid rows only
4. Click "Create Clients" → creates invite records (no emails sent)
5. Success message: "Created X pending clients"

**Validation rules:**
- Valid email format
- Name not empty
- Client type must be online/training/hybrid
- No duplicate emails (within paste or existing invites/profiles)

### 2. Clients Table Updates

**New columns/elements:**
- Status column with "Active" or "Pending" badge
- Invite status indicator for pending: "Invite not sent" or "Invite sent [date]"
- "Send Invite" button on pending client rows
- Checkbox column for bulk selection

**Filter tabs:**
- All | Active | Pending
- Default view: All

**Bulk actions:**
- Select multiple pending clients
- "Send Invites" button appears
- Confirmation dialog before sending

### 3. Pending Client Behavior

- Clicking pending client row opens detail page
- Can be booked for sessions while pending
- Status automatically updates to Active when invite accepted

## Booking Pending Clients

### Approach: Link by Email

When booking a pending client:
- Store their email from the invite record
- Use `client_email` field when `client_id` is null

### Coach Booking Flow

Client selection dropdown shows:
- Active clients (from profiles)
- Pending clients (from invites, with "Pending" badge)

### Post-Acceptance Linking

When client accepts invite:
- Database trigger or post-signup hook runs
- Links bookings where `client_email` matches new profile email
- Sets `client_id` to new profile ID

## Email & Invite Flow

### Sending Invites

Triggered individually or in bulk:
1. Generate unique token for invite (if not present)
2. Send email via Supabase edge function (`send-email`, template: `client-invite`)
3. Set `invite_sent_at` timestamp
4. Email contains link: `/invite/[token]`

### Invite Acceptance Page Changes

`/invite/[token]` page updates:
- Pre-fill name field (editable)
- Pre-select client type
- Client only sets password
- On submit:
  - Create Supabase auth user + profile
  - Copy name and client_type from invite
  - Mark invite accepted
  - Trigger booking linkage hook

### Re-sending Invites

- Button changes to "Resend Invite" if already sent
- Generates new token (invalidates old for security)
- Updates `invite_sent_at`

### Invite Expiry

- 7-day expiry from when email is sent
- Unsent invites don't expire (no link exists)

## Implementation Tasks

### Database
1. Add migration for invites table columns (name, client_type, invite_sent_at)
2. Add migration for bookings table column (client_email)
3. Create database trigger to link bookings on invite acceptance

### API
4. Create bulk invite creation endpoint
5. Create send invite endpoint (individual)
6. Create bulk send invites endpoint
7. Update booking creation to support pending clients

### UI
8. Create BulkAddClientsModal component
9. Update ClientsTable with status badges and filters
10. Add checkbox selection and bulk actions to ClientsTable
11. Add Send Invite button to pending client rows
12. Update client selection in booking flow to include pending clients
13. Update invite acceptance page to pre-fill from invite data
