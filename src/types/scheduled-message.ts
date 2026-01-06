export type ScheduledMessageType = 'dm' | 'mass_dm' | 'announcement' | 'group_chat'
export type ScheduledMessageStatus = 'pending' | 'sent' | 'cancelled' | 'failed'
export type ScheduledContentType = 'text' | 'image' | 'gif' | 'video'

export interface ScheduledMessage {
  id: string
  coachId: string
  messageType: ScheduledMessageType
  content: string
  contentType: ScheduledContentType
  mediaUrl: string | null
  conversationId: string | null
  recipientIds: string[] | null
  groupChatId: string | null
  scheduledFor: string
  status: ScheduledMessageStatus
  sentAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  // Joined data for display
  recipientNames?: string[]
  conversationClientName?: string
  groupChatName?: string
}

export interface CreateScheduledMessagePayload {
  messageType: ScheduledMessageType
  content: string
  contentType?: ScheduledContentType
  mediaUrl?: string
  conversationId?: string
  recipientIds?: string[]
  groupChatId?: string
  scheduledFor: string
}

export interface UpdateScheduledMessagePayload {
  content?: string
  contentType?: ScheduledContentType
  mediaUrl?: string
  scheduledFor?: string
}
