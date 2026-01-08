'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HabitTemplate, categoryLabels, categoryColors } from './HabitsClient'

interface Client {
  id: string
  name: string
  email: string
  avatar_url: string | null
  isPending?: boolean
}

interface AssignHabitModalProps {
  isOpen: boolean
  onClose: () => void
  habits: HabitTemplate[]
  onSuccess: () => void
}

type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'times_per_week' | 'specific_days' | 'biweekly'

const frequencyLabels: Record<HabitFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  times_per_week: 'Times/Week',
  specific_days: 'Specific Days',
  biweekly: 'Biweekly',
}

const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function AssignHabitModal({ isOpen, onClose, habits, onSuccess }: AssignHabitModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // Frequency settings (applied to all habits being assigned)
  const [frequency, setFrequency] = useState<HabitFrequency>('daily')
  const [timesPerWeek, setTimesPerWeek] = useState(3)
  const [specificDays, setSpecificDays] = useState<number[]>([1, 3, 5]) // Mon, Wed, Fri

  const supabase = createClient()

  useEffect(() => {
    if (isOpen && habits.length > 0) {
      fetchClients()
    }
  }, [isOpen, habits])

  const fetchClients = async () => {
    setLoading(true)
    try {
      // Use API endpoint that includes pending clients
      const res = await fetch('/api/coach/clients')
      const data = await res.json()
      if (data.clients) {
        setClients(data.clients.map((c: { id: string; name: string; email: string; avatar_url: string | null; isPending?: boolean }) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          avatar_url: c.avatar_url,
          isPending: c.isPending,
        })))
      }
    } catch (err) {
      console.error('Error fetching clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleClient = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    )
  }

  const toggleDay = (day: number) => {
    setSpecificDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const selectAll = () => {
    setSelectedClients(clients.map(c => c.id))
  }

  const clearAll = () => {
    setSelectedClients([])
  }

  const handleAssign = async () => {
    if (habits.length === 0 || selectedClients.length === 0) return

    setAssigning(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      // Create assignments for each habit x client combination
      // Support both confirmed clients (client_id) and pending clients (invite_id)
      const assignments = []
      for (const habit of habits) {
        for (const selectedId of selectedClients) {
          const isPending = selectedId.startsWith('pending:')
          const actualId = isPending ? selectedId.replace('pending:', '') : selectedId

          assignments.push({
            client_id: isPending ? null : actualId,
            invite_id: isPending ? actualId : null,
            habit_template_id: habit.id,
            coach_id: userData.user.id,
            start_date: startDate,
            notes: notes.trim() || null,
            custom_frequency: frequency,
            custom_times_per_week: frequency === 'times_per_week' ? timesPerWeek : null,
            custom_specific_days: frequency === 'specific_days' ? specificDays : null,
          })
        }
      }

      const { error } = await supabase
        .from('client_habits')
        .insert(assignments)

      if (error) throw error

      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Error assigning habits:', err)
      alert('Failed to assign habits: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setAssigning(false)
    }
  }

  const handleClose = () => {
    setSelectedClients([])
    setSearchQuery('')
    setNotes('')
    setStartDate(new Date().toISOString().split('T')[0])
    setFrequency('daily')
    setTimesPerWeek(3)
    setSpecificDays([1, 3, 5])
    onClose()
  }

  if (!isOpen || habits.length === 0) return null

  const filteredClients = clients.filter(
    client =>
      client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Assign Habits to Clients</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Habits being assigned */}
          <div className="mt-3 flex flex-wrap gap-2">
            {habits.map(habit => (
              <div key={habit.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {habit.category && (
                  <span className={`w-2 h-2 rounded-full ${categoryColors[habit.category].split(' ')[0]}`} />
                )}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{habit.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Frequency Settings */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Frequency
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['daily', 'weekly', 'times_per_week', 'specific_days'] as HabitFrequency[]).map(freq => (
                <button
                  key={freq}
                  onClick={() => setFrequency(freq)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    frequency === freq
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {frequencyLabels[freq]}
                </button>
              ))}
            </div>

            {/* Times per week slider */}
            {frequency === 'times_per_week' && (
              <div className="flex items-center gap-4 mt-3">
                <input
                  type="range"
                  min="1"
                  max="7"
                  value={timesPerWeek}
                  onChange={(e) => setTimesPerWeek(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-semibold text-slate-900 dark:text-white w-16 text-center">
                  {timesPerWeek}x/week
                </span>
              </div>
            )}

            {/* Day selector */}
            {frequency === 'specific_days' && (
              <div className="flex gap-2 mt-3">
                {dayLabels.map((label, index) => (
                  <button
                    key={index}
                    onClick={() => toggleDay(index)}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${
                      specificDays.includes(index)
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Select Clients
            </label>

            {/* Search */}
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {/* Selection controls */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500">
                {selectedClients.length} of {filteredClients.length} selected
              </span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
                  Select all
                </button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button onClick={clearAll} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  Clear
                </button>
              </div>
            </div>

            {/* Client list */}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-slate-500 mt-2">Loading clients...</p>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No clients found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredClients.map(client => {
                  const isSelected = selectedClients.includes(client.id)

                  return (
                    <button
                      key={client.id}
                      onClick={() => toggleClient(client.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-purple-50 dark:bg-purple-500/10 border-2 border-purple-500'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-transparent'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-600 dark:to-slate-700 flex items-center justify-center text-slate-700 dark:text-white font-medium text-sm overflow-hidden flex-shrink-0">
                        {client.avatar_url ? (
                          <img src={client.avatar_url} alt={client.name} className="w-full h-full object-cover" />
                        ) : (
                          client.name?.[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {client.name || client.email}
                          {client.isPending && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                              Pending
                            </span>
                          )}
                        </p>
                        {client.name && (
                          <p className="text-sm text-slate-500 truncate">{client.email}</p>
                        )}
                      </div>
                      {isSelected ? (
                        <svg className="w-5 h-5 text-purple-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 flex-shrink-0"></div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Additional options */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Notes for clients (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions or context..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={selectedClients.length === 0 || assigning}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {assigning ? 'Assigning...' : `Assign ${habits.length} Habit${habits.length !== 1 ? 's' : ''} to ${selectedClients.length} Client${selectedClients.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
