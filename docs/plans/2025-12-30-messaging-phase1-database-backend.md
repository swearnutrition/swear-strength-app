# Messaging System Phase 1: Database & Backend

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the database schema, storage bucket, and API routes for the messaging system.

**Architecture:** Supabase PostgreSQL with RLS policies for security, Supabase Storage for media files, Next.js API routes for business logic.

**Tech Stack:** Supabase, Next.js 16, TypeScript

---

## Task 1: Create Database Migration

**Files:**
- Create: `supabase/migrations/038_messaging_system.sql`

**Step 1: Write the migration file**

```sql
-- Migration: Messaging system for coach-client communication
-- Tables: conversations, messages, announcements, announcement_recipients, push_subscriptions

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

-- Indexes
CREATE INDEX idx_conversations_client ON conversations(client_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Coach can view all conversations
CREATE POLICY "Coach can view all conversations"
  ON conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view their own conversation
CREATE POLICY "Clients can view own conversation"
  ON conversations
  FOR SELECT
  USING (auth.uid() = client_id);

-- Coach can create conversations
CREATE POLICY "Coach can create conversations"
  ON conversations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Coach can update conversations (for last_message_at)
CREATE POLICY "Coach can update conversations"
  ON conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can update their own conversation (for last_message_at)
CREATE POLICY "Clients can update own conversation"
  ON conversations
  FOR UPDATE
  USING (auth.uid() = client_id);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'gif', 'video')),
  media_url TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(conversation_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Coach can view all messages
CREATE POLICY "Coach can view all messages"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view messages in their conversation
CREATE POLICY "Clients can view own conversation messages"
  ON messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.client_id = auth.uid()
    )
  );

-- Coach can insert messages
CREATE POLICY "Coach can insert messages"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can insert messages in their conversation
CREATE POLICY "Clients can insert own conversation messages"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.client_id = auth.uid()
    )
  );

-- Users can soft-delete their own messages
CREATE POLICY "Users can delete own messages"
  ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- ============================================
-- ANNOUNCEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  send_push BOOLEAN NOT NULL DEFAULT FALSE,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'selected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX idx_announcements_pinned ON announcements(is_pinned, created_at DESC);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Coach can do everything with announcements
CREATE POLICY "Coach can manage announcements"
  ON announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view announcements (via announcement_recipients join)
CREATE POLICY "Clients can view announcements"
  ON announcements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM announcement_recipients
      WHERE announcement_recipients.announcement_id = announcements.id
      AND announcement_recipients.client_id = auth.uid()
    )
  );

-- ============================================
-- ANNOUNCEMENT RECIPIENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS announcement_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, client_id)
);

-- Indexes
CREATE INDEX idx_announcement_recipients_announcement ON announcement_recipients(announcement_id);
CREATE INDEX idx_announcement_recipients_client ON announcement_recipients(client_id);
CREATE INDEX idx_announcement_recipients_unread ON announcement_recipients(client_id, read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;

-- Coach can manage all recipients
CREATE POLICY "Coach can manage announcement recipients"
  ON announcement_recipients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Clients can view their own recipients
CREATE POLICY "Clients can view own announcement recipients"
  ON announcement_recipients
  FOR SELECT
  USING (auth.uid() = client_id);

-- Clients can update their own (mark as read)
CREATE POLICY "Clients can update own announcement recipients"
  ON announcement_recipients
  FOR UPDATE
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- ============================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coach can view all subscriptions (for sending notifications)
CREATE POLICY "Coach can view all push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE announcement_recipients;
```

**Step 2: Apply the migration**

Run:
```bash
npx supabase db push
```

Or if using Supabase CLI locally:
```bash
npx supabase migration up
```

**Step 3: Verify migration**

Run in Supabase SQL editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('conversations', 'messages', 'announcements', 'announcement_recipients', 'push_subscriptions');
```

Expected: 5 rows returned

**Step 4: Commit**

```bash
git add supabase/migrations/038_messaging_system.sql
git commit -m "feat: add messaging system database schema

Tables: conversations, messages, announcements, announcement_recipients, push_subscriptions
Includes RLS policies and realtime subscriptions"
```

---

## Task 2: Create Supabase Storage Bucket

**Files:**
- Create: `supabase/migrations/039_messaging_storage.sql`

**Step 1: Write the storage migration**

```sql
-- Migration: Storage bucket for messaging media files

