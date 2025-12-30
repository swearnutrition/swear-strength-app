# Messaging System Design

**Date:** 2025-12-30
**Status:** Approved

## Overview

A messaging system for coach-client communication with two main features:
1. **Direct Messages (DMs)** — 1-on-1 chat between coach and client
2. **Announcements** — Broadcast messages from coach to all/selected clients

## Scope

### Included
- DMs with text, images, videos (30s max), and GIFs
- Announcements with pinning, read tracking, push notifications, targeted recipients
- Push notifications + in-app unread badge
- Coach-only read receipts (clients don't see if coach read their message)
- Soft delete with "message deleted" placeholder

### Deferred
- Real-time typing indicators
- Online status indicators
- OneSignal/native push (using PWA web push for now)

---

## Data Model

### `conversations`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| client_id | UUID | References profiles |
| last_message_at | timestamptz | For sorting |
| created_at | timestamptz | |

### `messages`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| conversation_id | UUID | References conversations |
| sender_id | UUID | References profiles |
| content | text | Message text (nullable for media-only) |
| content_type | text | 'text', 'image', 'gif', 'video' |
| media_url | text | Supabase storage URL or Giphy URL |
| is_deleted | boolean | Soft delete flag |
| read_at | timestamptz | When message was read (null = unread) |
| created_at | timestamptz | |

### `announcements`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | text | |
| content | text | |
| is_pinned | boolean | |
| send_push | boolean | |
| target_type | text | 'all' or 'selected' |
| created_at | timestamptz | |

### `announcement_recipients`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| announcement_id | UUID | References announcements |
| client_id | UUID | References profiles |
| read_at | timestamptz | null = unread |

### `push_subscriptions`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | References profiles |
| endpoint | text | Push service URL |
| keys | jsonb | p256dh and auth keys |
| created_at | timestamptz | |

---

## File Storage & Media Processing

**Supabase Storage bucket:** `messages`

**Path structure:** `{conversation_id}/{uuid}.{ext}`

### Upload Flow

1. Client/coach selects image or video
2. Frontend processing:
   - `.heic`, `.dng` → convert to `.jpg` using `heic2any`
   - Videos → validate duration ≤ 30 seconds
3. Compression:
   - **Images:** `browser-image-compression` — max 1MB, max 1920px, 80% quality
   - **Videos:** `ffmpeg.wasm` — 720p max, ~2Mbps bitrate, output as `.mp4` (h264)
4. Upload to Supabase Storage
5. Store public URL in `messages.media_url`

### GIF Flow
- Use existing Giphy integration
- Store Giphy URL directly in `media_url`

### File Size Limits
- Images: 10MB max (before compression)
- Videos: 50MB max (before compression)

---

## API Routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/messages/conversations` | List all conversations (coach) |
| GET | `/api/messages/conversations/[id]` | Get messages for a conversation |
| POST | `/api/messages/conversations/[id]` | Send a message |
| PATCH | `/api/messages/[id]` | Delete own message (soft delete) |
| PATCH | `/api/messages/[id]/read` | Mark message as read |
| GET | `/api/announcements` | List announcements |
| POST | `/api/announcements` | Create announcement |
| PATCH | `/api/announcements/[id]/read` | Mark announcement as read |
| DELETE | `/api/announcements/[id]` | Delete announcement (coach only) |

---

## React Hooks

- `useConversations()` — list conversations with unread counts, real-time updates
- `useMessages(conversationId)` — messages for a conversation, real-time new messages
- `useAnnouncements()` — list announcements, real-time updates
- `useSendMessage()` — send message with media upload handling
- `useUnreadCount()` — total unread count for nav badge

**Real-time:** Supabase channels for `messages` and `announcements` tables.

---

## UI Components & Pages

### Pages

| Route | Purpose | Who sees it |
|-------|---------|-------------|
| `/coach/messages` | DM inbox with client sidebar + conversation view | Coach |
| `/coach/announcements` | Announcements list + compose view | Coach |
| `/dashboard/messages` | Client's DM view with coach | Client |
| `/dashboard/announcements` | Client's announcements list | Client |

### Components

- `ConversationList` — sidebar with client avatars, last message preview, unread badge
- `MessageThread` — scrollable message list with date separators
- `MessageBubble` — individual message (text, image, video, GIF, deleted state)
- `MessageInput` — text input with GIF picker, image/video upload buttons, send button
- `AnnouncementCard` — announcement display with pinned badge, read count (coach view)
- `AnnouncementComposer` — form with title, content, recipient selector, pin toggle, push toggle
- `GifPicker` — Giphy search modal (reuse existing integration)
- `MediaPreview` — image/video preview before sending
- `UnreadBadge` — nav badge showing total unread count

### Nav Integration
- Add "Messages" link to coach and client nav bars
- Show `UnreadBadge` next to the link

---

## Push Notifications

**Implementation:** PWA web push using `web-push` npm package

### Push Events

| Event | Recipient | Condition |
|-------|-----------|-----------|
| New DM | Client | Always |
| New DM | Coach | Always |
| New Announcement | Clients | Only if `send_push = true` |

### Push Payload
```json
{
  "title": "New message from Coach",
  "body": "Hey, how's your progress...",
  "url": "/dashboard/messages"
}
```

### Platform Support
- ✅ Android Chrome, Firefox, Edge
- ✅ macOS/Windows browsers
- ⚠️ iOS Safari: requires "Add to Home Screen" (PWA mode), iOS 16.4+

---

## Security & RLS Policies

### `conversations`
- Coach: can view all conversations
- Client: can only view their own conversation

### `messages`
- Coach: can view/insert all messages
- Client: can view/insert messages in their own conversation
- Delete: users can only soft-delete their own messages

### `announcements`
- Coach: full access (create, read, delete)
- Client: read-only (via `announcement_recipients`)

### `announcement_recipients`
- Coach: can insert/view all
- Client: can view/update (mark read) only their own

### `push_subscriptions`
- Users can only manage their own subscriptions

### Media Storage RLS (Supabase Storage)
- Upload: authenticated users can upload to their conversation folder
- Read: users can read from conversations they're part of
