'use client'

import { useState } from 'react'
import type { TrainingExperience, TrainingFormat, TrainingGoal, CreateLeadPayload } from '@/types/lead'

const experienceOptions: TrainingExperience[] = [
  'Brand new to lifting',
  'Less than 1 year',
  '1-3 years',
  '3-5 years',
  '5+ years',
]

const goalOptions: TrainingGoal[] = [
  'Build strength',
  'Fix/improve technique',
  'General health & fitness',
  'Fat loss / weight loss',
  'Build muscle',
  'Improve posture',
  'Other',
]

const formatOptions: { value: TrainingFormat; label: string }[] = [
  { value: 'online', label: 'Online (independent/busy lifestyle)' },
  { value: 'hybrid', label: 'Hybrid (see me sometimes, workout on own most of the time)' },
  { value: 'in-person', label: 'Fully in-person' },
]

export function InquiryForm() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    trainingExperience: '' as TrainingExperience | '',
    goals: [] as TrainingGoal[],
    trainingFormat: '' as TrainingFormat | '',
    currentSituation: '',
    anythingElse: '',
  })

  const handleGoalToggle = (goal: TrainingGoal) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter((g) => g !== goal)
        : [...prev.goals, goal],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const payload: CreateLeadPayload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        trainingExperience: formData.trainingExperience as TrainingExperience,
        goals: formData.goals,
        trainingFormat: formData.trainingFormat as TrainingFormat,
        currentSituation: formData.currentSituation,
        anythingElse: formData.anythingElse || undefined,
      }

      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit')
      }

      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">Inquiry Sent!</h3>
        <p className="text-slate-400 text-sm">
          Thanks for reaching out! I&apos;ll get back to you soon.
        </p>
      </div>
    )
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/50 hover:border-purple-400 transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white mb-1">Train With Me</h3>
            <p className="text-slate-400 text-sm">Inquire about coaching</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-all">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Train With Me</h3>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            placeholder="Your name"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Email <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            placeholder="you@example.com"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Phone <span className="text-slate-500">(optional)</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            placeholder="(555) 123-4567"
          />
        </div>

        {/* Training Experience */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Training Experience <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={formData.trainingExperience}
            onChange={(e) => setFormData({ ...formData, trainingExperience: e.target.value as TrainingExperience })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          >
            <option value="">Select your experience level</option>
            {experienceOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Goals */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Goals <span className="text-red-400">*</span> <span className="text-slate-500">(select all that apply)</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {goalOptions.map((goal) => (
              <label
                key={goal}
                className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                  formData.goals.includes(goal)
                    ? 'bg-purple-500/20 border-purple-500 text-white'
                    : 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={formData.goals.includes(goal)}
                  onChange={() => handleGoalToggle(goal)}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                  formData.goals.includes(goal)
                    ? 'bg-purple-500 border-purple-500'
                    : 'border-slate-600'
                }`}>
                  {formData.goals.includes(goal) && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{goal}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Training Format */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Training Format <span className="text-red-400">*</span>
          </label>
          <select
            required
            value={formData.trainingFormat}
            onChange={(e) => setFormData({ ...formData, trainingFormat: e.target.value as TrainingFormat })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
          >
            <option value="">Select your preferred format</option>
            {formatOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Current Situation */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Current Situation <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={formData.currentSituation}
            onChange={(e) => setFormData({ ...formData, currentSituation: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            placeholder="Tell me about your gym setup, current program, and equipment access..."
          />
        </div>

        {/* Anything Else */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Anything else? <span className="text-slate-500">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={formData.anythingElse}
            onChange={(e) => setFormData({ ...formData, anythingElse: e.target.value })}
            className="w-full px-4 py-2.5 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            placeholder="Anything else you&apos;d like me to know..."
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || formData.goals.length === 0}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </span>
          ) : (
            'Send Inquiry'
          )}
        </button>
      </form>
    </div>
  )
}
