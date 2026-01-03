# Scheduled & Mass Messaging Design

## Overview

Two features for coach messaging:

1. **Scheduled Messages** - Schedule DMs or announcements to send at a future date/time
2. **Mass DM** - Send the same message to multiple selected clients as private DMs

## Key Decisions

- Scheduled messages work for both individual DMs and announcements
- Mass DMs appear as personal 1-on-1 messages (clients don't know others received it)
- "Send" and "Schedule" buttons side by side in compose UI
- Dedicated "Scheduled" tab to view/edit/cancel pending messages

## Database Schema

New table: `scheduled_messages`

```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('dm', 'mass_dm', 'announcement')),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'gif', 'video')),
  media_url TEXT,

  -- For single DMs
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,

  -- For mass DMs (array of client IDs)
  recipient_ids UUID[],

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_scheduled_messages_coach ON scheduled_messages(coach_id);
CREATE INDEX idx_scheduled_messages_status_scheduled ON scheduled_messages(status, scheduled_for)
  WHERE status = 'pending';

-- RLS
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can manage own scheduled messages"
  ON scheduled_messages FOR ALL
  USING (coach_id = auth.uid());
```

## Coach UI Flow

### 1. Scheduling a single DM
- Coach is in a client's chat, types message
- Clicks "Schedule" button (next to Send)
- Date/time picker modal appears
- Picks date/time → message saved with `message_type: 'dm'`
- Toast: "Message scheduled for Jan 5 at 8:00 AM"

### 2. Mass DM flow
- "Broadcast" button in coach messages header
- Opens compose modal with client multi-select checkboxes
- Coach types message, clicks "Send Now" or "Schedule"
- If scheduled → saved with `message_type: 'mass_dm'` and `recipient_ids` array
- If immediate → creates individual messages in each conversation right away

### 3. Scheduling an announcement
- Same as current announcement compose, but with "Schedule" button added
- Saved with `message_type: 'announcement'`

### 4. "Scheduled" tab
- New tab in coach messages: `Clients | Groups | Scheduled`
- Shows all pending scheduled messages (DMs, mass DMs, announcements)
- Each item shows: type icon, preview, recipient(s), scheduled time
- Click to expand → options to Edit, Send Now, or Cancel

## Backend: Cron Job

Supabase Edge Function: `process-scheduled-messages`

Runs every minute via cron:

1. Query `scheduled_messages WHERE status = 'pending' AND scheduled_for <= NOW()`
2. For each message:
   - `dm`: Insert into messages table, send push notification
   - `mass_dm`: Loop through recipient_ids, insert message into each client's conversation, send push to each
   - `announcement`: Insert into announcements table, send push to all clients
3. Update scheduled_message: `status = 'sent', sent_at = NOW()`
4. On error: `status = 'failed', error_message = <error>`

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scheduled-messages` | GET | List coach's scheduled messages |
| `/api/scheduled-messages` | POST | Create scheduled message |
| `/api/scheduled-messages/[id]` | GET | Get single scheduled message |
| `/api/scheduled-messages/[id]` | PUT | Edit scheduled message |
| `/api/scheduled-messages/[id]` | DELETE | Cancel scheduled message |
| `/api/scheduled-messages/[id]/send-now` | POST | Send immediately |
| `/api/mass-dm` | POST | Send mass DM immediately |

### POST `/api/scheduled-messages` body examples

```json
// Single DM
{
  "messageType": "dm",
  "conversationId": "uuid",
  "content": "Hey!",
  "scheduledFor": "2025-01-10T08:00:00Z"
}

// Mass DM
{
  "messageType": "mass_dm",
  "recipientIds": ["id1", "id2"],
  "content": "Happy New Year!",
  "scheduledFor": "2025-01-01T00:00:00Z"
}

// Announcement
{
  "messageType": "announcement",
  "content": "New program launching Monday!",
  "scheduledFor": "2025-01-06T09:00:00Z"
}
```

## Files to Create/Modify

### New Files
- `supabase/migrations/050_scheduled_messages.sql`
- `supabase/functions/process-scheduled-messages/index.ts`
- `src/app/api/scheduled-messages/route.ts`
- `src/app/api/scheduled-messages/[id]/route.ts`
- `src/app/api/scheduled-messages/[id]/send-now/route.ts`
- `src/app/api/mass-dm/route.ts`
- `src/hooks/useScheduledMessages.ts`
- `src/components/ScheduleModal.tsx`
- `src/components/BroadcastModal.tsx`
- `src/types/scheduled-message.ts`

### Modified Files
- `src/app/coach/messages/CoachMessagesClient.tsx` - Add Scheduled tab, Schedule button
- `src/app/coach/announcements/AnnouncementsClient.tsx` - Add Schedule button
