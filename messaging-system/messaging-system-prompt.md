# Swear Strength: Coach Messaging System

## Overview
A comprehensive messaging system for coaches to communicate with clients. Includes 1:1 direct messages and broadcast announcements to all clients.

---

## Page Structure

### Three Main Views:
1. **Client Chat** - 1:1 messaging with individual clients
2. **Announcements** - Broadcast messages to all clients
3. **Compose** - Create new announcements

---

## Color Palettes

### Dark Theme
```javascript
const darkColors = {
  bg: '#0c0a1d',
  bgCard: '#1a1630',
  bgCardLight: '#242042',
  bgHover: '#2a2650',
  purple: '#8b5cf6',
  purpleLight: '#a78bfa',
  green: '#34d399',
  amber: '#fbbf24',
  red: '#ef4444',
  blue: '#60a5fa',
  text: '#ffffff',
  textSecondary: '#a5a3b8',
  textMuted: '#6b6880',
  border: '#2d2854',
  messageSent: '#8b5cf6',      // Coach messages
  messageReceived: '#242042',  // Client messages
};
```

### Light Theme
```javascript
const lightColors = {
  bg: '#f8f9fc',
  bgCard: '#ffffff',
  bgCardLight: '#f3f4f8',
  bgHover: '#e8e9f0',
  purple: '#7c5ce0',
  purpleLight: '#ede9fb',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  blue: '#3b82f6',
  text: '#1a1a2e',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  border: '#e5e7eb',
  messageSent: '#7c5ce0',
  messageReceived: '#f3f4f8',
};
```

---

## 1. Client Chat (DM) View

### Layout
```
┌──────────────────┬─────────────────────────────────────────┐
│   SIDEBAR        │            CHAT AREA                    │
│   (320px)        │            (flex: 1)                    │
│                  │                                         │
│                  │                                         │
│                  │                                         │
└──────────────────┴─────────────────────────────────────────┘
```

### Container
```css
display: grid;
grid-template-columns: 320px 1fr;
height: 700px; /* or 100vh - header */
background: bg;
border-radius: 24px;
overflow: hidden;
```

---

### Sidebar - Client List

#### Sidebar Container
```css
background: bgCard;
border-right: 1px solid border;
display: flex;
flex-direction: column;
```

#### Sidebar Header
```css
padding: 20px;
border-bottom: 1px solid border;
```

**Title row:**
```css
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 16px;
```

- Title: `20px`, weight 700, `text`
- New message button:
```css
width: 36px;
height: 36px;
border-radius: 10px;
background: purple;
/* Plus icon inside */
```

#### Search Input
```css
display: flex;
align-items: center;
gap: 10px;
background: bgCardLight;
border-radius: 10px;
padding: 10px 14px;

/* Input */
flex: 1;
border: none;
background: transparent;
color: text;
font-size: 14px;
```

#### Client List Item
```css
display: flex;
align-items: center;
gap: 12px;
padding: 16px 20px;
cursor: pointer;
transition: background 0.2s;

/* Active state */
background: bgCardLight;
border-left: 3px solid purple;

/* Inactive state */
border-left: 3px solid transparent;
```

**Avatar with online indicator:**
```css
/* Avatar */
width: 48px;
height: 48px;
border-radius: 14px;
background: clientColor;
font-size: 18px;
font-weight: 700;
color: white;

/* Online dot */
position: absolute;
bottom: 2px;
right: 2px;
width: 12px;
height: 12px;
border-radius: 50%;
background: green;
border: 2px solid bgCard;
```

**Client info:**
```css
/* Name + time row */
display: flex;
justify-content: space-between;
margin-bottom: 4px;

/* Name */
font-size: 15px;
font-weight: 600;
color: text;

/* Time */
font-size: 12px;
color: textMuted;

/* Last message */
font-size: 13px;
color: textSecondary;
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
max-width: 180px;
```

**Unread badge:**
```css
background: purple;
color: white;
font-size: 11px;
font-weight: 700;
padding: 2px 8px;
border-radius: 10px;
min-width: 20px;
text-align: center;
```

---

### Chat Area

#### Chat Header
```css
display: flex;
align-items: center;
justify-content: space-between;
padding: 16px 24px;
border-bottom: 1px solid border;
background: bgCard;
```

**Client info (left):**
- Avatar: `44px`, `12px` radius, with online dot
- Name: `16px`, weight 700
- Streak badge:
```css
font-size: 11px;
font-weight: 600;
color: amber;
background: amber20;
padding: 2px 8px;
border-radius: 6px;
```
- Status: `12px`, `green` for "Active now"

