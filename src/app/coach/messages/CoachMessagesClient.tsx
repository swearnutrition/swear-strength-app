'use client'

import { useState, useEffect } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { ConversationList } from '@/components/messaging/ConversationList'
import { MessageThread } from '@/components/messaging/MessageThread'
import { MessageInput } from '@/components/messaging/MessageInput'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SendMessagePayload } from '@/types/messaging'

interface Client {
  id: string
  name: string
  avatar_url: string | null
}

interface CoachMessagesClientProps {
  userId: string
  userName: string
}

export function CoachMessagesClient({ userId, userName }: CoachMessagesClientProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const { conversations, loading: conversationsLoading, refetch } = useConversations()
  const { messages, loading: messagesLoading, sendMessage, deleteMessage, markAsRead } = useMessages(selectedConversationId)

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)

  // Get clients who don't have a conversation yet
  const clientsWithoutConversation = clients.filter(
    (client) => !conversations.some((conv) => conv.clientId === client.id)
  )

  // Fetch clients when modal opens
  useEffect(() => {
    if (showNewConversation) {
      setLoadingClients(true)
      fetch('/api/coach/clients')
        .then((res) => res.json())
        .then((data) => setClients(data.clients || []))
        .catch(console.error)
        .finally(() => setLoadingClients(false))
    }
  }, [showNewConversation])

  const handleSendMessage = async (payload: SendMessagePayload) => {
    await sendMessage(payload)
  }

  const handleStartConversation = async (clientId: string) => {
    setCreatingConversation(true)
    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (res.ok) {
        const data = await res.json()
        await refetch()
        setSelectedConversationId(data.conversation.id)
        setShowNewConversation(false)
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
    } finally {
      setCreatingConversation(false)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversations sidebar */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Messages</h1>
          <button
            onClick={() => setShowNewConversation(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="New conversation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
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

      {/* New Conversation Modal */}
      <Modal
        isOpen={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        title="Start New Conversation"
      >
        <div className="space-y-2">
          {loadingClients ? (
            <div className="text-center py-8 text-slate-500">Loading clients...</div>
          ) : clientsWithoutConversation.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>All clients already have conversations</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-1">
              {clientsWithoutConversation.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleStartConversation(client.id)}
                  disabled={creatingConversation}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <Avatar name={client.name} src={client.avatar_url} size="md" />
                  <span className="text-white font-medium">{client.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