-- Create the messages storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'messages',
  'messages',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies

-- Anyone authenticated can upload to messages bucket
CREATE POLICY "Authenticated users can upload messages media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'messages');

-- Anyone can view messages media (public bucket)
CREATE POLICY "Anyone can view messages media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'messages');

-- Users can delete their own uploads
CREATE POLICY "Users can delete own messages media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'messages' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Step 2: Apply the migration**

Run:
```bash
npx supabase db push
```

**Step 3: Verify bucket creation**

Check Supabase dashboard > Storage > Buckets. Should see "messages" bucket.

**Step 4: Commit**

```bash
git add supabase/migrations/039_messaging_storage.sql
git commit -m "feat: add messages storage bucket for media uploads"
```

---

## Task 3: Create Conversations API Routes

**Files:**
- Create: `src/app/api/messages/conversations/route.ts`

**Step 1: Write the route**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/messages/conversations - List all conversations (coach only)
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get all conversations with client info and last message
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      id,
      client_id,
      last_message_at,
      created_at,
      client:profiles!conversations_client_id_fkey(id, name, avatar_url),
      messages(
        id,
        content,
        content_type,
        sender_id,
        is_deleted,
        read_at,
        created_at
      )
    `)
    .order('last_message_at', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Process conversations to include unread count and last message
  const processedConversations = (conversations || []).map((conv) => {
    const messages = conv.messages || []
    const lastMessage = messages.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

    // Unread = messages from client that coach hasn't read
    const unreadCount = messages.filter(
      (m) => m.sender_id === conv.client_id && !m.read_at && !m.is_deleted
    ).length

    return {
      id: conv.id,
      clientId: conv.client_id,
      clientName: conv.client?.name || 'Unknown',
      clientAvatar: conv.client?.avatar_url,
      lastMessageAt: conv.last_message_at,
      lastMessage: lastMessage ? {
        content: lastMessage.is_deleted ? 'Message deleted' : lastMessage.content,
        contentType: lastMessage.content_type,
        senderId: lastMessage.sender_id,
        createdAt: lastMessage.created_at,
      } : null,
      unreadCount,
    }
  })

  return NextResponse.json({ conversations: processedConversations })
}

// POST /api/messages/conversations - Create a conversation (coach only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const clientId = body.clientId || body.client_id

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 })
  }

  // Check if conversation already exists
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('client_id', clientId)
    .single()

  if (existing) {
    return NextResponse.json({ conversation: { id: existing.id, clientId } })
  }

  // Create new conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({ client_id: clientId })
    .select('id, client_id')
    .single()

  if (error) {
    console.error('Error creating conversation:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      clientId: conversation.client_id,
    }
  })
}
```

**Step 2: Commit**

```bash
git add src/app/api/messages/conversations/route.ts
git commit -m "feat: add conversations list and create API routes"
```

---

## Task 4: Create Single Conversation API Route

**Files:**
- Create: `src/app/api/messages/conversations/[id]/route.ts`

