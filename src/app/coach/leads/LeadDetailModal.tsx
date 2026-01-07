'use client'

import { useState } from 'react'
import type { Lead, LeadStatus } from '@/types/lead'

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
]

const formatLabels: Record<string, string> = {
  online: 'Online (independent/busy lifestyle)',
  hybrid: 'Hybrid (see me sometimes, workout on own most of the time)',
  'in-person': 'Fully in-person',
}

interface LeadDetailModalProps {
  lead: Lead
  onClose: () => void
  onUpdate: (lead: Lead) => void
}

export function LeadDetailModal({ lead, onClose, onUpdate }: LeadDetailModalProps) {
  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [notes, setNotes] = useState(lead.notes || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChanges = status !== lead.status || notes !== (lead.notes || '')

  const handleSave = async () => {
    if (!hasChanges) return

    setError(null)
    setIsSaving(true)
    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes: notes || null }),
      })

      if (!response.ok) {
        throw new Error('Failed to update')
      }

      const { lead: updatedLead } = await response.json()
      onUpdate(updatedLead)
    } catch (error) {
      console.error('Error updating lead:', error)
      setError('Failed to save changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{lead.name}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{formatDate(lead.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
              <a
                href={`mailto:${lead.email}`}
                className="text-purple-600 dark:text-purple-400 hover:underline"
              >
                {lead.email}
              </a>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Phone</label>
              {lead.phone ? (
                <a href={`tel:${lead.phone}`} className="text-purple-600 dark:text-purple-400 hover:underline">
                  {lead.phone}
                </a>
              ) : (
                <span className="text-slate-400">Not provided</span>
              )}
            </div>
          </div>

          {/* Training Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Experience</label>
              <p className="text-slate-900 dark:text-white">{lead.trainingExperience}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Format</label>
              <p className="text-slate-900 dark:text-white">{formatLabels[lead.trainingFormat]}</p>
            </div>
          </div>

          {/* Goals */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Goals</label>
            <div className="flex flex-wrap gap-2">
              {lead.goals.map((goal) => (
                <span
                  key={goal}
                  className="px-3 py-1 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 text-sm"
                >
                  {goal}
                </span>
              ))}
            </div>
          </div>

          {/* Current Situation */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Current Situation</label>
            <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{lead.currentSituation}</p>
          </div>

          {/* Anything Else */}
          {lead.anythingElse && (
            <div>
              <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Additional Info</label>
              <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{lead.anythingElse}</p>
            </div>
          )}

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Notes (internal)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes about this lead..."
              className="w-full px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-4">
          {error && (
            <p className="text-sm text-red-400 mb-3">{error}</p>
          )}
          <div className="flex items-center justify-between">
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </a>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
