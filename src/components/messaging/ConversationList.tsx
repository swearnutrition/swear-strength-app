'use client'

import { Avatar } from '@/components/ui/Avatar'
import type { Conversation } from '@/types/messaging'

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (conversationId: string) => void
  loading?: boolean
}

export function ConversationList({ conversations, selectedId, onSelect, loading }: ConversationListProps) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const getMessagePreview = (conversation: Conversation) => {
    if (!conversation.lastMessage) return 'No messages yet'

    const { contentType, content } = conversation.lastMessage

    switch (contentType) {
      case 'image':
        return '📷 Photo'
      case 'video':
        return '🎥 Video'
      case 'gif':
        return 'GIF'
      default:
        return content || 'Message'
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800 rounded w-24" />
              <div className="h-3 bg-slate-800 rounded w-32" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 p-8">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">No conversations yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${
            selectedId === conversation.id
              ? 'bg-purple-500/10 border-l-2 border-purple-500'
              : 'hover:bg-slate-800/50 border-l-2 border-transparent'
          }`}
        >
          <div className="relative">
            <Avatar name={conversation.clientName} src={conversation.clientAvatar} size="lg" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`font-medium truncate ${
                conversation.unreadCount > 0 ? 'text-white' : 'text-slate-300'
              }`}>
                {conversation.clientName}
              </span>
              <span className="text-xs text-slate-500 flex-shrink-0">
                {conversation.lastMessageAt ? formatTime(conversation.lastMessageAt) : ''}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className={`text-sm truncate ${
                conversation.unreadCount > 0 ? 'text-slate-300' : 'text-slate-500'
              }`}>
                {getMessagePreview(conversation)}
              </p>
              {conversation.unreadCount > 0 && (
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-purple-500 text-white text-xs font-bold rounded-full">
                  {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
