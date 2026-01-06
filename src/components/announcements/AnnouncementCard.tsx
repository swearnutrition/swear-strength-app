'use client'

import { useState } from 'react'
import type { Announcement, ClientAnnouncement } from '@/types/messaging'

interface AnnouncementCardProps {
  announcement: Announcement | ClientAnnouncement
  isCoach: boolean
  onDelete?: (id: string) => void
  onMarkAsRead?: (id: string) => void
  onArchive?: (id: string) => void
  onUnarchive?: (id: string) => void
}

export function AnnouncementCard({ announcement, isCoach, onDelete, onMarkAsRead, onArchive, onUnarchive }: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isRead = 'readAt' in announcement ? !!announcement.readAt : true
  const isPinned = announcement.isPinned

  const handleClick = () => {
    setExpanded(!expanded)
    if (!isRead && onMarkAsRead && 'readAt' in announcement) {
      onMarkAsRead(announcement.id)
    }
  }

  return (
    <div
      className={`
        rounded-xl border transition-all cursor-pointer
        ${isPinned ? 'border-purple-500/50 bg-purple-500/5' : 'border-slate-800 bg-slate-900/50'}
        ${!isRead ? 'ring-2 ring-purple-500/30' : ''}
        hover:bg-slate-800/50
      `}
      onClick={handleClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {isPinned && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                Pinned
              </span>
            )}
            {!isRead && (
              <span className="w-2 h-2 bg-purple-500 rounded-full" />
            )}
          </div>
          <div className="text-xs text-slate-500">
            {formatDate(announcement.createdAt)} at {formatTime(announcement.createdAt)}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold mt-2">{announcement.title}</h3>

        {/* Content preview or full */}
        <p className={`text-slate-400 text-sm mt-2 ${expanded ? '' : 'line-clamp-2'}`}>
          {announcement.content}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
          {isCoach && 'readCount' in announcement && (
            <span className="text-xs text-slate-500">
              {announcement.readCount}/{announcement.totalCount} read
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {expanded && (
              <span className="text-xs text-slate-500">Click to collapse</span>
            )}

            {isCoach && onArchive && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onArchive(announcement.id)
                }}
                className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                title="Archive announcement"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </button>
            )}

            {isCoach && onUnarchive && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onUnarchive(announcement.id)
                }}
                className="p-1 text-slate-500 hover:text-green-400 transition-colors"
                title="Restore announcement"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}

            {isCoach && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(announcement.id)
                }}
                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                title="Delete announcement"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
