'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Client {
  id: string
  name: string | null
  email: string | null
}

interface AssignProgramModalProps {
  isOpen: boolean
  onClose: () => void
  programId: string
  programName: string
  programDescription?: string | null
  onSuccess: () => void
}

export function AssignProgramModal({
  isOpen,
  onClose,
  programId,
  programName,
  programDescription,
  onSuccess,
}: AssignProgramModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [notifyClient, setNotifyClient] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchClients()
      fetchAssignments()
    }
  }, [isOpen, programId])

  const fetchClients = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('role', 'client')
      .order('name')

    setClients(data || [])
    setLoading(false)
  }

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('user_program_assignments')
      .select('user_id')
      .eq('program_id', programId)
      .eq('is_active', true)

    setAssignedClientIds(data?.map((a) => a.user_id) || [])
  }

  const handleAssign = async () => {
    if (!selectedClientId) return

    setAssigning(true)

    // Check if already assigned
    const { data: existing } = await supabase
      .from('user_program_assignments')
      .select('id, is_active')
      .eq('program_id', programId)
      .eq('user_id', selectedClientId)
      .single()

    if (existing) {
      // Reactivate if exists but inactive
      if (!existing.is_active) {
        await supabase
          .from('user_program_assignments')
          .update({
            is_active: true,
            start_date: startDate,
            current_week: 1,
            current_day: 1,
          })
          .eq('id', existing.id)
      }
    } else {
      // Create new assignment
      await supabase.from('user_program_assignments').insert({
        program_id: programId,
        user_id: selectedClientId,
        start_date: startDate,
        current_week: 1,
        current_day: 1,
        is_active: true,
      })
    }

    // Get coach info for notifications
    const { data: { user } } = await supabase.auth.getUser()
    const { data: coachProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user?.id)
      .single()

    const coachName = coachProfile?.name || 'Your Coach'

    // Create in-app notification for the client
    await supabase.from('client_notifications').insert({
      user_id: selectedClientId,
      type: 'new_program',
      title: 'New Program Assigned!',
      message: `${coachName} assigned you "${programName}". Tap to set your workout schedule.`,
      program_id: programId,
      data: { coachName, programName }
    })

    // Send notification email if enabled
    if (notifyClient) {
      const client = clients.find(c => c.id === selectedClientId)
      if (client?.email) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: client.email,
              template: 'program-assigned',
              data: {
                coachName,
                programName,
                programDescription: programDescription || '',
                appUrl: window.location.origin,
              },
            },
          })
        } catch (err) {
          console.error('Failed to send notification:', err)
        }
      }
    }

    setAssigning(false)
    setSelectedClientId('')
    onSuccess()
    onClose()
  }

  const handleUnassign = async (clientId: string) => {
    await supabase
      .from('user_program_assignments')
      .update({ is_active: false })
      .eq('program_id', programId)
      .eq('user_id', clientId)

    setAssignedClientIds(assignedClientIds.filter((id) => id !== clientId))
  }

  if (!isOpen) return null

  const availableClients = clients.filter((c) => !assignedClientIds.includes(c.id))
  const assignedClients = clients.filter((c) => assignedClientIds.includes(c.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Assign Program</h2>
              <p className="text-sm text-slate-500 mt-1">{programName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Currently Assigned */}
          {assignedClients.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Currently Assigned ({assignedClients.length})
              </h3>
              <div className="space-y-2">
                {assignedClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-semibold">
                        {client.name?.[0]?.toUpperCase() || client.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {client.name || 'Unnamed'}
                        </p>
                        <p className="text-sm text-slate-500">{client.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnassign(client.id)}
                      className="text-sm text-red-600 hover:text-red-500 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assign New Client */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              Assign to Client
            </h3>

            {loading ? (
              <div className="text-center py-4 text-slate-500">Loading clients...</div>
            ) : availableClients.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">
                  {clients.length === 0
                    ? 'No clients yet. Invite clients from the Clients page.'
                    : 'All clients are already assigned to this program.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Select Client
                  </label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  >
                    <option value="">Choose a client...</option>
                    {availableClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name || client.email || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={notifyClient}
                      onChange={(e) => setNotifyClient(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Send email notification
                  </span>
                </label>

                <button
                  onClick={handleAssign}
                  disabled={!selectedClientId || assigning}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all"
                >
                  {assigning ? 'Assigning...' : 'Assign Program'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
