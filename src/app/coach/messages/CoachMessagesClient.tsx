'use client'

import { useState, useEffect } from 'react'
import { useConversations } from '@/hooks/useConversations'
import { useMessages } from '@/hooks/useMessages'
import { useGroupChats } from '@/hooks/useGroupChats'
import { useGroupMessages } from '@/hooks/useGroupMessages'
import { ConversationList } from '@/components/messaging/ConversationList'
import { MessageThread } from '@/components/messaging/MessageThread'
import { MessageInput } from '@/components/messaging/MessageInput'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SendMessagePayload } from '@/types/messaging'
import type { GroupChat, SendGroupMessagePayload } from '@/types/group-chat'

interface Client {
  id: string
  name: string
  avatar_url: string | null
}

interface CoachMessagesClientProps {
  userId: string
  userName: string
}

type TabType = 'clients' | 'groups'
type ChatType = 'conversation' | 'group'

export function CoachMessagesClient({ userId, userName }: CoachMessagesClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('clients')
  const [selectedChatType, setSelectedChatType] = useState<ChatType | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showNewConversation, setShowNewConversation] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [loadingClients, setLoadingClients] = useState(false)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())

  const { conversations, loading: conversationsLoading, refetch } = useConversations()
  const { messages, loading: messagesLoading, sendMessage, deleteMessage, markAsRead } = useMessages(
    selectedChatType === 'conversation' ? selectedConversationId : null
  )
  const { groupChats, loading: groupsLoading, createGroupChat, refresh: refreshGroups } = useGroupChats()
  const {
    messages: groupMessages,
    loading: groupMessagesLoading,
    sendMessage: sendGroupMessage,
    deleteMessage: deleteGroupMessage
  } = useGroupMessages(selectedChatType === 'group' ? selectedGroupId : null)

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)
  const selectedGroup = groupChats.find((g) => g.id === selectedGroupId)

  // Get clients who don't have a conversation yet
  const clientsWithoutConversation = clients.filter(
    (client) => !conversations.some((conv) => conv.clientId === client.id)
  )

  // Fetch clients when modal opens
  useEffect(() => {
    if (showNewConversation || showNewGroup) {
      setLoadingClients(true)
      fetch('/api/coach/clients')
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch clients: ${res.status}`)
          }
          return res.json()
        })
        .then((data) => {
          setClients(data.clients || [])
        })
        .catch((err) => console.error('Error fetching clients:', err))
        .finally(() => setLoadingClients(false))
    }
  }, [showNewConversation, showNewGroup])

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id)
    setSelectedGroupId(null)
    setSelectedChatType('conversation')
  }

  const handleSelectGroup = (id: string) => {
    setSelectedGroupId(id)
    setSelectedConversationId(null)
    setSelectedChatType('group')
  }

  const handleSendMessage = async (payload: SendMessagePayload) => {
    await sendMessage(payload)
  }

  const handleSendGroupMessage = async (payload: SendMessagePayload) => {
    const groupPayload: SendGroupMessagePayload = {
      content: payload.content,
      contentType: payload.contentType,
      mediaUrl: payload.mediaUrl,
    }
    await sendGroupMessage(groupPayload)
  }

  const handleStartConversation = async (clientId: string) => {
    setCreatingConversation(true)
    try {
      const res = await fetch('/api/messages/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()
      if (res.ok && data.conversation) {
        await refetch()
        setSelectedConversationId(data.conversation.id)
        setSelectedChatType('conversation')
        setShowNewConversation(false)
      } else {
        alert(`Failed to create conversation: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
      alert(`Error creating conversation: ${error}`)
    } finally {
      setCreatingConversation(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Please enter a group name')
      return
    }
    if (selectedClientIds.size === 0) {
      alert('Please select at least one client')
      return
    }

    setCreatingGroup(true)
    try {
      const group = await createGroupChat(
        newGroupName.trim(),
        newGroupDescription.trim() || undefined,
        Array.from(selectedClientIds)
      )
      await refreshGroups()
      setSelectedGroupId(group.id)
      setSelectedChatType('group')
      setActiveTab('groups')
      setShowNewGroup(false)
      setNewGroupName('')
      setNewGroupDescription('')
      setSelectedClientIds(new Set())
    } catch (error) {
      console.error('Error creating group:', error)
      alert(`Error creating group: ${error}`)
    } finally {
      setCreatingGroup(false)
    }
  }

  const toggleClientSelection = (clientId: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  // Transform group messages to match MessageThread format
  const transformedGroupMessages = groupMessages.map(m => ({
    id: m.id,
    senderId: m.senderId,
    senderName: m.senderName || 'Unknown',
    senderAvatar: m.senderAvatar || null,
    senderRole: (m.senderId === userId ? 'coach' : 'client') as 'coach' | 'client',
    content: m.content,
    contentType: m.contentType,
    mediaUrl: m.mediaUrl,
    isDeleted: m.isDeleted,
    readAt: null,
    createdAt: m.createdAt,
  }))

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Sidebar */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
        {/* Header with tabs */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-white">Messages</h1>
            <button
              onClick={() => activeTab === 'clients' ? setShowNewConversation(true) : setShowNewGroup(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title={activeTab === 'clients' ? 'New conversation' : 'New group'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'clients'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Clients
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'groups'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Groups
            </button>
          </div>
        </div>

        {/* List */}
        {activeTab === 'clients' ? (
          <ConversationList
            conversations={conversations}
            selectedId={selectedChatType === 'conversation' ? selectedConversationId : null}
            onSelect={handleSelectConversation}
            loading={conversationsLoading}
          />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {groupsLoading ? (
              <div className="p-4 text-center text-slate-500">Loading groups...</div>
            ) : groupChats.length === 0 ? (
              <div className="p-4 text-center text-slate-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-sm">No group chats yet</p>
                <button
                  onClick={() => setShowNewGroup(true)}
                  className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
                >
                  Create one
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {groupChats.map((group) => (
                  <button
                    key={group.id}
                    onClick={() => handleSelectGroup(group.id)}
                    className={`w-full p-4 text-left transition-colors ${
                      selectedChatType === 'group' && selectedGroupId === group.id
                        ? 'bg-purple-500/10 border-l-2 border-purple-500'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                        {group.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">{group.name}</span>
                          {(group.unreadCount ?? 0) > 0 && (
                            <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
                              {group.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 truncate">
                          {group.lastMessage
                            ? `${group.lastMessage.senderName}: ${group.lastMessage.content || 'Media'}`
                            : `${group.memberCount} members`}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Message area */}
      <div className="flex-1 flex flex-col bg-slate-950">
        {selectedChatType === 'conversation' && selectedConversation ? (
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
        ) : selectedChatType === 'group' && selectedGroup ? (
          <>
            {/* Group header */}
            <div className="flex items-center gap-3 p-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                {selectedGroup.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-semibold text-white">{selectedGroup.name}</h2>
                <p className="text-sm text-slate-400">{selectedGroup.memberCount} members</p>
              </div>
            </div>

            {/* Group Messages */}
            {groupMessagesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : (
              <MessageThread
                messages={transformedGroupMessages}
                currentUserId={userId}
                onDeleteMessage={deleteGroupMessage}
                isCoach={true}
                showSenderName={true}
              />
            )}

            {/* Input */}
            <MessageInput
              conversationId={selectedGroup.id}
              onSend={handleSendGroupMessage}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose a client or group to start messaging</p>
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
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p>No clients found</p>
            </div>
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

      {/* New Group Modal */}
      <Modal
        isOpen={showNewGroup}
        onClose={() => {
          setShowNewGroup(false)
          setNewGroupName('')
          setNewGroupDescription('')
          setSelectedClientIds(new Set())
        }}
        title="Create Group Chat"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Group Name</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description (optional)</label>
            <input
              type="text"
              value={newGroupDescription}
              onChange={(e) => setNewGroupDescription(e.target.value)}
              placeholder="What's this group about?"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Select Members ({selectedClientIds.size} selected)
            </label>
            {loadingClients ? (
              <div className="text-center py-4 text-slate-500">Loading clients...</div>
            ) : clients.length === 0 ? (
              <div className="text-center py-4 text-slate-500">No clients found</div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-1 border border-slate-700 rounded-lg p-2">
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => toggleClientSelection(client.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      selectedClientIds.has(client.id)
                        ? 'bg-purple-500/20 border border-purple-500'
                        : 'hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <Avatar name={client.name} src={client.avatar_url} size="sm" />
                    <span className="text-white text-sm">{client.name}</span>
                    {selectedClientIds.has(client.id) && (
                      <svg className="w-5 h-5 ml-auto text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowNewGroup(false)
                setNewGroupName('')
                setNewGroupDescription('')
                setSelectedClientIds(new Set())
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={creatingGroup || !newGroupName.trim() || selectedClientIds.size === 0}
              className="flex-1"
            >
              {creatingGroup ? 'Creating...' : 'Create Group'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
