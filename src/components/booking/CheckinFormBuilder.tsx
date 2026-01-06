'use client'

import { useState } from 'react'
import { useCheckinForms } from '@/hooks/useCheckinForms'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import type { CheckinFormQuestion, CheckinQuestionType } from '@/types/booking'

const QUESTION_TYPE_OPTIONS = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'checkbox', label: 'Checkboxes (Multiple)' },
  { value: 'radio', label: 'Radio Buttons (Single)' },
]

interface QuestionFormData {
  question: string
  questionType: CheckinQuestionType
  options: string[]
  isRequired: boolean
}

const DEFAULT_FORM_DATA: QuestionFormData = {
  question: '',
  questionType: 'text',
  options: [''],
  isRequired: false,
}

export function CheckinFormBuilder() {
  const { questions, loading, error, createQuestion, updateQuestion, deleteQuestion, reorderQuestions } =
    useCheckinForms()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<CheckinFormQuestion | null>(null)
  const [formData, setFormData] = useState<QuestionFormData>(DEFAULT_FORM_DATA)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const needsOptions = ['select', 'checkbox', 'radio'].includes(formData.questionType)

  const openAddModal = () => {
    setEditingQuestion(null)
    setFormData(DEFAULT_FORM_DATA)
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (question: CheckinFormQuestion) => {
    setEditingQuestion(question)
    setFormData({
      question: question.question,
      questionType: question.questionType,
      options: question.options?.length ? question.options : [''],
      isRequired: question.isRequired,
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingQuestion(null)
    setFormData(DEFAULT_FORM_DATA)
    setFormError(null)
  }

  const handleAddOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, ''],
    }))
  }

  const handleRemoveOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }))
  }

  const handleOptionChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }))
  }

  const handleSave = async () => {
    // Validate
    if (!formData.question.trim()) {
      setFormError('Question text is required')
      return
    }

    if (needsOptions) {
      const validOptions = formData.options.filter((opt) => opt.trim())
      if (validOptions.length < 2) {
        setFormError('At least 2 options are required for this question type')
        return
      }
    }

    setSaving(true)
    setFormError(null)

    try {
      const cleanedOptions = needsOptions
        ? formData.options.filter((opt) => opt.trim())
        : undefined

      if (editingQuestion) {
        await updateQuestion(editingQuestion.id, {
          question: formData.question.trim(),
          questionType: formData.questionType,
          options: cleanedOptions,
          isRequired: formData.isRequired,
        })
      } else {
        await createQuestion({
          question: formData.question.trim(),
          questionType: formData.questionType,
          options: cleanedOptions,
          isRequired: formData.isRequired,
        })
      }
      closeModal()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (question: CheckinFormQuestion) => {
    try {
      await updateQuestion(question.id, { isActive: !question.isActive })
    } catch (err) {
      console.error('Failed to toggle question:', err)
    }
  }

  const handleToggleRequired = async (question: CheckinFormQuestion) => {
    try {
      await updateQuestion(question.id, { isRequired: !question.isRequired })
    } catch (err) {
      console.error('Failed to toggle required:', err)
    }
  }

  const handleDelete = async (question: CheckinFormQuestion) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return
    }

    try {
      await deleteQuestion(question.id, true)
    } catch (err) {
      console.error('Failed to delete question:', err)
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    const newOrder = [...questions]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp
    try {
      await reorderQuestions(newOrder.map((q) => q.id))
    } catch (err) {
      console.error('Failed to reorder:', err)
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index === questions.length - 1) return
    const newOrder = [...questions]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp
    try {
      await reorderQuestions(newOrder.map((q) => q.id))
    } catch (err) {
      console.error('Failed to reorder:', err)
    }
  }

  const getQuestionTypeLabel = (type: CheckinQuestionType) => {
    return QUESTION_TYPE_OPTIONS.find((opt) => opt.value === type)?.label || type
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

  return (
    <>
      <Card>
        <CardHeader
          title="Check-in Form Questions"
          subtitle="Customize the questions clients answer before check-in appointments"
          action={
            <Button onClick={openAddModal} size="sm">
              Add Question
            </Button>
          }
        />

        {questions.length === 0 ? (
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="mb-2">No questions yet</p>
            <p className="text-sm">Add questions to collect information from clients before check-ins</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className={`
                  p-4 rounded-xl border transition-all
                  ${
                    question.isActive
                      ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-900/50 border-slate-800 opacity-60'
                  }
                `}
              >
                <div className="flex items-start gap-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === questions.length - 1}
                      className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Question content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{question.question}</span>
                      {question.isRequired && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded">
                          Required
                        </span>
                      )}
                      {!question.isActive && (
                        <span className="px-1.5 py-0.5 text-xs font-medium bg-slate-600/50 text-slate-400 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <span>{getQuestionTypeLabel(question.questionType)}</span>
                      {question.options && question.options.length > 0 && (
                        <>
                          <span className="text-slate-600">|</span>
                          <span>{question.options.length} options</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRequired(question)}
                      className={`
                        p-2 rounded-lg transition-colors
                        ${question.isRequired ? 'bg-red-500/20 text-red-400' : 'hover:bg-slate-700 text-slate-400'}
                      `}
                      title={question.isRequired ? 'Make optional' : 'Make required'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleToggleActive(question)}
                      className={`
                        p-2 rounded-lg transition-colors
                        ${question.isActive ? 'hover:bg-slate-700 text-green-400' : 'hover:bg-slate-700 text-slate-500'}
                      `}
                      title={question.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {question.isActive ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        )}
                      </svg>
                    </button>
                    <button
                      onClick={() => openEditModal(question)}
                      className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(question)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add/Edit Question Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingQuestion ? 'Edit Question' : 'Add Question'}
        description={editingQuestion ? 'Update the question details' : 'Create a new check-in form question'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Question"
            value={formData.question}
            onChange={(e) => setFormData((prev) => ({ ...prev, question: e.target.value }))}
            placeholder="What would you like to ask?"
          />

          <Select
            label="Question Type"
            value={formData.questionType}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                questionType: e.target.value as CheckinQuestionType,
              }))
            }
            options={QUESTION_TYPE_OPTIONS}
          />

          {needsOptions && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Options</label>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="flex-1"
                    />
                    {formData.options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleAddOption}>
                + Add Option
              </Button>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData((prev) => ({ ...prev, isRequired: e.target.checked }))}
                className="peer sr-only"
              />
              <div
                className={`
                  w-5 h-5 rounded-md border-2 border-slate-600 bg-slate-800/50
                  transition-all duration-200
                  peer-checked:bg-purple-600 peer-checked:border-purple-600
                `}
              />
              <svg
                className="absolute top-0.5 left-0.5 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-200">Required question</span>
          </label>

          {formError && <p className="text-sm text-red-400">{formError}</p>}
        </div>

        <ModalFooter>
          <Button variant="ghost" onClick={closeModal} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editingQuestion ? 'Save Changes' : 'Add Question'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
