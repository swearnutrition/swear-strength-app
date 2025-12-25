'use client'

import { useState } from 'react'
import { InviteClientModal } from './InviteClientModal'
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
  expires_at: string
  created_at: string
}

interface ClientsTableProps {
  clients: Client[]
  workoutsByUser: Record<string, string[]>
  pendingInvites: Invite[]
}

export function ClientsTable({ clients, workoutsByUser, pendingInvites }: ClientsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [inviteModalOpen, setInviteModalOpen] = useState(false)

  const filteredClients = clients.filter(
    (client) =>
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
          <h3 className="text-amber-600 dark:text-amber-400 font-medium mb-2">Pending Invites ({pendingInvites.length})</h3>
          <div className="space-y-2">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 dark:text-slate-300">{invite.email}</span>
                <span className="text-slate-500">
                  Expires {new Date(invite.expires_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="col-span-3">Client</div>
          <div className="col-span-4">Program</div>
          <div className="col-span-3">Last 7 Days</div>
          <div className="col-span-2 text-right">Status</div>
        </div>

        {/* Table Body */}
        {filteredClients.length === 0 ? (
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
            {filteredClients.map((client) => {
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
                  {/* Client */}
                  <div className="col-span-3 flex items-center gap-3">
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
    </>
  )
}
