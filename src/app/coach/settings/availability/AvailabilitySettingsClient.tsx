'use client'

import { useState, useMemo, useEffect } from 'react'
import { useAvailability } from '@/hooks/useAvailability'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import type {
  AvailabilityTemplate,
  AvailabilityOverride,
  AvailabilityType,
  CoachBookingSettings,
} from '@/types/booking'

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

const AVAILABILITY_TYPES = [
  { value: 'session', label: 'Training Sessions' },
  { value: 'checkin', label: 'Check-ins' },
]

function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

function getDayName(dayOfWeek: number): string {
  return DAYS_OF_WEEK[dayOfWeek]?.label || ''
}

export function AvailabilitySettingsClient() {
  const [activeTab, setActiveTab] = useState<'templates' | 'overrides' | 'settings'>('templates')
  const [selectedType, setSelectedType] = useState<AvailabilityType>('session')

  // Template modal state
  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    dayOfWeek: '1',
    startTime: '09:00',
    endTime: '17:00',
    maxConcurrentClients: '2',
  })
  const [addingTemplate, setAddingTemplate] = useState(false)

  // Override modal state
  const [showAddOverride, setShowAddOverride] = useState(false)
  const [overrideForm, setOverrideForm] = useState({
    overrideDate: '',
    startTime: '',
    endTime: '',
    isBlocked: true,
    maxConcurrentClients: '1',
    isFullDay: true,
  })
  const [addingOverride, setAddingOverride] = useState(false)

  // Booking settings state
  const [bookingSettings, setBookingSettings] = useState<CoachBookingSettings | null>(null)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    bookingWindowDays: '90',
    minNoticeHours: '12',
    renewalReminderThreshold: '2',
  })

  // Google Calendar state
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(true)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)

  const supabase = createClient()

  const {
    templates,
    overrides,
    loading,
    createTemplate,
    createOverride,
    deleteTemplate,
    deleteOverride,
  } = useAvailability({ type: selectedType })

  // Fetch booking settings and Google Calendar connection status
  useEffect(() => {
    async function fetchSettings() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch booking settings
      const { data, error } = await supabase
        .from('coach_booking_settings')
        .select('*')
        .eq('coach_id', user.id)
        .single()

      if (data && !error) {
        setBookingSettings(data)
        setSettingsForm({
          bookingWindowDays: data.booking_window_days?.toString() || '90',
          minNoticeHours: data.min_notice_hours?.toString() || '12',
          renewalReminderThreshold: data.renewal_reminder_threshold?.toString() || '2',
        })
      }
      setSettingsLoading(false)

      // Check Google Calendar connection
      const { data: gcalData } = await supabase
        .from('google_calendar_credentials')
        .select('id')
        .eq('coach_id', user.id)
        .single()

      setGoogleConnected(!!gcalData)
      setGoogleLoading(false)
    }
    fetchSettings()
  }, [supabase])

  // Group templates by day of week
  const templatesByDay = useMemo(() => {
    const grouped = new Map<number, AvailabilityTemplate[]>()
    for (let i = 0; i < 7; i++) {
      grouped.set(i, [])
    }
    templates.forEach((t) => {
      const day = t.dayOfWeek
      const existing = grouped.get(day) || []
      grouped.set(day, [...existing, t])
    })
    return grouped
  }, [templates])

  // Group overrides by month for calendar view
  const upcomingOverrides = useMemo(() => {
    const now = new Date()
    return overrides
      .filter((o) => new Date(o.overrideDate) >= now)
      .sort((a, b) => new Date(a.overrideDate).getTime() - new Date(b.overrideDate).getTime())
  }, [overrides])

  const handleAddTemplate = async () => {
    setAddingTemplate(true)
    try {
      await createTemplate({
        availabilityType: selectedType,
        dayOfWeek: parseInt(templateForm.dayOfWeek),
        startTime: templateForm.startTime,
        endTime: templateForm.endTime,
        maxConcurrentClients: parseInt(templateForm.maxConcurrentClients),
      })
      setShowAddTemplate(false)
      setTemplateForm({
        dayOfWeek: '1',
        startTime: '09:00',
        endTime: '17:00',
        maxConcurrentClients: '2',
      })
    } finally {
      setAddingTemplate(false)
    }
  }

  const handleAddOverride = async () => {
    if (!overrideForm.overrideDate) return

    setAddingOverride(true)
    try {
      await createOverride({
        availabilityType: selectedType,
        overrideDate: overrideForm.overrideDate,
        startTime: overrideForm.isFullDay ? undefined : overrideForm.startTime || undefined,
        endTime: overrideForm.isFullDay ? undefined : overrideForm.endTime || undefined,
        isBlocked: overrideForm.isBlocked,
        maxConcurrentClients: overrideForm.isBlocked
          ? undefined
          : parseInt(overrideForm.maxConcurrentClients),
      })
      setShowAddOverride(false)
      setOverrideForm({
        overrideDate: '',
        startTime: '',
        endTime: '',
        isBlocked: true,
        maxConcurrentClients: '1',
        isFullDay: true,
      })
    } finally {
      setAddingOverride(false)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this availability block?')) return
    await deleteTemplate(templateId)
  }

  const handleDeleteOverride = async (overrideId: string) => {
    if (!confirm('Are you sure you want to delete this override?')) return
    await deleteOverride(overrideId)
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const settingsData = {
        coach_id: user.id,
        booking_window_days: parseInt(settingsForm.bookingWindowDays),
        min_notice_hours: parseInt(settingsForm.minNoticeHours),
        renewal_reminder_threshold: parseInt(settingsForm.renewalReminderThreshold),
      }

      const { error } = await supabase
        .from('coach_booking_settings')
        .upsert(settingsData, { onConflict: 'coach_id' })

      if (error) throw error
      alert('Settings saved successfully!')
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleConnectGoogle = () => {
    // Redirect to Google OAuth
    window.location.href = '/api/google/auth'
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? Existing calendar events will not be deleted, but new bookings won\'t sync.')) {
      return
    }

    setDisconnectingGoogle(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('google_calendar_credentials')
        .delete()
        .eq('coach_id', user.id)

      if (error) throw error
      setGoogleConnected(false)
    } catch (err) {
      console.error('Error disconnecting Google:', err)
      alert('Failed to disconnect Google Calendar')
    } finally {
      setDisconnectingGoogle(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <a
            href="/coach/settings"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-2xl font-bold text-white">Availability Settings</h1>
        </div>
        <p className="text-slate-400">
          Configure your weekly availability and manage date-specific overrides
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-800/50 rounded-xl p-1 mb-6">
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'bg-purple-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Weekly Schedule
        </button>
        <button
          onClick={() => setActiveTab('overrides')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'overrides'
              ? 'bg-purple-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Overrides
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-purple-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Booking Rules
        </button>
      </div>

      {/* Weekly Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Type selector and Add button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
              {AVAILABILITY_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value as AvailabilityType)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedType === type.value
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <Button onClick={() => setShowAddTemplate(true)}>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Time Block
            </Button>
          </div>

          {/* Weekly schedule grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              {Array.from(templatesByDay.entries()).map(([day, dayTemplates]) => (
                <div
                  key={day}
                  className="border-b border-slate-800 last:border-b-0"
                >
                  <div className="flex items-start gap-4 p-4">
                    <div className="w-28 flex-shrink-0">
                      <span className="text-sm font-medium text-white">{getDayName(day)}</span>
                    </div>
                    <div className="flex-1">
                      {dayTemplates.length === 0 ? (
                        <span className="text-sm text-slate-500">Not available</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {dayTemplates
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map((template) => (
                              <div
                                key={template.id}
                                className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-1.5"
                              >
                                <span className="text-sm text-purple-300">
                                  {formatTime(template.startTime)} - {formatTime(template.endTime)}
                                </span>
                                <span className="text-xs text-purple-400/60">
                                  ({template.maxConcurrentClients} max)
                                </span>
                                <button
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  className="ml-1 text-slate-500 hover:text-red-400 transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overrides Tab */}
      {activeTab === 'overrides' && (
        <div className="space-y-6">
          {/* Type selector and Add button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg p-1">
              {AVAILABILITY_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value as AvailabilityType)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedType === type.value
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
            <Button onClick={() => setShowAddOverride(true)}>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Override
            </Button>
          </div>

          {/* Overrides list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : upcomingOverrides.length === 0 ? (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 text-center">
              <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-400 mb-2">No upcoming overrides</p>
              <p className="text-sm text-slate-500">
                Add overrides to block time off or add extra availability for specific dates
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
              {upcomingOverrides.map((override) => {
                const date = new Date(override.overrideDate)
                const isBlocked = override.isBlocked
                const isFullDay = !override.startTime && !override.endTime

                return (
                  <div
                    key={override.id}
                    className="flex items-center justify-between p-4 border-b border-slate-800 last:border-b-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isBlocked
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-green-500/10 text-green-400'
                      }`}>
                        {isBlocked ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-sm text-slate-400">
                          {isBlocked ? (
                            isFullDay ? 'Blocked all day' : `Blocked ${formatTime(override.startTime!)} - ${formatTime(override.endTime!)}`
                          ) : (
                            isFullDay
                              ? `Extra availability all day (${override.maxConcurrentClients} max)`
                              : `Extra ${formatTime(override.startTime!)} - ${formatTime(override.endTime!)} (${override.maxConcurrentClients} max)`
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteOverride(override.id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Booking Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6">
          {settingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-purple-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Booking Rules</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Configure how far in advance clients can book and the minimum notice required.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <Input
                  label="Booking Window (days)"
                  type="number"
                  min="1"
                  max="365"
                  value={settingsForm.bookingWindowDays}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, bookingWindowDays: e.target.value })
                  }
                  hint="How far ahead clients can book (e.g., 90 = 3 months)"
                />

                <Input
                  label="Minimum Notice (hours)"
                  type="number"
                  min="0"
                  max="168"
                  value={settingsForm.minNoticeHours}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, minNoticeHours: e.target.value })
                  }
                  hint="Minimum hours before a booking can be made"
                />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Renewal Reminders</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Get notified when clients are running low on sessions.
                </p>

                <Input
                  label="Renewal Reminder Threshold"
                  type="number"
                  min="1"
                  max="10"
                  value={settingsForm.renewalReminderThreshold}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, renewalReminderThreshold: e.target.value })
                  }
                  hint="Show renewal alert when client has this many sessions remaining"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveSettings} loading={savingSettings}>
                  Save Settings
                </Button>
              </div>

              {/* Google Calendar Integration */}
              <div className="pt-6 border-t border-slate-800">
                <h3 className="text-lg font-semibold text-white mb-4">Google Calendar Integration</h3>
                <p className="text-sm text-slate-400 mb-6">
                  Connect your Google Calendar to automatically sync bookings. Clients will receive calendar invites with Google Meet links for virtual check-ins.
                </p>

                {googleLoading ? (
                  <div className="flex items-center gap-3 text-slate-400">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Checking connection status...</span>
                  </div>
                ) : googleConnected ? (
                  <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-green-400">Google Calendar Connected</div>
                        <div className="text-sm text-slate-400">Bookings will sync to your calendar</div>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={handleDisconnectGoogle}
                      loading={disconnectingGoogle}
                    >
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-medium text-white">Google Calendar Not Connected</div>
                        <div className="text-sm text-slate-400">Connect to sync bookings and send calendar invites</div>
                      </div>
                    </div>
                    <Button onClick={handleConnectGoogle}>
                      <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      Connect Google Calendar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Template Modal */}
      <Modal
        isOpen={showAddTemplate}
        onClose={() => setShowAddTemplate(false)}
        title="Add Availability Block"
        description={`Add a recurring time block for ${selectedType === 'session' ? 'training sessions' : 'check-ins'}`}
      >
        <div className="space-y-4">
          <Select
            label="Day of Week"
            options={DAYS_OF_WEEK}
            value={templateForm.dayOfWeek}
            onChange={(e) => setTemplateForm({ ...templateForm, dayOfWeek: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={templateForm.startTime}
              onChange={(e) => setTemplateForm({ ...templateForm, startTime: e.target.value })}
            />
            <Input
              label="End Time"
              type="time"
              value={templateForm.endTime}
              onChange={(e) => setTemplateForm({ ...templateForm, endTime: e.target.value })}
            />
          </div>

          <Input
            label="Max Concurrent Clients"
            type="number"
            min="1"
            max="10"
            value={templateForm.maxConcurrentClients}
            onChange={(e) =>
              setTemplateForm({ ...templateForm, maxConcurrentClients: e.target.value })
            }
            hint="Maximum number of overlapping bookings allowed"
          />
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowAddTemplate(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddTemplate} loading={addingTemplate}>
            Add Block
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add Override Modal */}
      <Modal
        isOpen={showAddOverride}
        onClose={() => setShowAddOverride(false)}
        title="Add Date Override"
        description={`Add a date-specific override for ${selectedType === 'session' ? 'training sessions' : 'check-ins'}`}
      >
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={overrideForm.overrideDate}
            onChange={(e) => setOverrideForm({ ...overrideForm, overrideDate: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
          />

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-300">Override Type</label>
            <div className="flex gap-3">
              <button
                onClick={() => setOverrideForm({ ...overrideForm, isBlocked: true })}
                className={`flex-1 p-3 rounded-xl border transition-colors ${
                  overrideForm.isBlocked
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                <span className="text-sm font-medium">Block Time</span>
              </button>
              <button
                onClick={() => setOverrideForm({ ...overrideForm, isBlocked: false })}
                className={`flex-1 p-3 rounded-xl border transition-colors ${
                  !overrideForm.isBlocked
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <svg className="w-5 h-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-sm font-medium">Extra Availability</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="fullDay"
                checked={overrideForm.isFullDay}
                onChange={(e) => setOverrideForm({ ...overrideForm, isFullDay: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-900"
              />
              <label htmlFor="fullDay" className="text-sm text-slate-300">
                Apply to entire day
              </label>
            </div>

            {!overrideForm.isFullDay && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Time"
                  type="time"
                  value={overrideForm.startTime}
                  onChange={(e) => setOverrideForm({ ...overrideForm, startTime: e.target.value })}
                />
                <Input
                  label="End Time"
                  type="time"
                  value={overrideForm.endTime}
                  onChange={(e) => setOverrideForm({ ...overrideForm, endTime: e.target.value })}
                />
              </div>
            )}
          </div>

          {!overrideForm.isBlocked && (
            <Input
              label="Max Concurrent Clients"
              type="number"
              min="1"
              max="10"
              value={overrideForm.maxConcurrentClients}
              onChange={(e) =>
                setOverrideForm({ ...overrideForm, maxConcurrentClients: e.target.value })
              }
              hint="Maximum number of overlapping bookings allowed"
            />
          )}
        </div>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowAddOverride(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddOverride}
            loading={addingOverride}
            disabled={!overrideForm.overrideDate}
          >
            Add Override
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
