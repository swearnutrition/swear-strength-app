'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  CheckinFormQuestion,
  CheckinFormResponse,
  CreateCheckinQuestionPayload,
  SubmitCheckinFormPayload,
  CheckinQuestionType,
} from '@/types/booking'

interface UpdateQuestionPayload {
  question?: string
  questionType?: CheckinQuestionType
  options?: string[]
  isRequired?: boolean
  isActive?: boolean
  sortOrder?: number
}

interface UseCheckinFormsReturn {
  questions: CheckinFormQuestion[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  createQuestion: (payload: CreateCheckinQuestionPayload) => Promise<CheckinFormQuestion | null>
  updateQuestion: (id: string, payload: UpdateQuestionPayload) => Promise<CheckinFormQuestion | null>
  deleteQuestion: (id: string, hard?: boolean) => Promise<boolean>
  reorderQuestions: (questionIds: string[]) => Promise<boolean>
  submitResponses: (payload: SubmitCheckinFormPayload) => Promise<CheckinFormResponse | null>
}

interface UseCheckinFormsOptions {
  coachId?: string
  activeOnly?: boolean
}

export function useCheckinForms(options: UseCheckinFormsOptions = {}): UseCheckinFormsReturn {
  const [questions, setQuestions] = useState<CheckinFormQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchQuestions = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (options.coachId) params.set('coachId', options.coachId)
      if (options.activeOnly) params.set('activeOnly', 'true')

      const url = `/api/checkin-forms${params.toString() ? `?${params}` : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch questions')
      }

      const data = await res.json()
      // Transform snake_case from API to camelCase for frontend
      const transformedQuestions: CheckinFormQuestion[] = (data.questions || []).map(
        (q: Record<string, unknown>) => ({
          id: q.id,
          coachId: q.coach_id,
          question: q.question,
          questionType: q.question_type,
          options: q.options,
          sortOrder: q.sort_order,
          isRequired: q.is_required,
          isActive: q.is_active,
          createdAt: q.created_at,
        })
      )
      setQuestions(transformedQuestions)
      setError(null)
    } catch (err) {
      console.error('Error fetching questions:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [options.coachId, options.activeOnly])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('checkin_form_questions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'checkin_form_questions',
        },
        () => {
          fetchQuestions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchQuestions, supabase])

  const createQuestion = async (
    payload: CreateCheckinQuestionPayload
  ): Promise<CheckinFormQuestion | null> => {
    try {
      const res = await fetch('/api/checkin-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create question')
      }

      await fetchQuestions()
      // Transform response
      const q = data.question
      return {
        id: q.id,
        coachId: q.coach_id,
        question: q.question,
        questionType: q.question_type,
        options: q.options,
        sortOrder: q.sort_order,
        isRequired: q.is_required,
        isActive: q.is_active,
        createdAt: q.created_at,
      }
    } catch (err) {
      console.error('Error creating question:', err)
      throw err
    }
  }

  const updateQuestion = async (
    id: string,
    payload: UpdateQuestionPayload
  ): Promise<CheckinFormQuestion | null> => {
    try {
      const res = await fetch(`/api/checkin-forms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update question')
      }

      await fetchQuestions()
      // Transform response
      const q = data.question
      return {
        id: q.id,
        coachId: q.coach_id,
        question: q.question,
        questionType: q.question_type,
        options: q.options,
        sortOrder: q.sort_order,
        isRequired: q.is_required,
        isActive: q.is_active,
        createdAt: q.created_at,
      }
    } catch (err) {
      console.error('Error updating question:', err)
      throw err
    }
  }

  const deleteQuestion = async (id: string, hard = false): Promise<boolean> => {
    try {
      const url = hard ? `/api/checkin-forms/${id}?hard=true` : `/api/checkin-forms/${id}`
      const res = await fetch(url, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete question')
      }

      await fetchQuestions()
      return true
    } catch (err) {
      console.error('Error deleting question:', err)
      throw err
    }
  }

  const reorderQuestions = async (questionIds: string[]): Promise<boolean> => {
    try {
      // Update each question's sort_order based on its position in the array
      const updatePromises = questionIds.map((id, index) =>
        fetch(`/api/checkin-forms/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: index }),
        })
      )

      const results = await Promise.all(updatePromises)
      const allSuccessful = results.every((res) => res.ok)

      if (!allSuccessful) {
        throw new Error('Failed to reorder some questions')
      }

      await fetchQuestions()
      return true
    } catch (err) {
      console.error('Error reordering questions:', err)
      throw err
    }
  }

  const submitResponses = async (
    payload: SubmitCheckinFormPayload
  ): Promise<CheckinFormResponse | null> => {
    try {
      const res = await fetch('/api/checkin-forms/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit responses')
      }

      // Transform response
      const r = data.formResponse
      return {
        id: r.id,
        bookingId: r.booking_id,
        clientId: r.client_id,
        responses: r.responses,
        submittedAt: r.submitted_at,
      }
    } catch (err) {
      console.error('Error submitting responses:', err)
      throw err
    }
  }

  return {
    questions,
    loading,
    error,
    refetch: fetchQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
    reorderQuestions,
    submitResponses,
  }
}
