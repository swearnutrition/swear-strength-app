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
