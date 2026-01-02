'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import type { Message } from '@/types/messaging'

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
  showAvatar: boolean
  showSenderName?: boolean
  onDelete?: (messageId: string) => void
}

export function MessageBubble({ message, isOwnMessage, showAvatar, showSenderName = false, onDelete }: MessageBubbleProps) {
  const [showMenu, setShowMenu] = useState(false)

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (message.isDeleted) {
    return (
      <div className={`flex items-end gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
        {showAvatar && !isOwnMessage && (
          <Avatar name={message.senderName} src={message.senderAvatar} size="sm" />
        )}
        {!showAvatar && !isOwnMessage && <div className="w-8" />}
        <div className="px-4 py-2 rounded-2xl bg-slate-800/50 text-slate-500 italic text-sm">
          Message deleted
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex items-end gap-2 group ${isOwnMessage ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {/* Avatar */}
      {showAvatar && !isOwnMessage && (
        <Avatar name={message.senderName} src={message.senderAvatar} size="sm" />
      )}
      {!showAvatar && !isOwnMessage && <div className="w-8" />}

      {/* Message content */}
      <div className="max-w-[70%] relative">
        {/* Sender name for group chats */}
        {showSenderName && !isOwnMessage && (
          <p className="text-xs text-purple-400 mb-1 ml-1 font-medium">{message.senderName}</p>
        )}
        <div
          className={`
            rounded-2xl overflow-hidden
            ${isOwnMessage
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
              : 'bg-slate-800 text-white'
            }
            ${message.contentType === 'text' ? 'px-4 py-2' : 'p-1'}
          `}
        >
          {message.contentType === 'text' && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {message.contentType === 'image' && message.mediaUrl && (
            <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.mediaUrl}
                alt="Image"
                className="max-w-full rounded-xl max-h-64 object-contain"
                loading="lazy"
              />
            </a>
          )}

          {message.contentType === 'gif' && message.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={message.mediaUrl}
              alt="GIF"
              className="max-w-full rounded-xl max-h-64"
              loading="lazy"
            />
          )}

          {message.contentType === 'video' && message.mediaUrl && (
            <video
              src={message.mediaUrl}
              controls
              className="max-w-full rounded-xl max-h-64"
              preload="metadata"
            />
          )}
        </div>

        {/* Time and read status */}
        <div className={`flex items-center gap-1 mt-1 text-xs text-slate-500 ${isOwnMessage ? 'justify-end' : ''}`}>
          <span>{formatTime(message.createdAt)}</span>
          {isOwnMessage && message.readAt && (
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* Delete menu */}
        {isOwnMessage && onDelete && showMenu && (
          <button
            onClick={() => onDelete(message.id)}
            className="absolute -left-8 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete message"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
