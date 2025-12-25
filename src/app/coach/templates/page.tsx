'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { TemplateModal } from './TemplateModal'
import { BlockModal } from './BlockModal'
import type { ExerciseBlock } from '../programs/[id]/types'

type TabType = 'warmup' | 'cooldown' | 'blocks'

interface RoutineTemplate {
  id: string
  name: string
  type: 'warmup' | 'cooldown'
  description: string | null
  duration_minutes: number | null
  is_archived: boolean
  created_at: string
  exercise_count?: number
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<RoutineTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('warmup')
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<RoutineTemplate | null>(null)
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)
  const [blockModalOpen, setBlockModalOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<ExerciseBlock | null>(null)

  const supabase = createClient()

  const fetchTemplates = useCallback(async () => {
    setLoading(true)

    // Fetch templates with exercise count
    const { data, error } = await supabase
      .from('routine_templates')
      .select(`
        *,
        routine_template_exercises(count)
      `)
      .eq('type', activeTab)
      .eq('is_archived', false)
      .order('name')

    if (error) {
      console.error('Error fetching templates:', error)
    } else {
      const templatesWithCount = (data || []).map((t) => ({
        ...t,
        exercise_count: t.routine_template_exercises?.[0]?.count || 0,
      }))
      setTemplates(templatesWithCount)
    }
    setLoading(false)
  }, [supabase, activeTab])

  const fetchBlocks = useCallback(async () => {
    setLoadingBlocks(true)
    const { data, error } = await supabase
      .from('exercise_blocks')
      .select(`
        *,
        exercise_block_items(count)
      `)
      .order('name')

    if (error) {
      console.error('Error fetching blocks:', error)
    } else {
      const blocksWithCount = (data || []).map((b) => ({
        ...b,
        exercise_count: b.exercise_block_items?.[0]?.count || 0,
      }))
      setBlocks(blocksWithCount)
    }
    setLoadingBlocks(false)
  }, [supabase])

  useEffect(() => {
    if (activeTab === 'blocks') {
      fetchBlocks()
    } else {
      fetchTemplates()
    }
  }, [activeTab, fetchBlocks, fetchTemplates])

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    const { error } = await supabase
      .from('routine_templates')
      .update({ is_archived: true })
      .eq('id', id)

    if (error) {
      console.error('Error archiving template:', error)
    } else {
      fetchTemplates()
    }
  }

  const handleEdit = (template: RoutineTemplate) => {
    setEditingTemplate(template)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingTemplate(null)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingTemplate(null)
  }

  const handleModalSave = () => {
    fetchTemplates()
    handleModalClose()
  }

  const handleDeleteBlock = async (id: string) => {
    if (!confirm('Are you sure you want to delete this block?')) return

    const { error } = await supabase
      .from('exercise_blocks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting block:', error)
    } else {
      fetchBlocks()
    }
  }

  const handleEditBlock = async (block: ExerciseBlock) => {
    // Fetch block with items
    const { data } = await supabase
      .from('exercise_blocks')
      .select(`*, exercise_block_items(*, exercise:exercises(*))`)
      .eq('id', block.id)
      .single()

    if (data) {
      setEditingBlock(data)
      setBlockModalOpen(true)
    }
  }

  const handleBlockModalClose = () => {
    setBlockModalOpen(false)
    setEditingBlock(null)
  }

  const handleBlockModalSave = () => {
    fetchBlocks()
    handleBlockModalClose()
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/coach" className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                {activeTab === 'blocks' ? 'Saved Blocks' : 'Warmup & Cooldown Templates'}
              </h1>
            </div>
            {activeTab === 'blocks' ? (
              <button
                onClick={() => { setEditingBlock(null); setBlockModalOpen(true) }}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Block
              </button>
            ) : (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-xl transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Template
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('warmup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'warmup'
                ? 'bg-orange-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
            Warmup
          </button>
          <button
            onClick={() => setActiveTab('cooldown')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'cooldown'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            Cooldown
          </button>
          <button
            onClick={() => setActiveTab('blocks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === 'blocks'
                ? 'bg-purple-500 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Blocks
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'blocks' ? (
          // Blocks content
          <>
            {/* Search for blocks */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search blocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Block Count */}
            <p className="text-slate-500 text-sm mb-4">
              {blocks.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).length} block{blocks.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).length !== 1 ? 's' : ''}
            </p>

            {/* Blocks Grid */}
            {loadingBlocks ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : blocks.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="text-slate-500 dark:text-slate-400">No saved blocks found</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
                  Save exercise groups from the Program Builder
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {blocks
                  .filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((block) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      onEdit={() => handleEditBlock(block)}
                      onDelete={() => handleDeleteBlock(block.id)}
                    />
                  ))}
              </div>
            )}
          </>
        ) : (
          // Templates content
          <>
            {/* Search */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-12 pr-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Template Count */}
            <p className="text-slate-500 text-sm mb-4">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            </p>

            {/* Templates Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  {activeTab === 'warmup' ? (
                    <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-slate-400 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </div>
                <p className="text-slate-500 dark:text-slate-400">No {activeTab} templates found</p>
                <button
                  onClick={handleAdd}
                  className="mt-4 text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 font-medium"
                >
                  Create your first {activeTab} template
                </button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => handleEdit(template)}
                    onDelete={() => handleDelete(template.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal */}
      {modalOpen && activeTab !== 'blocks' && (
        <TemplateModal
          template={editingTemplate}
          type={activeTab}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}

      {/* Block Modal */}
      {blockModalOpen && (
        <BlockModal
          block={editingBlock}
          onClose={handleBlockModalClose}
          onSave={handleBlockModalSave}
        />
      )}
    </div>
  )
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: RoutineTemplate
  onEdit: () => void
  onDelete: () => void
}) {
  const isWarmup = template.type === 'warmup'

  return (
    <div
      className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          isWarmup
            ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
            : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
        }`}>
          {isWarmup ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{template.name}</h3>

      {template.description && (
        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 mb-3">{template.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500 dark:text-slate-400">
          {template.exercise_count || 0} exercise{(template.exercise_count || 0) !== 1 ? 's' : ''}
        </span>
        {template.duration_minutes && (
          <span className="text-slate-500 dark:text-slate-400">
            ~{template.duration_minutes} min
          </span>
        )}
      </div>
    </div>
  )
}

interface ExerciseBlockWithCount extends ExerciseBlock {
  exercise_count?: number
}

function BlockCard({
  block,
  onEdit,
  onDelete,
}: {
  block: ExerciseBlockWithCount
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all group shadow-sm cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{block.name}</h3>

      {block.description && (
        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 mb-3">{block.description}</p>
      )}

      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500 dark:text-slate-400">
          {block.exercise_count || 0} exercise{(block.exercise_count || 0) !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}
