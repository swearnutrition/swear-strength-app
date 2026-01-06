'use client'

import { useState } from 'react'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { MessageTemplate } from '@/hooks/useMessageTemplates'

interface ManageTemplatesModalProps {
  isOpen: boolean
  onClose: () => void
  templates: MessageTemplate[]
  loading: boolean
  onCreate: (name: string, content: string) => Promise<MessageTemplate | null>
  onUpdate: (id: string, updates: { name?: string; content?: string }) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

type ViewMode = 'list' | 'create' | 'edit'

export function ManageTemplatesModal({
  isOpen,
  onClose,
  templates,
  loading,
  onCreate,
  onUpdate,
  onDelete,
}: ManageTemplatesModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setContent('')
    setEditingTemplate(null)
    setViewMode('list')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleCreate = async () => {
    if (!name.trim() || !content.trim()) return

    setSaving(true)
    const result = await onCreate(name.trim(), content.trim())
    setSaving(false)

    if (result) {
      resetForm()
    }
  }

  const handleUpdate = async () => {
    if (!editingTemplate || !name.trim() || !content.trim()) return

    setSaving(true)
    const success = await onUpdate(editingTemplate.id, {
      name: name.trim(),
      content: content.trim(),
    })
    setSaving(false)

    if (success) {
      resetForm()
    }
  }

  const handleDelete = async (id: string) => {
    setDeleting(id)
    await onDelete(id)
    setDeleting(null)
  }

  const startEdit = (template: MessageTemplate) => {
    setEditingTemplate(template)
    setName(template.name)
    setContent(template.content)
    setViewMode('edit')
  }

  const startCreate = () => {
    resetForm()
    setViewMode('create')
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        viewMode === 'list'
          ? 'Message Templates'
          : viewMode === 'create'
          ? 'Create Template'
          : 'Edit Template'
      }
      size="lg"
    >
      {viewMode === 'list' ? (
        <>
          {/* Templates list */}
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-slate-700"
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
                <p className="text-sm">No templates yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Create your first template to get started
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white truncate">
                          {template.name}
                        </h4>
                        <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                          {template.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(template)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          disabled={deleting === template.id}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === template.id ? (
                            <svg
                              className="animate-spin w-4 h-4"
                              viewBox="0 0 24 24"
                            >
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
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={handleClose}>
              Close
            </Button>
            <Button onClick={startCreate}>Create Template</Button>
          </ModalFooter>
        </>
      ) : (
        <>
          {/* Create/Edit form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Template Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Weekly Check-in"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Message Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Hey {firstname}, just checking in on your progress this week..."
                rows={5}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Available variables: <code className="text-purple-400">{'{firstname}'}</code>,{' '}
                <code className="text-purple-400">{'{name}'}</code>
              </p>
            </div>
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={viewMode === 'create' ? handleCreate : handleUpdate}
              disabled={!name.trim() || !content.trim() || saving}
            >
              {saving
                ? 'Saving...'
                : viewMode === 'create'
                ? 'Create Template'
                : 'Save Changes'}
            </Button>
          </ModalFooter>
        </>
      )}
    </Modal>
  )
}
