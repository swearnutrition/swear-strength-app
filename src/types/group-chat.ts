// Group Chat Types

export interface GroupChat {
  id: string
  name: string
  description: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  memberCount?: number
  unreadCount?: number
  lastMessage?: GroupMessage | null
}

export interface GroupChatMember {
  id: string
  groupChatId: string
  userId: string
  role: 'admin' | 'member'
  notificationsEnabled: boolean
  joinedAt: string
  // Populated from join
  name?: string
  avatarUrl?: string | null
}

export interface GroupMessage {
  id: string
  groupChatId: string
  senderId: string
  content: string | null
  contentType: 'text' | 'image' | 'gif' | 'video'
  mediaUrl: string | null
  isDeleted: boolean
  createdAt: string
  // Populated from join
  senderName?: string
  senderAvatar?: string | null
  readBy?: string[]
  isRead?: boolean
}

export interface GroupMessageRead {
  id: string
  messageId: string
  userId: string
  readAt: string
}

export interface CreateGroupChatPayload {
  name: string
  description?: string
  memberIds: string[]
}

export interface SendGroupMessagePayload {
  content?: string
  contentType?: 'text' | 'image' | 'gif' | 'video'
  mediaUrl?: string
}
