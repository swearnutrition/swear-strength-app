'use client'

import { useState } from 'react'
import { InviteClientModal } from './InviteClientModal'
import { BulkAddClientsModal } from './BulkAddClientsModal'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Program {
  id: string
  name: string
}

interface Assignment {
  id: string
  is_active: boolean
  current_week: number
  programs: Program | null
}

interface Client {
  id: string
  name: string
  email: string
  avatar_url: string | null
  created_at: string
  user_program_assignments: Assignment[]
}

interface Invite {
  id: string
  email: string
  name: string | null
  client_type: 'online' | 'training' | 'hybrid' | null
  expires_at: string
  created_at: string
  invite_sent_at: string | null
}

interface ClientsTableProps {
  clients: Client[]
  workoutsByUser: Record<string, string[]>
  pendingInvites: Invite[]
}

export function ClientsTable({ clients, workoutsByUser, pendingInvites }: ClientsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all')
  const [selectedInvites, setSelectedInvites] = useState<Set<string>>(new Set())
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [bulkSending, setBulkSending] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invite?')) return

    setCancellingInvite(inviteId)
    try {
      const { error } = await supabase
        .from('invites')
        .delete()
        .eq('id', inviteId)

      if (error) throw error
      router.refresh()
    } catch (err) {
      console.error('Failed to cancel invite:', err)
      alert('Failed to cancel invite')
    } finally {
      setCancellingInvite(null)
    }
  }

  const handleSendInvite = async (inviteId: string) => {
    setSendingInvite(inviteId)
    try {
      const response = await fetch(`/api/invites/${inviteId}/send`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send invite')
      }

      router.refresh()
    } catch (err) {
      console.error('Failed to send invite:', err)
      alert(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSendingInvite(null)
    }
  }

  const handleBulkSendInvites = async () => {
    if (selectedInvites.size === 0) return

    setBulkSending(true)
    try {
      const response = await fetch('/api/invites/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteIds: Array.from(selectedInvites),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invites')
      }

      alert(`Successfully sent ${data.sent} invite(s)${data.failed > 0 ? `. ${data.failed} failed.` : ''}`)
      setSelectedInvites(new Set())
      router.refresh()
    } catch (err) {
      console.error('Failed to send invites:', err)
      alert(err instanceof Error ? err.message : 'Failed to send invites')
    } finally {
      setBulkSending(false)
    }
  }

  const toggleInviteSelection = (inviteId: string) => {
    setSelectedInvites((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(inviteId)) {
        newSet.delete(inviteId)
      } else {
        newSet.add(inviteId)
      }
      return newSet
    })
  }

  const toggleAllInvites = () => {
    if (selectedInvites.size === pendingInvites.length) {
      setSelectedInvites(new Set())
    } else {
      setSelectedInvites(new Set(pendingInvites.map((i) => i.id)))
    }
  }

  const filteredClients = clients.filter(
    (client) =>
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredPendingInvites = pendingInvites.filter(
    (invite) =>
      invite.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invite.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Apply filter
  const showClients = filter === 'all' || filter === 'active'
  const showPending = filter === 'all' || filter === 'pending'

  // Generate last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - i))
    return {
      date: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      dayNum: date.getDate(),
      isToday: i === 6,
    }
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clients</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Invite and manage your clients</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search clients"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            />
          </div>
          {/* Bulk Add Button */}
          <button
            onClick={() => setBulkModalOpen(true)}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium py-2.5 px-4 rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
            </svg>
            Bulk Add
          </button>
          {/* Add Client Button */}
          <button
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          All ({clients.length + pendingInvites.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'active'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Active ({clients.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'pending'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          Pending ({pendingInvites.length})
        </button>
      </div>

      {/* Bulk Action Bar */}
      {selectedInvites.size > 0 && (
        <div className="mb-4 bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-4 flex items-center justify-between">
          <span className="text-purple-600 dark:text-purple-400 font-medium">
            {selectedInvites.size} invite{selectedInvites.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkSendInvites}
            disabled={bulkSending}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-medium py-2 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {bulkSending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send {selectedInvites.size} Invite{selectedInvites.size !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wider">
          {showPending && pendingInvites.length > 0 && (
            <div className="col-span-1 flex items-center">
              <input
                type="checkbox"
                checked={selectedInvites.size === pendingInvites.length && pendingInvites.length > 0}
                onChange={toggleAllInvites}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
              />
            </div>
          )}
          <div className={showPending && pendingInvites.length > 0 ? 'col-span-2' : 'col-span-3'}>Client</div>
          <div className="col-span-4">Program</div>
          <div className="col-span-3">Last 7 Days</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {/* Table Body */}
        {(showClients && filteredClients.length === 0) && (showPending && filteredPendingInvites.length === 0) ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <p className="text-slate-500 dark:text-slate-400">No clients yet</p>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="mt-4 text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium"
            >
              Invite your first client
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {/* Pending Invites */}
            {showPending && filteredPendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors items-center group"
              >
                {/* Checkbox */}
                <div className="col-span-1 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedInvites.has(invite.id)}
                    onChange={() => toggleInviteSelection(invite.id)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-purple-600 focus:ring-purple-500"
                  />
                </div>

                {/* Client Info */}
                <div className="col-span-2 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-amber-300 dark:from-amber-600 dark:to-amber-700 flex items-center justify-center text-amber-700 dark:text-amber-200 font-medium">
                    {invite.name?.[0]?.toUpperCase() || invite.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900 dark:text-white truncate block">
                      {invite.name || 'Unnamed'}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
                      {invite.email}
                    </span>
                  </div>
                </div>

                {/* Type */}
                <div className="col-span-4">
                  {invite.client_type ? (
                    <span className="capitalize text-slate-600 dark:text-slate-300">
                      {invite.client_type}
                    </span>
                  ) : (
                    <span className="text-slate-500">Not specified</span>
                  )}
                </div>

                {/* Invite Status */}
                <div className="col-span-3">
                  {invite.invite_sent_at ? (
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Sent {formatDate(invite.invite_sent_at)}
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600 dark:text-amber-400">
                      Invite not sent
                    </span>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium">
                    Pending
                  </span>
                  <button
                    onClick={() => handleSendInvite(invite.id)}
                    disabled={sendingInvite === invite.id}
                    className="px-3 py-1 rounded-lg bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingInvite === invite.id ? 'Sending...' : invite.invite_sent_at ? 'Resend' : 'Send Invite'}
                  </button>
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    disabled={cancellingInvite === invite.id}
                    className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                    title="Cancel invite"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Active Clients */}
            {showClients && filteredClients.map((client) => {
              const activeAssignment = client.user_program_assignments?.find((a) => a.is_active)
              const programName = activeAssignment?.programs?.name
              const currentWeek = activeAssignment?.current_week
              const clientWorkouts = workoutsByUser[client.id] || []

              return (
                <Link
                  key={client.id}
                  href={`/coach/clients/${client.id}`}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors items-center group"
                >
                  {/* Checkbox placeholder for alignment when pending invites exist */}
                  {showPending && pendingInvites.length > 0 && (
                    <div className="col-span-1" />
                  )}

                  {/* Client */}
                  <div className={showPending && pendingInvites.length > 0 ? 'col-span-2' : 'col-span-3'} >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-slate-700 dark:text-white font-medium overflow-hidden">
                        {client.avatar_url ? (
                          <img
                            src={client.avatar_url}
                            alt={client.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          client.name?.[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white truncate">{client.name || client.email}</span>
                    </div>
                  </div>

                  {/* Program */}
                  <div className="col-span-4">
                    {programName ? (
                      <div>
                        <p className="text-slate-900 dark:text-white truncate">{programName}</p>
                        {currentWeek && (
                          <p className="text-sm text-slate-500">Week {currentWeek}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500">No program assigned</span>
                    )}
                  </div>

                  {/* Last 7 Days Calendar */}
                  <div className="col-span-3">
                    <div className="flex gap-1">
                      {last7Days.map((day) => {
                        const hasWorkout = clientWorkouts.includes(day.date)
                        return (
                          <div
                            key={day.date}
                            className={`w-8 h-10 rounded-lg flex flex-col items-center justify-center text-xs ${
                              day.isToday
                                ? 'bg-purple-600 text-white'
                                : hasWorkout
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <span className="text-[10px] opacity-70">{day.dayName}</span>
                            <span className="font-semibold">{day.dayNum}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Status & Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                      Active
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        // TODO: Open menu
                      }}
                      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <InviteClientModal onClose={() => setInviteModalOpen(false)} />
      )}

      {/* Bulk Add Modal */}
      {bulkModalOpen && (
        <BulkAddClientsModal onClose={() => setBulkModalOpen(false)} />
      )}
    </>
  )
}
