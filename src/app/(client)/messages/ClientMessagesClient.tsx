'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useMessages } from '@/hooks/useMessages'
import { MessageThread } from '@/components/messaging/MessageThread'
import { MessageInput } from '@/components/messaging/MessageInput'
import type { SendMessagePayload } from '@/types/messaging'

interface ClientMessagesClientProps {
  userId: string
  userName: string
  conversationId: string | null
  hasGroupChats?: boolean
}

interface Announcement {
  id: string
  recipientId: string
  title: string
  content: string
  isPinned: boolean
  createdAt: string
  readAt: string | null
}

type TabType = 'announcements' | 'coach' | 'group'

export function ClientMessagesClient({ userId, userName, conversationId, hasGroupChats = false }: ClientMessagesClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('coach')
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [announcementsLoading, setAnnouncementsLoading] = useState(true)
  const { messages, loading, sendMessage, deleteMessage } = useMessages(conversationId)

  // Fetch announcements
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements')
        if (res.ok) {
          const data = await res.json()
          setAnnouncements(data.announcements || [])
        }
      } catch (err) {
        console.error('Failed to fetch announcements:', err)
      }
      setAnnouncementsLoading(false)
    }
    fetchAnnouncements()
  }, [])

  const handleSendMessage = async (payload: SendMessagePayload) => {
    await sendMessage(payload)
  }

  // Mark announcement as read
  const markAnnouncementRead = async (recipientId: string) => {
    try {
      await fetch(`/api/announcements/${recipientId}/read`, { method: 'POST' })
      setAnnouncements(prev =>
        prev.map(a => a.recipientId === recipientId ? { ...a, readAt: new Date().toISOString() } : a)
      )
    } catch (err) {
      console.error('Failed to mark announcement read:', err)
    }
  }

  const unreadAnnouncementsCount = announcements.filter(a => !a.readAt).length

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">Messages</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('announcements')}
            className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'announcements'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Announcements
            {unreadAnnouncementsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadAnnouncementsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('coach')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'coach'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Coach
          </button>
          {hasGroupChats && (
            <button
              onClick={() => setActiveTab('group')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'group'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Group
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col">
        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <div className="flex-1 overflow-y-auto p-4">
            {announcementsLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                <svg className="w-16 h-16 mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
                <p className="text-lg font-medium">No announcements</p>
                <p className="text-sm mt-1">Your coach hasn&apos;t posted any announcements yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    onClick={() => !announcement.readAt && markAnnouncementRead(announcement.recipientId)}
                    className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                      announcement.readAt
                        ? 'bg-slate-900/50 border-slate-800'
                        : 'bg-purple-900/20 border-purple-500/30 hover:bg-purple-900/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${announcement.isPinned ? 'bg-amber-500/20' : 'bg-purple-500/20'}`}>
                        {announcement.isPinned ? (
                          <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">{announcement.title}</h3>
                          {!announcement.readAt && (
                            <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">New</span>
                          )}
                          {announcement.isPinned && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">Pinned</span>
                          )}
                        </div>
                        <p className="text-slate-300 text-sm whitespace-pre-wrap">{announcement.content}</p>
                        <p className="text-slate-500 text-xs mt-2">
                          {new Date(announcement.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Coach Tab */}
        {activeTab === 'coach' && (
          <>
            {!conversationId ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center text-slate-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-lg font-medium">No conversation yet</p>
                  <p className="text-sm mt-1">Your coach will start a conversation with you soon!</p>
                </div>
              </div>
            ) : loading ? (
              <div className="flex-1 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <>
                <MessageThread
                  messages={messages}
                  currentUserId={userId}
                  onDeleteMessage={deleteMessage}
                  isCoach={false}
                />
                <MessageInput
                  conversationId={conversationId}
                  onSend={handleSendMessage}
                />
              </>
            )}
          </>
        )}

        {/* Group Tab */}
        {activeTab === 'group' && hasGroupChats && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-slate-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-lg font-medium">Group Chats</p>
              <p className="text-sm mt-1">Coming soon!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
