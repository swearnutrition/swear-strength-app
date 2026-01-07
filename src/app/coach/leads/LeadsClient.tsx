'use client'

import { useState } from 'react'
import type { Lead, LeadStatus } from '@/types/lead'
import { LeadDetailModal } from './LeadDetailModal'

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const statusLabels: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  converted: 'Converted',
  closed: 'Closed',
}

const formatOptions: Record<string, string> = {
  online: 'Online',
  hybrid: 'Hybrid',
  'in-person': 'In-Person',
}

interface LeadsClientProps {
  initialLeads: Lead[]
}

export function LeadsClient({ initialLeads }: LeadsClientProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const filteredLeads = leads.filter((lead) =>
    statusFilter === 'all' || lead.status === statusFilter
  )

  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1
    return acc
  }, {} as Record<LeadStatus, number>)

  const handleLeadUpdate = (updatedLead: Lead) => {
    setLeads((prev) => prev.map((l) => l.id === updatedLead.id ? updatedLead : l))
    setSelectedLead(updatedLead)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Leads</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            {leads.length} total inquiries
          </p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
            statusFilter === 'all'
              ? 'bg-purple-500 text-white'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
          }`}
        >
          All ({leads.length})
        </button>
        {(['new', 'contacted', 'converted', 'closed'] as LeadStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap ${
              statusFilter === status
                ? 'bg-purple-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            {statusLabels[status]} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      {/* Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400">No leads found</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
            Share your links page to start receiving inquiries
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Name</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Format</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 dark:text-white">{lead.name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.email}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {formatOptions[lead.trainingFormat] || lead.trainingFormat}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[lead.status]}`}>
                        {statusLabels[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
                      {formatDate(lead.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleLeadUpdate}
        />
      )}
    </div>
  )
}