**More button (right):**
```css
width: 40px;
height: 40px;
border-radius: 10px;
border: 1px solid border;
background: bgCard;
/* Three dots icon */
```

#### Messages Container
```css
flex: 1;
overflow-y: auto;
padding: 24px;
display: flex;
flex-direction: column;
gap: 16px;
```

#### Date Separator
```css
display: flex;
align-items: center;
gap: 16px;
margin: 8px 0;

/* Lines */
flex: 1;
height: 1px;
background: border;

/* Text */
font-size: 12px;
color: textMuted;
font-weight: 500;
```

#### Message Bubble

**Coach message (sent):**
```css
display: flex;
justify-content: flex-end;

/* Bubble */
max-width: 70%;
background: messageSent; /* purple */
color: white;
padding: 12px 16px;
border-radius: 16px 16px 4px 16px;
```

**Client message (received):**
```css
display: flex;
justify-content: flex-start;

/* Bubble */
max-width: 70%;
background: messageReceived; /* gray */
color: text;
padding: 12px 16px;
border-radius: 16px 16px 16px 4px;
```

**Message text:**
```css
margin: 0;
font-size: 14px;
line-height: 1.5;
```

**Time + read receipt:**
```css
display: flex;
align-items: center;
justify-content: flex-end;
gap: 4px;
margin-top: 6px;

/* Time */
font-size: 11px;
color: rgba(255,255,255,0.7); /* for sent */
color: textMuted; /* for received */

/* Double check icon for read */
/* Show only on sent messages */
```

#### Message Input Area
```css
padding: 16px 24px;
border-top: 1px solid border;
background: bgCard;
```

**Input container:**
```css
display: flex;
align-items: flex-end;
gap: 12px;
background: bgCardLight;
border-radius: 16px;
padding: 12px 16px;
```

**Action buttons (image, emoji):**
```css
width: 36px;
height: 36px;
border-radius: 10px;
border: none;
background: transparent;
color: textMuted;
```

**Text input:**
```css
flex: 1;
border: none;
background: transparent;
color: text;
font-size: 14px;
resize: none;
min-height: 24px;
max-height: 120px;
line-height: 1.5;
```

**Send button:**
```css
width: 44px;
height: 44px;
border-radius: 12px;
background: purple;
color: white;
/* Send/arrow icon */
```

---

## 2. Announcements List View

### Container
```css
max-width: 800px;
margin: 0 auto;
background: bg;
border-radius: 24px;
padding: 24px;
```

### Header
```css
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 24px;
```

**Left side:**
- Icon container:
```css
width: 48px;
height: 48px;
border-radius: 14px;
background: purple20;
/* Megaphone icon in purple */
```
- Title: `22px`, weight 700
- Subtitle: `13px`, `textSecondary`

**New Announcement button:**
```css
display: flex;
align-items: center;
gap: 8px;
padding: 12px 20px;
border-radius: 12px;
background: purple;
color: white;
font-size: 14px;
font-weight: 600;
```

### Announcement Card
```css
background: bgCard;
border-radius: 16px;
padding: 20px;
cursor: pointer;
transition: transform 0.2s;
margin-bottom: 16px;

/* Default border */
border: 1px solid border; /* light mode */
border: none; /* dark mode */

/* Pinned border */
border: 2px solid purple40;
```

**Pinned badge:**
```css
position: absolute;
top: -10px;
right: 20px;
display: flex;
align-items: center;
gap: 4px;
background: purple;
color: white;
font-size: 11px;
font-weight: 600;
padding: 4px 10px;
border-radius: 8px;
/* Pin icon */
```

**Title:**
```css
font-size: 16px;
font-weight: 700;
color: text;
margin-bottom: 8px;
```

**Preview text:**
```css
font-size: 14px;
color: textSecondary;
line-height: 1.5;
margin-bottom: 16px;
/* Truncate with ellipsis if needed */
```

**Footer:**
```css
display: flex;
justify-content: space-between;
align-items: center;
padding-top: 12px;
border-top: 1px solid border;
```

**Date/time:**
```css
font-size: 12px;
color: textMuted;
```

**Read count badge:**
```css
display: flex;
align-items: center;
gap: 6px;
background: bgCardLight;
padding: 4px 10px;
border-radius: 8px;

/* Check icon */
color: green;

/* Text */
font-size: 12px;
color: textSecondary;
```
Format: `✓ 12/14 read`

**View Details button:**
```css
padding: 6px 12px;
border-radius: 8px;
border: 1px solid border;
background: transparent;
color: textSecondary;
font-size: 12px;
font-weight: 600;
```

---

## 3. Compose Announcement View

### Container
```css
max-width: 700px;
margin: 0 auto;
background: bg;
border-radius: 24px;
padding: 24px;
```

