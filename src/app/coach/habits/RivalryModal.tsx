'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HabitTemplate, categoryLabels, categoryColors } from './HabitsClient'

interface Client {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

interface RivalryModalProps {
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

export function RivalryModal({ isOpen, onClose, habits, onSuccess }: RivalryModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [challenger, setChallenger] = useState<string | null>(null)
  const [opponent, setOpponent] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [rivalryName, setRivalryName] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [duration, setDuration] = useState(7) // days

  // Frequency settings
  const [frequency, setFrequency] = useState<HabitFrequency>('daily')
  const [timesPerWeek, setTimesPerWeek] = useState(3)
  const [specificDays, setSpecificDays] = useState<number[]>([1, 3, 5])

  const supabase = createClient()

  useEffect(() => {
    if (isOpen && habits.length > 0) {
      fetchClients()
      // Auto-generate rivalry name
      if (habits.length === 1) {
        setRivalryName(`${habits[0].name} Challenge`)
      } else {
        setRivalryName('Habit Challenge')
      }
    }
  }, [isOpen, habits])

  const fetchClients = async () => {
    setLoading(true)
    try {
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('id, name, email, avatar_url')
        .eq('role', 'client')
        .order('name')

      setClients(clientsData || [])
    } catch (err) {
      console.error('Error fetching clients:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleDay = (day: number) => {
    setSpecificDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const handleCreate = async () => {
    if (!challenger || !opponent || habits.length === 0) return

    setCreating(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not authenticated')

      // Calculate end date
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + duration)

      // Create the rivalry
      const { data: rivalry, error: rivalryError } = await supabase
        .from('habit_rivalries')
        .insert({
          name: rivalryName.trim() || 'Habit Challenge',
          coach_id: userData.user.id,
          challenger_id: challenger,
          opponent_id: opponent,
          start_date: startDate,
          end_date: endDate.toISOString().split('T')[0],
          status: 'active',
        })
        .select()
        .single()

      if (rivalryError) throw rivalryError

      // Assign the habits to both clients with the rivalry linked
      const assignments = []
      for (const habit of habits) {
        // For challenger
        assignments.push({
          client_id: challenger,
          habit_template_id: habit.id,
          coach_id: userData.user.id,
          start_date: startDate,
          end_date: endDate.toISOString().split('T')[0],
          custom_frequency: frequency,
          custom_times_per_week: frequency === 'times_per_week' ? timesPerWeek : null,
          custom_specific_days: frequency === 'specific_days' ? specificDays : null,
          rivalry_id: rivalry.id,
        })
        // For opponent
        assignments.push({
          client_id: opponent,
          habit_template_id: habit.id,
          coach_id: userData.user.id,
          start_date: startDate,
          end_date: endDate.toISOString().split('T')[0],
          custom_frequency: frequency,
          custom_times_per_week: frequency === 'times_per_week' ? timesPerWeek : null,
          custom_specific_days: frequency === 'specific_days' ? specificDays : null,
          rivalry_id: rivalry.id,
        })
      }

      const { error: assignError } = await supabase
        .from('client_habits')
        .insert(assignments)

      if (assignError) throw assignError

      onSuccess()
      handleClose()
    } catch (err) {
      console.error('Error creating rivalry:', err)
      alert('Failed to create rivalry: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setChallenger(null)
    setOpponent(null)
    setSearchQuery('')
    setRivalryName('')
    setStartDate(new Date().toISOString().split('T')[0])
    setDuration(7)
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

  const challengerClient = clients.find(c => c.id === challenger)
  const opponentClient = clients.find(c => c.id === opponent)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Habit Rivalry</h2>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Habits in rivalry */}
          <div className="mt-3 flex flex-wrap gap-2">
            {habits.map(habit => (
              <div key={habit.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg">
                {habit.category && (
                  <span className={`w-2 h-2 rounded-full ${categoryColors[habit.category].split(' ')[0]}`} />
                )}
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">{habit.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Rivalry Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Challenge Name
            </label>
            <input
              type="text"
              value={rivalryName}
              onChange={(e) => setRivalryName(e.target.value)}
              placeholder="e.g., 7-Day Water Challenge"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {/* Rivals Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Select Rivals
            </label>

            {/* VS Display */}
            <div className="flex items-center justify-center gap-4 mb-4">
              {/* Challenger */}
              <div
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  challenger
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                    : 'border-dashed border-slate-300 dark:border-slate-700'
                }`}
              >
                {challengerClient ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                      {challengerClient.avatar_url ? (
                        <img src={challengerClient.avatar_url} alt={challengerClient.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        challengerClient.name?.[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{challengerClient.name || challengerClient.email}</p>
                      <p className="text-xs text-slate-500">Challenger</p>
                    </div>
                    <button
                      onClick={() => setChallenger(null)}
                      className="ml-auto text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-400 text-sm">Select challenger</p>
                  </div>
                )}
              </div>

              {/* VS Badge */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                VS
              </div>

              {/* Opponent */}
              <div
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  opponent
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10'
                    : 'border-dashed border-slate-300 dark:border-slate-700'
                }`}
              >
                {opponentClient ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-semibold">
                      {opponentClient.avatar_url ? (
                        <img src={opponentClient.avatar_url} alt={opponentClient.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        opponentClient.name?.[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{opponentClient.name || opponentClient.email}</p>
                      <p className="text-xs text-slate-500">Opponent</p>
                    </div>
                    <button
                      onClick={() => setOpponent(null)}
                      className="ml-auto text-slate-400 hover:text-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-400 text-sm">Select opponent</p>
                  </div>
                )}
              </div>
            </div>

            {/* Client list */}
            {(!challenger || !opponent) && (
              <>
                <div className="relative mb-3">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                {loading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto"></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                    {filteredClients
                      .filter(c => c.id !== challenger && c.id !== opponent)
                      .map(client => (
                        <button
                          key={client.id}
                          onClick={() => {
                            if (!challenger) setChallenger(client.id)
                            else if (!opponent) setOpponent(client.id)
                          }}
                          className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-medium">
                            {client.avatar_url ? (
                              <img src={client.avatar_url} alt={client.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              client.name?.[0]?.toUpperCase() || 'U'
                            )}
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                            {client.name || client.email}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Frequency Settings */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
              Tracking Frequency
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(['daily', 'weekly', 'times_per_week', 'specific_days'] as HabitFrequency[]).map(freq => (
                <button
                  key={freq}
                  onClick={() => setFrequency(freq)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    frequency === freq
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {frequencyLabels[freq]}
                </button>
              ))}
            </div>

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

            {frequency === 'specific_days' && (
              <div className="flex gap-2 mt-3">
                {dayLabels.map((label, index) => (
                  <button
                    key={index}
                    onClick={() => toggleDay(index)}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${
                      specificDays.includes(index)
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value={7}>1 Week</option>
                <option value={14}>2 Weeks</option>
                <option value={21}>3 Weeks</option>
                <option value={30}>1 Month</option>
              </select>
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
            onClick={handleCreate}
            disabled={!challenger || !opponent || creating}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Start Rivalry'}
          </button>
        </div>
      </div>
    </div>
  )
}
