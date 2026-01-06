'use client'

import { useState, useEffect } from 'react'
import { useCheckinForms } from '@/hooks/useCheckinForms'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { CheckinFormQuestion, CheckinQuestionType } from '@/types/booking'

interface CheckinFormSubmissionProps {
  bookingId: string
  coachId?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function CheckinFormSubmission({
  bookingId,
  coachId,
  onSuccess,
  onCancel,
}: CheckinFormSubmissionProps) {
  const { questions, loading, error, submitResponses } = useCheckinForms({
    coachId,
    activeOnly: true,
  })

  const [responses, setResponses] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  // Initialize responses when questions load
  useEffect(() => {
    if (questions.length > 0) {
      const initialResponses: Record<string, string | string[]> = {}
      questions.forEach((q) => {
        if (q.questionType === 'checkbox') {
          initialResponses[q.id] = []
        } else {
          initialResponses[q.id] = ''
        }
      })
      setResponses(initialResponses)
    }
  }, [questions])

  const handleTextChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }))
    // Clear validation error when user starts typing
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })
    }
  }

  const handleSelectChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }))
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })
    }
  }

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setResponses((prev) => {
      const current = (prev[questionId] as string[]) || []
      if (checked) {
        return { ...prev, [questionId]: [...current, option] }
      } else {
        return { ...prev, [questionId]: current.filter((v) => v !== option) }
      }
    })
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })
    }
  }

  const handleRadioChange = (questionId: string, value: string) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }))
    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })
    }
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    questions.forEach((question) => {
      if (question.isRequired) {
        const response = responses[question.id]
        const isEmpty =
          response === undefined ||
          response === null ||
          response === '' ||
          (Array.isArray(response) && response.length === 0)

        if (isEmpty) {
          errors[question.id] = 'This question is required'
        }
      }
    })

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      await submitResponses({
        bookingId,
        responses,
      })
      setSubmitted(true)
      onSuccess?.()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  const renderQuestionInput = (question: CheckinFormQuestion) => {
    const hasError = !!validationErrors[question.id]

    switch (question.questionType) {
      case 'text':
        return (
          <Input
            value={(responses[question.id] as string) || ''}
            onChange={(e) => handleTextChange(question.id, e.target.value)}
            placeholder="Enter your answer"
            error={validationErrors[question.id]}
          />
        )

      case 'textarea':
        return (
          <div className="space-y-2">
            <textarea
              value={(responses[question.id] as string) || ''}
              onChange={(e) => handleTextChange(question.id, e.target.value)}
              placeholder="Enter your answer"
              rows={4}
              className={`
                w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-white
                placeholder-slate-500 resize-none
                focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500
                transition-all duration-200
                ${hasError ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500' : 'border-slate-700'}
              `}
            />
            {hasError && <p className="text-sm text-red-400">{validationErrors[question.id]}</p>}
          </div>
        )

      case 'select':
        return (
          <div className="space-y-2">
            <div className="relative">
              <select
                value={(responses[question.id] as string) || ''}
                onChange={(e) => handleSelectChange(question.id, e.target.value)}
                className={`
                  w-full bg-slate-800/50 border rounded-xl px-4 py-3 text-white
                  appearance-none cursor-pointer
                  focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500
                  transition-all duration-200
                  ${hasError ? 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500' : 'border-slate-700'}
                `}
              >
                <option value="" disabled className="text-slate-500">
                  Select an option
                </option>
                {question.options?.map((option) => (
                  <option key={option} value={option} className="bg-slate-900 text-white">
                    {option}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {hasError && <p className="text-sm text-red-400">{validationErrors[question.id]}</p>}
          </div>
        )

      case 'checkbox':
        return (
          <div className="space-y-2">
            <div className="space-y-2">
              {question.options?.map((option) => {
                const isChecked = ((responses[question.id] as string[]) || []).includes(option)
                return (
                  <label
                    key={option}
                    className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleCheckboxChange(question.id, option, e.target.checked)}
                        className="peer sr-only"
                      />
                      <div
                        className={`
                          w-5 h-5 rounded-md border-2 border-slate-600
                          bg-slate-800/50
                          transition-all duration-200
                          peer-checked:bg-purple-600 peer-checked:border-purple-600
                          peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500/50
                          group-hover:border-slate-500 peer-checked:group-hover:border-purple-500
                        `}
                      />
                      <svg
                        className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity duration-200"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm text-slate-200 group-hover:text-white transition-colors">{option}</span>
                  </label>
                )
              })}
            </div>
            {hasError && <p className="text-sm text-red-400">{validationErrors[question.id]}</p>}
          </div>
        )

      case 'radio':
        return (
          <div className="space-y-2">
            <div className="space-y-2">
              {question.options?.map((option) => {
                const isSelected = responses[question.id] === option
                return (
                  <label
                    key={option}
                    className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="relative flex items-center justify-center">
                      <input
                        type="radio"
                        name={`radio-${question.id}`}
                        checked={isSelected}
                        onChange={() => handleRadioChange(question.id, option)}
                        className="peer sr-only"
                      />
                      <div
                        className={`
                          w-5 h-5 rounded-full border-2 border-slate-600
                          bg-slate-800/50
                          transition-all duration-200
                          peer-checked:border-purple-600
                          peer-focus-visible:ring-2 peer-focus-visible:ring-purple-500/50
                          group-hover:border-slate-500 peer-checked:group-hover:border-purple-500
                        `}
                      />
                      <div
                        className={`
                          absolute w-2.5 h-2.5 rounded-full bg-purple-600
                          transition-all duration-200
                          ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}
                        `}
                      />
                    </div>
                    <span className="text-sm text-slate-200 group-hover:text-white transition-colors">{option}</span>
                  </label>
                )
              })}
            </div>
            {hasError && <p className="text-sm text-red-400">{validationErrors[question.id]}</p>}
          </div>
        )

      default:
        return null
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-red-400">{error}</p>
          <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (submitted) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Form Submitted!</h3>
          <p className="text-slate-400">Thank you for completing your check-in form.</p>
        </div>
      </Card>
    )
  }

  if (questions.length === 0) {
    return (
      <Card>
        <div className="text-center py-12 text-slate-400">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-slate-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mb-2">No check-in form required</p>
          <p className="text-sm">Your coach has not set up any check-in questions.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Check-in Form"
        subtitle="Please complete the following questions before your appointment"
      />

      <div className="space-y-6">
        {questions.map((question, index) => (
          <div key={question.id} className="space-y-2">
            <label className="block text-sm font-medium text-slate-200">
              <span className="text-slate-500 mr-2">{index + 1}.</span>
              {question.question}
              {question.isRequired && <span className="text-red-400 ml-1">*</span>}
            </label>
            {renderQuestionInput(question)}
          </div>
        ))}

        {submitError && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{submitError}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
          )}
          <Button onClick={handleSubmit} loading={submitting}>
            Submit Form
          </Button>
        </div>
      </div>
    </Card>
  )
}
