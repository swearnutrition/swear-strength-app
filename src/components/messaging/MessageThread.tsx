'use client'

import { useRef, useEffect } from 'react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '@/types/messaging'

interface MessageThreadProps {
  messages: Message[]
  currentUserId: string
  onDeleteMessage?: (messageId: string) => void
  onMarkAsRead?: (messageId: string) => void
  isCoach: boolean
}

export function MessageThread({
  messages,
  currentUserId,
  onDeleteMessage,
  onMarkAsRead,
  isCoach,
}: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark messages as read when they become visible (coach only sees client messages as read)
  useEffect(() => {
    if (!onMarkAsRead || !isCoach) return

    const unreadMessages = messages.filter(
      (m) => m.senderId !== currentUserId && !m.readAt && !m.isDeleted
    )

    unreadMessages.forEach((m) => {
      onMarkAsRead(m.id)
    })
  }, [messages, currentUserId, onMarkAsRead, isCoach])

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = []
  let currentDate = ''

  messages.forEach((message) => {
    const messageDate = new Date(message.createdAt).toLocaleDateString([], {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })

    if (messageDate !== currentDate) {
      currentDate = messageDate
      groupedMessages.push({ date: messageDate, messages: [message] })
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(message)
    }
  })

  // Check if should show avatar (first message from sender in a sequence)
  const shouldShowAvatar = (messages: Message[], index: number) => {
    if (index === 0) return true
    return messages[index].senderId !== messages[index - 1].senderId
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>No messages yet</p>
          <p className="text-sm mt-1">Start the conversation!</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-slate-800 px-3 py-1 rounded-full text-xs text-slate-400">
              {group.date}
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {group.messages.map((message, index) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.senderId === currentUserId}
                showAvatar={shouldShowAvatar(group.messages, index)}
                onDelete={onDeleteMessage}
              />
            ))}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
