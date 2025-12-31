'use client'

import { useMessages } from '@/hooks/useMessages'
import { MessageThread } from '@/components/messaging/MessageThread'
import { MessageInput } from '@/components/messaging/MessageInput'
import type { SendMessagePayload } from '@/types/messaging'

interface ClientMessagesClientProps {
  userId: string
  userName: string
  conversationId: string | null
}

export function ClientMessagesClient({ userId, userName, conversationId }: ClientMessagesClientProps) {
  const { messages, loading, sendMessage, deleteMessage } = useMessages(conversationId)

  const handleSendMessage = async (payload: SendMessagePayload) => {
    await sendMessage(payload)
  }

  if (!conversationId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-medium">No conversation yet</p>
          <p className="text-sm mt-1">Your coach will start a conversation with you soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <h1 className="text-lg font-semibold text-white">Messages</h1>
        <p className="text-sm text-slate-400">Chat with your coach</p>
      </div>

      {/* Messages */}
      <div className="flex-1 flex flex-col">
        {loading ? (
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
            isCoach={false}
          />
        )}

        {/* Input */}
        <MessageInput
          conversationId={conversationId}
          onSend={handleSendMessage}
        />
      </div>
    </div>
  )
}
