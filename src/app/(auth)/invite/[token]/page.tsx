'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'

type ClientType = 'online' | 'training' | 'hybrid'

interface InviteData {
  id: string
  email: string
  coach_name: string
  coach_id: string
  expires_at: string
}

export default function AcceptInvitePage() {
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientType, setClientType] = useState<ClientType>('online')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  useEffect(() => {
    async function fetchInvite() {
      try {
        // First get the invite
        const { data: inviteData, error: inviteError } = await supabase
          .from('invites')
          .select('id, email, expires_at, accepted_at, created_by, name, client_type')
          .eq('token', token)
          .single()

        if (inviteError || !inviteData) {
          setError('Invalid or expired invite link')
          setLoading(false)
          return
        }

        if (inviteData.accepted_at) {
          setError('This invite has already been used')
          setLoading(false)
          return
        }

        if (new Date(inviteData.expires_at) < new Date()) {
          setError('This invite has expired')
          setLoading(false)
          return
        }

        // Get coach name
        let coachName = 'Your Coach'
        if (inviteData.created_by) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', inviteData.created_by)
            .single()

          if (profileData?.name) {
            coachName = profileData.name
          }
        }

        // Pre-fill name and client type if provided (from bulk invite)
        if (inviteData.name) {
          setName(inviteData.name)
        }
        if (inviteData.client_type) {
          setClientType(inviteData.client_type)
        }

        setInviteData({
          id: inviteData.id,
          email: inviteData.email,
          coach_name: coachName,
          coach_id: inviteData.created_by,
          expires_at: inviteData.expires_at,
        })
      } catch {
        setError('Failed to load invite')
      } finally {
        setLoading(false)
      }
    }

    fetchInvite()
  }, [token, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)

    try {
      // Create the user account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteData!.email,
        password,
        options: {
          data: {
            name,
            role: 'client',
            client_type: clientType,
          },
        },
      })

      if (authError) {
        console.error('Signup error:', authError)
        // Handle case where user already exists
        if (authError.status === 422 || authError.message?.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists. Please log in instead, and your coach connection will be set up automatically.')
          return
        }
        setError(`${authError.message} (Code: ${authError.status || 'unknown'})`)
        return
      }

      if (!authData.user) {
        setError('Failed to create account')
        return
      }

      // Mark invite as accepted
      await supabase
        .from('invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('token', token)

      // Update profile with invite info, client type, and coach link
      // This update triggers the welcome message to be sent
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          invited_by: inviteData!.coach_id,
          invite_accepted_at: new Date().toISOString(),
          client_type: clientType,
        })
        .eq('id', authData.user.id)

      if (profileUpdateError) {
        console.error('Failed to update profile with invite info:', profileUpdateError)
      }

      // Migrate any pre-configured data (packages, habits, programs, conversations, bookings)
      // from invite_id to the new client_id
      if (inviteData?.id) {
        await supabase.rpc('migrate_pending_client_data', {
          p_invite_id: inviteData.id,
          p_client_id: authData.user.id,
        })
      }

      router.push('/dashboard')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading invite...
        </div>
      </div>
    )
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Invalid Invite</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <a
              href="/login"
              className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-6 rounded-xl transition-colors"
            >
              Go to Login
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
            SWEAR STRENGTH
          </h1>
          <p className="text-slate-400 mt-2">
            {inviteData?.coach_name} invited you to join
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-8 shadow-xl shadow-purple-500/5">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Email
              </label>
              <div className="w-full bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-400">
                {inviteData?.email}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-slate-300">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Create Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Training Type
              </label>
              <p className="text-xs text-slate-500 mb-3">
                How will you be training with {inviteData?.coach_name}?
              </p>
              <div className="grid gap-2">
                {[
                  { value: 'online' as const, label: 'Online Only', desc: 'Monthly check-ins and remote coaching' },
                  { value: 'training' as const, label: 'In-Person Training', desc: 'Regular training sessions with your coach' },
                  { value: 'hybrid' as const, label: 'Hybrid', desc: 'Mix of in-person sessions and online coaching' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setClientType(option.value)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      clientType === option.value
                        ? 'bg-purple-500/20 border-purple-500 text-white'
                        : 'bg-slate-800/30 border-slate-700 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="font-medium block">{option.label}</span>
                    <span className="text-xs text-slate-400">{option.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-purple-500/25"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          Already have an account?{' '}
          <a href="/login" className="text-purple-400 hover:text-purple-300 transition-colors">
            Sign in
          </a>
        </p>
      </div>
    </div>
  )
}