### Header
```css
display: flex;
align-items: center;
gap: 16px;
margin-bottom: 24px;
```

**Back button:**
```css
width: 40px;
height: 40px;
border-radius: 10px;
border: 1px solid border;
background: bgCard;
/* Back arrow icon */
```

**Title:** `20px`, weight 700

### Form Container
```css
background: bgCard;
border-radius: 16px;
padding: 24px;
```

### Form Fields

#### Recipients Field
```css
margin-bottom: 20px;
```

**Label:**
```css
display: block;
font-size: 13px;
font-weight: 600;
color: textSecondary;
margin-bottom: 8px;
```

**Recipients row:**
```css
display: flex;
align-items: center;
gap: 8px;
flex-wrap: wrap;
```

**All Clients pill (selected):**
```css
display: flex;
align-items: center;
gap: 8px;
background: purple;
color: white;
padding: 8px 14px;
border-radius: 10px;
font-size: 13px;
font-weight: 600;
```

**Select specific button:**
```css
padding: 8px 14px;
border-radius: 10px;
border: 1px dashed border;
background: transparent;
color: textSecondary;
font-size: 13px;
font-weight: 600;
```

#### Title Input
```css
width: 100%;
padding: 14px 16px;
border-radius: 12px;
border: 1px solid border;
background: bgCardLight;
color: text;
font-size: 15px;
```
Placeholder: `e.g., 🎉 New Challenge Starting Soon!`

#### Message Textarea
```css
width: 100%;
padding: 14px 16px;
border-radius: 12px;
border: 1px solid border;
background: bgCardLight;
color: text;
font-size: 14px;
resize: vertical;
line-height: 1.6;
min-height: 150px;
```
Placeholder: `Write your announcement here...`

#### Options Row
```css
display: flex;
align-items: center;
gap: 24px;
padding: 16px 0;
border-top: 1px solid border;
border-bottom: 1px solid border;
margin-bottom: 20px;
```

**Checkbox label:**
```css
display: flex;
align-items: center;
gap: 10px;
cursor: pointer;

/* Checkbox */
width: 18px;
height: 18px;
accent-color: purple;

/* Text */
font-size: 14px;
color: text;
```

Options:
- `[ ] Pin to top`
- `[✓] Send push notification` (default checked)

#### Action Buttons
```css
display: flex;
justify-content: flex-end;
gap: 12px;
```

**Save Draft button:**
```css
padding: 12px 24px;
border-radius: 10px;
border: 1px solid border;
background: transparent;
color: textSecondary;
font-size: 14px;
font-weight: 600;
```

**Send button:**
```css
display: flex;
align-items: center;
gap: 8px;
padding: 12px 24px;
border-radius: 10px;
border: none;
background: purple;
color: white;
font-size: 14px;
font-weight: 600;
/* Send icon */
```

### Footer Hint
```css
font-size: 13px;
color: textMuted;
text-align: center;
margin-top: 16px;
```
Text: `💡 This will be sent to all 14 clients and appear in their app notifications`

---

## Data Types

```typescript
interface Client {
  id: string;
  name: string;
  avatar: string;
  color: string;
  online: boolean;
  lastSeen: Date;
  streak: number;
}

interface Message {
  id: string;
  conversationId: string;
  sender: 'coach' | 'client';
  text: string;
  timestamp: Date;
  read: boolean;
  attachments?: Attachment[];
}

interface Conversation {
  id: string;
  clientId: string;
  client: Client;
  lastMessage: Message;
  unreadCount: number;
  updatedAt: Date;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  pinned: boolean;
  sentPush: boolean;
  readBy: string[]; // client IDs
  totalRecipients: number;
}

interface AnnouncementDraft {
  title: string;
  body: string;
  recipients: 'all' | string[]; // 'all' or array of client IDs
  pinned: boolean;
  sendPush: boolean;
}
```

---

## Interactions

### Client List
- Click client → Open conversation
- Search → Filter clients by name
- New message button → Open client selector

### Chat
- Type message → Enable send button
- Click send → Send message, scroll to bottom
- Image button → Open image picker
- Emoji button → Open emoji picker
- More button → Options menu (mute, archive, etc.)

### Announcements
- Click card → Expand to full view
- View Details → Open announcement detail modal
- New Announcement → Navigate to compose

### Compose
- Back button → Return to announcements (confirm if draft)
- All Clients → Selected by default
- Select specific → Open client multi-select
- Pin to top → Toggle
- Send push → Toggle (default on)
- Save Draft → Save and return
- Send → Validate, send, return to list

---

## Empty States

