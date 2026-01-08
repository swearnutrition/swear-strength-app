'use client'

import { useState, useEffect } from 'react'
import { useSessionPackages } from '@/hooks/useSessionPackages'

interface Client {
  id: string
  name: string
  isPending?: boolean
}

interface CreatePackageModalProps {
  isOpen: boolean
  onClose: () => void
  clients: Client[]
  onSuccess: () => void
}

const SESSION_DURATIONS = [
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
  { value: 90, label: '90 minutes' },
]

export function CreatePackageModal({
  isOpen,
  onClose,
  clients,
  onSuccess,
}: CreatePackageModalProps) {
  const [clientId, setClientId] = useState('')
  const [totalSessions, setTotalSessions] = useState<number>(10)
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(60)
  const [expiresAt, setExpiresAt] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { createPackage } = useSessionPackages()

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setClientId('')
      setTotalSessions(10)
      setSessionDurationMinutes(60)
      setExpiresAt('')
      setNotes('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || totalSessions < 1) return

    setSubmitting(true)
    try {
      const result = await createPackage({
        clientId,
        totalSessions,
        sessionDurationMinutes,
        expiresAt: expiresAt || null,
        notes: notes.trim() || undefined,
      })

      if (result) {
        onSuccess()
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      onClose()
    }
  }

  const canSubmit = clientId && totalSessions >= 1 && !submitting

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create Session Package</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Assign sessions to a client</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Client selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}{client.isPending ? ' (pending)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Total sessions */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Total Sessions <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={totalSessions}
              onChange={(e) => setTotalSessions(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Session duration */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Session Duration <span className="text-red-500">*</span>
            </label>
            <select
              value={sessionDurationMinutes}
              onChange={(e) => setSessionDurationMinutes(parseInt(e.target.value))}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              {SESSION_DURATIONS.map((duration) => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>
          </div>

          {/* Expiration date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Expiration Date <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this package..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 px-4 py-3 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Package
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
