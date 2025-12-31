// Message and conversation types for the messaging system

export interface Message {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  senderRole: 'coach' | 'client'
  content: string | null
  contentType: 'text' | 'image' | 'gif' | 'video'
  mediaUrl: string | null
  isDeleted: boolean
  readAt: string | null
  createdAt: string
}

export interface Conversation {
  id: string
  clientId: string
  clientName: string
  clientAvatar: string | null
  lastMessageAt: string
  lastMessage: {
    content: string | null
    contentType: string
    senderId: string
    createdAt: string
  } | null
  unreadCount: number
}

export interface SendMessagePayload {
  content?: string
  contentType: 'text' | 'image' | 'gif' | 'video'
  mediaUrl?: string
}

// Announcement types

export interface Announcement {
  id: string
  title: string
  content: string
  isPinned: boolean
  sendPush: boolean
  targetType: 'all' | 'selected'
  createdAt: string
  readCount: number
  totalCount: number
}

export interface ClientAnnouncement {
  id: string
  recipientId: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  readAt: string | null
}

export interface CreateAnnouncementPayload {
  title: string
  content: string
  isPinned?: boolean
  sendPush?: boolean
  targetType: 'all' | 'selected'
  selectedClientIds?: string[]
}
