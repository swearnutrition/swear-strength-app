'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface WelcomeSettings {
  welcomeMessage: string
  welcomeMessageEnabled: boolean
}

export function SettingsClient() {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [showConfirm, setShowConfirm] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Welcome message state
  const [welcomeSettings, setWelcomeSettings] = useState<WelcomeSettings>({
    welcomeMessage: '',
    welcomeMessageEnabled: true,
  })
  const [loadingWelcome, setLoadingWelcome] = useState(true)
  const [savingWelcome, setSavingWelcome] = useState(false)

  const supabase = createClient()

  // Load welcome message settings
  useEffect(() => {
    async function loadWelcomeSettings() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('welcome_message, welcome_message_enabled')
        .eq('id', user.id)
        .single()

      if (profile) {
        setWelcomeSettings({
          welcomeMessage: profile.welcome_message || '',
          welcomeMessageEnabled: profile.welcome_message_enabled ?? true,
        })
      }
      setLoadingWelcome(false)
    }

    loadWelcomeSettings()
  }, [supabase])

  const saveWelcomeMessage = async () => {
    setSavingWelcome(true)
    setMessage(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('profiles')
        .update({
          welcome_message: welcomeSettings.welcomeMessage,
          welcome_message_enabled: welcomeSettings.welcomeMessageEnabled,
        })
        .eq('id', user.id)

      if (error) throw error

      setMessage({ type: 'success', text: 'Welcome message saved successfully!' })
    } catch (err) {
      console.error('Error saving welcome message:', err)
      setMessage({ type: 'error', text: 'Failed to save welcome message. Please try again.' })
    } finally {
      setSavingWelcome(false)
    }
  }

  const deleteAllExercises = async () => {
    if (confirmText !== 'DELETE') return

    setDeleting('exercises')
    setMessage(null)

    try {
      const { error } = await supabase.from('exercises').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (error) throw error

      setMessage({ type: 'success', text: 'All exercises have been deleted.' })
      setShowConfirm(null)
      setConfirmText('')
    } catch (err) {
      console.error('Error deleting exercises:', err)
      setMessage({ type: 'error', text: 'Failed to delete exercises. Please try again.' })
    } finally {
      setDeleting(null)
    }
  }

  const deleteExercisesWithoutVideo = async () => {
    if (confirmText !== 'DELETE') return

    setDeleting('no-video')
    setMessage(null)

    try {
      const { error } = await supabase.from('exercises').delete().is('video_url', null)

      if (error) throw error

      setMessage({ type: 'success', text: 'Exercises without videos have been deleted.' })
      setShowConfirm(null)
      setConfirmText('')
    } catch (err) {
      console.error('Error deleting exercises:', err)
      setMessage({ type: 'error', text: 'Failed to delete exercises. Please try again.' })
    } finally {
      setDeleting(null)
    }
  }

  const deleteExercisesWithVideo = async () => {
    if (confirmText !== 'DELETE') return

    setDeleting('with-video')
    setMessage(null)

    try {
      const { error } = await supabase.from('exercises').delete().not('video_url', 'is', null)

      if (error) throw error

      setMessage({ type: 'success', text: 'All exercises with videos have been deleted.' })
      setShowConfirm(null)
      setConfirmText('')
    } catch (err) {
      console.error('Error deleting exercises:', err)
      setMessage({ type: 'error', text: 'Failed to delete exercises. Please try again.' })
    } finally {
      setDeleting(null)
    }
  }

  const clearVideoUrls = async () => {
    if (confirmText !== 'DELETE') return

    setDeleting('clear-urls')
    setMessage(null)

    try {
      const { error } = await supabase.from('exercises').update({ video_url: null }).not('video_url', 'is', null)

      if (error) throw error

      setMessage({ type: 'success', text: 'All video URLs have been cleared from exercises.' })
      setShowConfirm(null)
      setConfirmText('')
    } catch (err) {
      console.error('Error clearing video URLs:', err)
      setMessage({ type: 'error', text: 'Failed to clear video URLs. Please try again.' })
    } finally {
      setDeleting(null)
    }
  }

  const dangerActions = [
    {
      id: 'clear-urls',
      title: 'Clear All Video URLs',
      description: 'Remove video URLs from all exercises but keep the exercise data.',
      buttonText: 'Clear Video URLs',
      action: clearVideoUrls,
    },
    {
      id: 'with-video',
      title: 'Delete Exercises with Videos',
      description: 'Delete all exercises that have a YouTube video attached.',
      buttonText: 'Delete with Videos',
      action: deleteExercisesWithVideo,
    },
    {
      id: 'no-video',
      title: 'Delete Exercises without Videos',
      description: 'Delete all exercises that do NOT have a video attached.',
      buttonText: 'Delete without Videos',
      action: deleteExercisesWithoutVideo,
    },
    {
      id: 'exercises',
      title: 'Delete ALL Exercises',
      description: 'Permanently delete all exercises from the database. This cannot be undone.',
      buttonText: 'Delete All Exercises',
      action: deleteAllExercises,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Manage your account and data</p>
      </div>

      {/* Success/Error Message */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-xl ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Welcome Message Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-8">
        <div className="px-6 py-4 bg-purple-50 dark:bg-purple-500/10 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Welcome Message
          </h2>
          <p className="text-sm text-purple-600 dark:text-purple-400/80 mt-1">
            Automatically send a message to new clients when they sign up
          </p>
        </div>

        <div className="p-6">
          {loadingWelcome ? (
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-6 w-6 text-purple-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">Enable Welcome Message</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Send this message automatically when clients sign up</p>
                </div>
                <button
                  onClick={() => setWelcomeSettings(prev => ({ ...prev, welcomeMessageEnabled: !prev.welcomeMessageEnabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    welcomeSettings.welcomeMessageEnabled ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      welcomeSettings.welcomeMessageEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Message textarea */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Message Content
                </label>
                <textarea
                  value={welcomeSettings.welcomeMessage}
                  onChange={(e) => setWelcomeSettings(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                  rows={5}
                  placeholder="Welcome to my coaching program! I'm excited to have you on board..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  This message will be sent from you to each new client when they accept their invite and create their account.
                </p>
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={saveWelcomeMessage}
                  disabled={savingWelcome}
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors flex items-center gap-2"
                >
                  {savingWelcome ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save Welcome Message'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/20 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Danger Zone
          </h2>
          <p className="text-sm text-red-600 dark:text-red-400/80 mt-1">
            These actions are destructive and cannot be undone.
          </p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {dangerActions.map((action) => (
            <div key={action.id} className="px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white">{action.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{action.description}</p>
                </div>
                <button
                  onClick={() => {
                    setShowConfirm(action.id)
                    setConfirmText('')
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors flex-shrink-0"
                >
                  {action.buttonText}
                </button>
              </div>

              {/* Confirmation */}
              {showConfirm === action.id && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
                  <p className="text-sm text-red-700 dark:text-red-400 mb-3">
                    Type <strong>DELETE</strong> to confirm:
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-500/30 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                    <button
                      onClick={action.action}
                      disabled={confirmText !== 'DELETE' || deleting === action.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {deleting === action.id ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => {
                        setShowConfirm(null)
                        setConfirmText('')
                      }}
                      className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
