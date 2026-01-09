'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface InviteClientModalProps {
  onClose: () => void
}

export function InviteClientModal({ onClose }: InviteClientModalProps) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [sendEmail, setSendEmail] = useState(true)
  const [emailSent, setEmailSent] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSending(true)

    try {
      // Generate invite token
      const token = crypto.randomUUID()

      // Set expiry to 7 days from now
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create invite record
      const { error: insertError } = await supabase.from('invites').insert({
        email: email.toLowerCase().trim(),
        name: name.trim() || null,
        token,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      })

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('An invite has already been sent to this email')
        }
        throw insertError
      }

      // Generate invite link
      const baseUrl = window.location.origin
      const link = `${baseUrl}/invite/${token}`
      setInviteLink(link)

      // Get coach name for email
      const { data: coachProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()

      const coachName = coachProfile?.name || 'Your Coach'

      // Send invite email if enabled
      if (sendEmail) {
        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke('send-email', {
            body: {
              to: email.toLowerCase().trim(),
              template: 'client-invite',
              data: {
                inviteLink: link,
                coachName,
              },
            },
          })

          console.log('Email function response:', { fnData, fnError })

          if (fnError) {
            console.error('Failed to send email:', fnError)
            // Don't fail the whole process if email fails
          } else {
            setEmailSent(true)
          }
        } catch (emailErr) {
          console.error('Email error:', emailErr)
        }
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      console.error('Error creating invite:', err)
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setSending(false)
    }
  }

  const copyToClipboard = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Invite Client</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          /* Success State */
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Invite Created!</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                {emailSent ? (
                  <>Email sent to <strong className="text-slate-700 dark:text-slate-200">{email}</strong></>
                ) : (
                  <>Share this link with {email}</>
                )}
              </p>
            </div>

            {/* Invite Link */}
            <div className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-500 mb-2">Invite Link (expires in 7 days)</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inviteLink || ''}
                  readOnly
                  className="flex-1 bg-transparent text-slate-900 dark:text-white text-sm truncate outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email Address <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="client@example.com"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Client's name"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Send Email Toggle */}
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-purple-600 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Send email invitation
              </span>
            </label>

            <p className="text-xs text-slate-500">
              {sendEmail
                ? 'An email with the invite link will be sent to the client.'
                : 'An invite link will be generated for you to share manually.'
              }
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-medium rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending || !email}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Creating...' : 'Create Invite'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