**Step 1: Write the route**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/messages/conversations/[id] - Get messages for a conversation
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

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'

  // Verify access to conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, client_id')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Clients can only access their own conversation
  if (!isCoach && conversation.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get messages
  const { data: messages, error } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      content,
      content_type,
      media_url,
      is_deleted,
      read_at,
      created_at,
      sender:profiles!messages_sender_id_fkey(id, name, avatar_url, role)
    `)
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const processedMessages = (messages || []).map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    senderName: m.sender?.name || 'Unknown',
    senderAvatar: m.sender?.avatar_url,
    senderRole: m.sender?.role,
    content: m.is_deleted ? null : m.content,
    contentType: m.content_type,
    mediaUrl: m.is_deleted ? null : m.media_url,
    isDeleted: m.is_deleted,
    readAt: m.read_at,
    createdAt: m.created_at,
  }))

  return NextResponse.json({ messages: processedMessages })
}

// POST /api/messages/conversations/[id] - Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name, avatar_url')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'

  // Verify access to conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id, client_id')
    .eq('id', id)
    .single()

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Clients can only send to their own conversation
  if (!isCoach && conversation.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const content = body.content
  const contentType = body.contentType || body.content_type || 'text'
  const mediaUrl = body.mediaUrl || body.media_url

  // Validate
  if (contentType === 'text' && !content) {
    return NextResponse.json({ error: 'Content is required for text messages' }, { status: 400 })
  }
  if (['image', 'gif', 'video'].includes(contentType) && !mediaUrl) {
    return NextResponse.json({ error: 'Media URL is required for media messages' }, { status: 400 })
  }

  // Insert message
  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert({
      conversation_id: id,
      sender_id: user.id,
      content: content || null,
      content_type: contentType,
      media_url: mediaUrl || null,
    })
    .select('id, sender_id, content, content_type, media_url, is_deleted, read_at, created_at')
    .single()

  if (insertError) {
    console.error('Error inserting message:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: message.created_at })
    .eq('id', id)

  return NextResponse.json({
    message: {
      id: message.id,
      senderId: message.sender_id,
      senderName: profile?.name || 'Unknown',
      senderAvatar: profile?.avatar_url,
      senderRole: profile?.role,
      content: message.content,
      contentType: message.content_type,
      mediaUrl: message.media_url,
      isDeleted: message.is_deleted,
      readAt: message.read_at,
      createdAt: message.created_at,
    }
  })
}
```

**Step 2: Commit**

```bash
git add src/app/api/messages/conversations/[id]/route.ts
git commit -m "feat: add single conversation get/post API routes"
```

---

## Task 5: Create Message Actions API Route

**Files:**
- Create: `src/app/api/messages/[id]/route.ts`

**Step 1: Write the route**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/messages/[id] - Soft delete a message
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

  // Verify user owns this message
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select('id, sender_id')
    .eq('id', id)
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.sender_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Soft delete
  const { error: updateError } = await supabase
    .from('messages')
    .update({ is_deleted: true })
    .eq('id', id)

  if (updateError) {
    console.error('Error deleting message:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/messages/[id]/route.ts
git commit -m "feat: add message soft delete API route"
```

---

## Task 6: Create Mark as Read API Route

**Files:**
- Create: `src/app/api/messages/[id]/read/route.ts`

**Step 1: Write the route**

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/messages/[id]/read - Mark a message as read
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

  // Get message with conversation info
  const { data: message, error: msgError } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      conversation_id,
      conversations!messages_conversation_id_fkey(client_id)
    `)
    .eq('id', id)
    .single()

  if (msgError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'
  const conversation = message.conversations as { client_id: string }

  // Verify access: coach can mark any, client can only mark in their conversation
  if (!isCoach && conversation.client_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Don't mark your own messages as read
  if (message.sender_id === user.id) {
    return NextResponse.json({ success: true, message: 'Own message, no action needed' })
  }

  // Mark as read
  const { error: updateError } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
    .is('read_at', null)

  if (updateError) {
    console.error('Error marking message as read:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Commit**

```bash
git add src/app/api/messages/[id]/read/route.ts
git commit -m "feat: add mark message as read API route"
```

---

## Task 7: Create Announcements API Routes

**Files:**
- Create: `src/app/api/announcements/route.ts`

**Step 1: Write the route**

```typescript
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/announcements - List announcements
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isCoach = profile?.role === 'coach'

  if (isCoach) {
    // Coach sees all announcements with read counts
    const { data: announcements, error } = await supabase
      .from('announcements')
      .select(`
        id,
        title,
        content,
        is_pinned,
        send_push,
        target_type,
        created_at,
        announcement_recipients(id, client_id, read_at)
      `)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching announcements:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const processedAnnouncements = (announcements || []).map((a) => {
      const recipients = a.announcement_recipients || []
      const readCount = recipients.filter((r) => r.read_at).length
      const totalCount = recipients.length

      return {
        id: a.id,
        title: a.title,
        content: a.content,
        isPinned: a.is_pinned,
        sendPush: a.send_push,
        targetType: a.target_type,
        createdAt: a.created_at,
        readCount,
        totalCount,
      }
    })

    return NextResponse.json({ announcements: processedAnnouncements })
  } else {
    // Client sees only their announcements
    const { data: recipients, error } = await supabase
      .from('announcement_recipients')
      .select(`
        id,
        read_at,
        announcement:announcements(
          id,
          title,
          content,
          is_pinned,
          created_at
        )
      `)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching client announcements:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const processedAnnouncements = (recipients || [])
      .filter((r) => r.announcement)
      .map((r) => {
        const a = r.announcement as {
          id: string
          title: string
          content: string
          is_pinned: boolean
          created_at: string
        }
        return {
          id: a.id,
          recipientId: r.id,
          title: a.title,
          content: a.content,
          isPinned: a.is_pinned,
          createdAt: a.created_at,
          readAt: r.read_at,
        }
      })
      .sort((a, b) => {
        // Pinned first, then by date
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })

    return NextResponse.json({ announcements: processedAnnouncements })
  }
}

// POST /api/announcements - Create announcement (coach only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const title = body.title
  const content = body.content
  const isPinned = body.isPinned ?? body.is_pinned ?? false
  const sendPush = body.sendPush ?? body.send_push ?? false
  const targetType = body.targetType ?? body.target_type ?? 'all'
  const selectedClientIds = body.selectedClientIds ?? body.selected_client_ids ?? []

  if (!title || !content) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
  }

  // Create announcement
  const { data: announcement, error: insertError } = await supabase
    .from('announcements')
    .insert({
      title,
      content,
      is_pinned: isPinned,
      send_push: sendPush,
      target_type: targetType,
    })
    .select('id, title, content, is_pinned, send_push, target_type, created_at')
    .single()

  if (insertError) {
    console.error('Error creating announcement:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Get target clients
  let clientIds: string[] = []
  if (targetType === 'all') {
    const { data: clients } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'client')

    clientIds = (clients || []).map((c) => c.id)
  } else {
    clientIds = selectedClientIds
  }

  // Create recipients
  if (clientIds.length > 0) {
    const recipients = clientIds.map((clientId) => ({
      announcement_id: announcement.id,
      client_id: clientId,
    }))

    const { error: recipientError } = await supabase
      .from('announcement_recipients')
      .insert(recipients)

    if (recipientError) {
      console.error('Error creating recipients:', recipientError)
      // Don't fail the whole request, announcement is created
    }
  }

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      isPinned: announcement.is_pinned,
      sendPush: announcement.send_push,
      targetType: announcement.target_type,
      createdAt: announcement.created_at,
      readCount: 0,
      totalCount: clientIds.length,
    }
  })
}
```

**Step 2: Commit**

```bash
git add src/app/api/announcements/route.ts
git commit -m "feat: add announcements list and create API routes"
```

---

## Task 8: Create Single Announcement API Routes

**Files:**
- Create: `src/app/api/announcements/[id]/route.ts`
- Create: `src/app/api/announcements/[id]/read/route.ts`

**Step 1: Write the delete route**

```typescript
// src/app/api/announcements/[id]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/announcements/[id] - Delete announcement (coach only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is coach
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting announcement:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 2: Write the read route**

```typescript
// src/app/api/announcements/[id]/read/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/announcements/[id]/read - Mark announcement as read (client)
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

  // Update recipient record
  const { error } = await supabase
    .from('announcement_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('announcement_id', id)
    .eq('client_id', user.id)
    .is('read_at', null)

  if (error) {
    console.error('Error marking announcement as read:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

**Step 3: Commit**

```bash
git add src/app/api/announcements/[id]/route.ts src/app/api/announcements/[id]/read/route.ts
git commit -m "feat: add announcement delete and mark-as-read API routes"
```

---

## Task 9: Create Client Conversation API Route

**Files:**
- Create: `src/app/api/messages/my-conversation/route.ts`

**Step 1: Write the route**

This route lets clients get their conversation without knowing the ID.

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/messages/my-conversation - Get or create client's conversation
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify user is a client
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'client') {
    return NextResponse.json({ error: 'Forbidden - clients only' }, { status: 403 })
  }

  // Get existing conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('id, client_id, last_message_at, created_at')
    .eq('client_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error fetching conversation:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (conversation) {
    return NextResponse.json({
      conversation: {
        id: conversation.id,
        clientId: conversation.client_id,
        lastMessageAt: conversation.last_message_at,
        createdAt: conversation.created_at,
      }
    })
  }

  // No conversation exists yet - return null (coach needs to initiate)
  return NextResponse.json({ conversation: null })
}
```

**Step 2: Commit**

```bash
git add src/app/api/messages/my-conversation/route.ts
git commit -m "feat: add client my-conversation API route"
```

---

## Summary

Phase 1 creates the complete backend foundation:

| Item | Status |
|------|--------|
| Database tables | 5 tables with RLS |
| Storage bucket | messages bucket with policies |
| Conversations API | List, create, get messages, send message |
| Messages API | Delete, mark as read |
| Announcements API | List, create, delete, mark as read |
| Client API | Get own conversation |

**Next Phase:** Phase 2 will implement React hooks and UI components.
