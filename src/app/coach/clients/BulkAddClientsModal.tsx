'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ClientType } from '@/lib/supabase/types'

interface ParsedClient {
  email: string
  name: string
  clientType: ClientType
  valid: boolean
  error?: string
}

interface BulkAddClientsModalProps {
  onClose: () => void
}

const CLIENT_TYPES: ClientType[] = ['online', 'training', 'hybrid']

function parseClientLine(line: string, lineNum: number): ParsedClient {
  const parts = line.split(',').map(p => p.trim())

  if (parts.length < 3) {
    return {
      email: parts[0] || '',
      name: parts[1] || '',
      clientType: 'online',
      valid: false,
      error: `Line ${lineNum}: Missing fields (need email, name, type)`,
    }
  }

  const [email, name, typeStr] = parts
  const clientType = typeStr.toLowerCase() as ClientType

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return { email, name, clientType, valid: false, error: `Line ${lineNum}: Invalid email` }
  }

  // Validate name
  if (!name || name.length < 1) {
    return { email, name, clientType, valid: false, error: `Line ${lineNum}: Name required` }
  }

  // Validate client type
  if (!CLIENT_TYPES.includes(clientType)) {
    return {
      email, name, clientType: 'online', valid: false,
      error: `Line ${lineNum}: Invalid type (use online, training, or hybrid)`
    }
  }

  return { email, name, clientType, valid: true }
}

export function BulkAddClientsModal({ onClose }: BulkAddClientsModalProps) {
  const [input, setInput] = useState('')
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null)
  const router = useRouter()

  const handlePreview = () => {
    setError(null)
    const lines = input.split('\n').filter(l => l.trim())

    if (lines.length === 0) {
      setError('Please enter at least one client')
      return
    }

    const parsed = lines.map((line, i) => parseClientLine(line, i + 1))
    setParsedClients(parsed)
    setShowPreview(true)
  }

  const handleCreate = async () => {
    const validClients = parsedClients.filter(c => c.valid)

    if (validClients.length === 0) {
      setError('No valid clients to create')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/invites/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invites: validClients.map(c => ({
            email: c.email,
            name: c.name,
            clientType: c.clientType,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create clients')
      }

      setResult({
        created: data.created,
        skipped: data.skippedEmails || [],
      })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create clients')
    } finally {
      setCreating(false)
    }
  }

  const validCount = parsedClients.filter(c => c.valid).length
  const invalidCount = parsedClients.filter(c => !c.valid).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Bulk Add Clients</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {result ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Created {result.created} Pending Clients
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                You can now book sessions for these clients. Send invite emails when you&apos;re ready.
              </p>
              {result.skipped.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-500/10 rounded-xl p-4 text-left mb-4">
                  <p className="text-amber-600 dark:text-amber-400 font-medium text-sm mb-1">
                    {result.skipped.length} emails skipped (already exist):
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm">
                    {result.skipped.join(', ')}
                  </p>
                </div>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all"
              >
                Done
              </button>
            </div>
          ) : !showPreview ? (
            /* Input State */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Paste client list
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  One client per line: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">email, name, type</code>
                  <br />
                  Type can be: online, training, or hybrid
                </p>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="john@example.com, John Smith, training&#10;jane@example.com, Jane Doe, online&#10;mike@example.com, Mike Johnson, hybrid"
                  rows={10}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-mono text-sm"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!input.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Preview
                </button>
              </div>
            </div>
          ) : (
            /* Preview State */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {validCount > 0 && (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                      {validCount} valid
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-medium">
                      {invalidCount} invalid
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Edit list
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Email</th>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Name</th>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Type</th>
                      <th className="px-4 py-2 text-left text-slate-600 dark:text-slate-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {parsedClients.map((client, i) => (
                      <tr key={i} className={client.valid ? '' : 'bg-red-50 dark:bg-red-500/5'}>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{client.email}</td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white">{client.name}</td>
                        <td className="px-4 py-2 text-slate-900 dark:text-white capitalize">{client.clientType}</td>
                        <td className="px-4 py-2">
                          {client.valid ? (
                            <span className="text-emerald-600 dark:text-emerald-400">Valid</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">{client.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || validCount === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : `Create ${validCount} Clients`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
