'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ScheduleModal } from './ScheduleModal'
import { TemplateDropdown } from '@/components/messaging/TemplateDropdown'
import { ManageTemplatesModal } from '@/components/messaging/ManageTemplatesModal'
import { useMessageTemplates } from '@/hooks/useMessageTemplates'

interface Client {
  id: string
  name: string
  avatar_url: string | null
  isPending?: boolean
}

interface BroadcastModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (recipientIds: string[], content: string, scheduledFor?: string) => Promise<void>
}

export function BroadcastModal({
  isOpen,
  onClose,
  onSend,
}: BroadcastModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showManageTemplates, setShowManageTemplates] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const supabase = createClient()
  const {
    templates,
    loading: templatesLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useMessageTemplates()

  useEffect(() => {
    if (isOpen) {
      fetchClients()
    }
  }, [isOpen])

  const fetchClients = async () => {
    setLoading(true)
    try {
      // Use API endpoint that includes pending clients
      const res = await fetch('/api/coach/clients')
      const data = await res.json()
      if (data.clients) {
        setClients(data.clients.map((c: { id: string; name: string; avatar_url: string | null; isPending?: boolean }) => ({
          id: c.id,
          name: c.name,
          avatar_url: c.avatar_url,
          isPending: c.isPending,
        })))
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    }
    setLoading(false)
  }

  const toggleClient = (clientId: string) => {
    setSelectedIds(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    )
  }

  const toggleAll = () => {
    if (selectedIds.length === filteredClients.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredClients.map(c => c.id))
    }
  }

  const handleSendNow = async () => {
    if (selectedIds.length === 0 || !content.trim()) return
    setSending(true)
    try {
      await onSend(selectedIds, content.trim())
      resetAndClose()
    } catch (error) {
      console.error('Error sending broadcast:', error)
    } finally {
      setSending(false)
    }
  }

  const handleSchedule = async (scheduledFor: string) => {
    if (selectedIds.length === 0 || !content.trim()) return
    setSending(true)
    try {
      await onSend(selectedIds, content.trim(), scheduledFor)
      resetAndClose()
    } catch (error) {
      console.error('Error scheduling broadcast:', error)
    } finally {
      setSending(false)
    }
  }

  const resetAndClose = () => {
    setSelectedIds([])
    setContent('')
    setSearchQuery('')
    onClose()
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const canSend = selectedIds.length > 0 && content.trim().length > 0

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetAndClose} />
        <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Broadcast Message</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Send to multiple clients as private DMs</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Message input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Message
                </label>
                <TemplateDropdown
                  templates={templates}
                  loading={templatesLoading}
                  onSelect={(templateContent) => setContent(templateContent)}
                  onManage={() => setShowManageTemplates(true)}
                />
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your message... Use {firstname} or {name} for personalization"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Use <code className="text-purple-500">{'{firstname}'}</code> or <code className="text-purple-500">{'{name}'}</code> for personalization
              </p>
            </div>

            {/* Client selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Select Clients ({selectedIds.length} selected)
                </label>
                <button
                  onClick={toggleAll}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  {selectedIds.length === filteredClients.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                />
              </div>

              {/* Client list */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl max-h-48 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                    Loading clients...
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                    No clients found
                  </div>
                ) : (
                  filteredClients.map(client => (
                    <label
                      key={client.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(client.id)}
                        onChange={() => toggleClient(client.id)}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                      />
                      {client.avatar_url ? (
                        <img
                          src={client.avatar_url}
                          alt={client.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {client.name}
                        {client.isPending && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            Pending
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3 flex-shrink-0">
            <button
              onClick={resetAndClose}
              className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={!canSend || sending}
              className="flex-1 px-4 py-3 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Schedule
            </button>
            <button
              onClick={handleSendNow}
              disabled={!canSend || sending}
              className="flex-1 px-4 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleSchedule}
        title="Schedule Broadcast"
      />

      <ManageTemplatesModal
        isOpen={showManageTemplates}
        onClose={() => setShowManageTemplates(false)}
        templates={templates}
        loading={templatesLoading}
        onCreate={createTemplate}
        onUpdate={updateTemplate}
        onDelete={deleteTemplate}
      />
    </>
  )
}