### No Conversations
```
┌─────────────────────────────────────┐
│            💬                       │
│     No messages yet                 │
│                                     │
│   Start a conversation with         │
│   one of your clients               │
│                                     │
│      [+ New Message]                │
└─────────────────────────────────────┘
```

### No Announcements
```
┌─────────────────────────────────────┐
│            📢                       │
│     No announcements yet            │
│                                     │
│   Create your first announcement    │
│   to keep clients informed          │
│                                     │
│      [+ New Announcement]           │
└─────────────────────────────────────┘
```

### Empty Conversation
```
┌─────────────────────────────────────┐
│                                     │
│            💬                       │
│     Start the conversation          │
│                                     │
│   Send a message to {clientName}    │
│                                     │
└─────────────────────────────────────┘
```

---

## Responsive Behavior

### Desktop (1200px+)
- Full sidebar + chat layout
- 320px sidebar width

### Tablet (768px - 1199px)
- Collapsible sidebar
- Show either list or chat (not both)

### Mobile (<768px)
- Full-screen views
- Swipe between list and chat
- Bottom sheet for compose

---

## Real-time Features

### Typing Indicator
Show when client is typing:
```
{clientName} is typing...
```
Below last message, with animated dots.

### Online Status
- Poll every 30 seconds OR use WebSocket
- Show last seen time if offline: `Last seen 2h ago`

### New Message
- Add to conversation in real-time
- Update unread badge
- Show notification if not in chat

### Read Receipts
- Single check: Sent
- Double check: Delivered
- Blue double check: Read (optional)

---

## Push Notifications

### New Message
```
Title: {coachName}
Body: {messagePreview}
```

### New Announcement
```
Title: 📢 {announcementTitle}
Body: {announcementPreview}
```

---

## Implementation Checklist

### Client Chat
- [ ] Sidebar container
- [ ] Search input
- [ ] Client list with avatars
- [ ] Online indicators
- [ ] Unread badges
- [ ] Active conversation highlight
- [ ] Chat header with client info
- [ ] Streak badge
- [ ] Messages container
- [ ] Date separators
- [ ] Message bubbles (sent/received)
- [ ] Time stamps
- [ ] Read receipts
- [ ] Message input area
- [ ] Image/emoji/send buttons
- [ ] Auto-scroll to bottom

### Announcements
- [ ] Page header
- [ ] New announcement button
- [ ] Announcement cards
- [ ] Pinned badge
- [ ] Read count display
- [ ] View details button
- [ ] Empty state

### Compose
- [ ] Back navigation
- [ ] Recipient selector
- [ ] All clients pill
- [ ] Specific client selector
- [ ] Title input
- [ ] Message textarea
- [ ] Pin to top toggle
- [ ] Send push toggle
- [ ] Save draft button
- [ ] Send button
- [ ] Validation
- [ ] Success feedback

### Theming
- [ ] Dark mode
- [ ] Light mode
- [ ] Message bubble colors

---

## File Structure

```
components/
  messaging/
    ClientChat/
      ClientChat.tsx
      Sidebar.tsx
      ClientList.tsx
      ClientListItem.tsx
      ChatHeader.tsx
      MessageList.tsx
      MessageBubble.tsx
      DateSeparator.tsx
      MessageInput.tsx
      TypingIndicator.tsx
    Announcements/
      AnnouncementsList.tsx
      AnnouncementCard.tsx
      AnnouncementDetail.tsx
      ComposeAnnouncement.tsx
      RecipientSelector.tsx
    shared/
      Avatar.tsx
      OnlineIndicator.tsx
      UnreadBadge.tsx
      EmptyState.tsx
hooks/
  useConversations.ts
  useMessages.ts
  useAnnouncements.ts
  useOnlineStatus.ts
  useTypingIndicator.ts
types/
  messaging.ts
  announcements.ts
utils/
  messageHelpers.ts
  dateFormatters.ts
```

---

## API Endpoints

### Conversations
```
GET    /api/coach/conversations
GET    /api/coach/conversations/:clientId
POST   /api/coach/conversations/:clientId/messages
PUT    /api/coach/conversations/:clientId/read
```

### Messages
```
GET    /api/coach/messages/:conversationId?limit=50&before=timestamp
POST   /api/coach/messages/:conversationId
DELETE /api/coach/messages/:messageId
```

### Announcements
```
GET    /api/coach/announcements
GET    /api/coach/announcements/:id
POST   /api/coach/announcements
PUT    /api/coach/announcements/:id
DELETE /api/coach/announcements/:id
PUT    /api/coach/announcements/:id/pin
```

### Real-time (WebSocket)
```
ws://api/coach/messages/subscribe
Events: new_message, typing, read_receipt, online_status
```
