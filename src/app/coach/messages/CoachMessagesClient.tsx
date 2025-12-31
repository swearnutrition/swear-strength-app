'use client'

import { useState } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { ConversationList } from '@/components/messaging/ConversationList'
import { MessageThread } from '@/components/messaging/MessageThread'
import { MessageInput } from '@/components/messaging/MessageInput'
import { Avatar } from '@/components/ui/Avatar'
import type { SendMessagePayload } from '@/types/messaging'

interface CoachMessagesClientProps {
  userId: string
  userName: string
}

export function CoachMessagesClient({ userId, userName }: CoachMessagesClientProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const { conversations, loading: conversationsLoading } = useConversations()
  const { messages, loading: messagesLoading, sendMessage, deleteMessage, markAsRead } = useMessages(selectedConversationId)

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  const handleSendMessage = async (payload: SendMessagePayload) => {
    await sendMessage(payload)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversations sidebar */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-semibold text-white">Messages</h1>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          loading={conversationsLoading}
        />
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-800">
              <Avatar
                name={selectedConversation.clientName}
                src={selectedConversation.clientAvatar}
                size="md"
              />
              <div>
                <h2 className="font-semibold text-white">{selectedConversation.clientName}</h2>
              </div>
            </div>

            {/* Messages */}
            {messagesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <MessageThread
                messages={messages}
                currentUserId={userId}
                onDeleteMessage={deleteMessage}
                onMarkAsRead={markAsRead}
                isCoach={true}
              />
            )}

            {/* Input */}
            <MessageInput
              conversationId={selectedConversation.id}
              onSend={handleSendMessage}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose a client to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
