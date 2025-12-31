'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { CreateAnnouncementPayload } from '@/types/messaging'

interface Client {
  id: string
  name: string
  avatar_url: string | null
}

interface AnnouncementComposerProps {
  onSubmit: (payload: CreateAnnouncementPayload) => Promise<void>
  onCancel: () => void
}

export function AnnouncementComposer({ onSubmit, onCancel }: AnnouncementComposerProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [sendPush, setSendPush] = useState(true)
  const [targetType, setTargetType] = useState<'all' | 'selected'>('all')
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingClients, setLoadingClients] = useState(false)

  // Fetch clients when targeting selected
  useEffect(() => {
    if (targetType === 'selected') {
      setLoadingClients(true)
      fetch('/api/coach/clients')
        .then((res) => res.json())
        .then((data) => {
          setClients(data.clients || [])
        })
        .catch(console.error)
        .finally(() => setLoadingClients(false))
    }
  }, [targetType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setLoading(true)
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        isPinned,
        sendPush,
        targetType,
        selectedClientIds: targetType === 'selected' ? selectedClientIds : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const isValid = title.trim() && content.trim() && (targetType === 'all' || selectedClientIds.length > 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Announcement title..."
        required
      />

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Message</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your announcement..."
          rows={4}
          required
          className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
        />
      </div>

      {/* Target selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Send to</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setTargetType('all')}
            className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
              targetType === 'all'
                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            All Clients
          </button>
          <button
            type="button"
            onClick={() => setTargetType('selected')}
            className={`flex-1 py-2 px-4 rounded-lg border transition-all ${
              targetType === 'selected'
                ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                : 'border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            Select Clients
          </button>
        </div>
      </div>

      {/* Client selection */}
      {targetType === 'selected' && (
        <div className="space-y-2">
          {loadingClients ? (
            <div className="text-center py-4 text-slate-500">Loading clients...</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-4 text-slate-500">No clients found</div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-700 rounded-lg p-2">
              {clients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => toggleClient(client.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${
                    selectedClientIds.includes(client.id)
                      ? 'bg-purple-500/20 text-white'
                      : 'hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold">
                    {client.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="flex-1 text-left">{client.name}</span>
                  {selectedClientIds.includes(client.id) && (
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="text-xs text-slate-500">
            {selectedClientIds.length} client{selectedClientIds.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}

      {/* Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
          />
          <span className="text-sm text-slate-300">Pin to top</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendPush}
            onChange={(e) => setSendPush(e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500/50"
          />
          <span className="text-sm text-slate-300">Send push notification</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || loading} loading={loading}>
          Send Announcement
        </Button>
      </div>
    </form>
  )
}
