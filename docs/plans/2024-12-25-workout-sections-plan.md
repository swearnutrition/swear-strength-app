# Workout Sections & Template Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add collapsible warmup/strength/cooldown sections to WorkoutCard with template import, and add a Blocks tab to the Templates page.

**Architecture:** Refactor WorkoutCard to render three collapsible sections. Each section filters exercises by `section` field and has its own search input. Warmup/cooldown searches show templates + exercises; strength shows blocks + exercises. Add Blocks tab to existing Templates page with BlockModal for CRUD.

**Tech Stack:** React, TypeScript, Supabase, Tailwind CSS

---

## Task 1: Add RoutineTemplate Interface to Types

**Files:**
- Modify: `src/app/coach/programs/[id]/types.ts:74-80`

**Step 1: Add RoutineTemplateExercise interface**

In `types.ts`, add after the existing `Template` interface:

```typescript
export interface RoutineTemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  exercise?: Exercise
  sets: string | null
  reps: string | null
  notes: string | null
  sort_order: number
}

export interface RoutineTemplate {
  id: string
  name: string
  type: 'warmup' | 'cooldown'
  description: string | null
  duration_minutes: number | null
  is_archived: boolean
  routine_template_exercises?: RoutineTemplateExercise[]
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to new types

**Step 3: Commit**

```bash
git add src/app/coach/programs/[id]/types.ts
git commit -m "feat: add RoutineTemplate and RoutineTemplateExercise interfaces"
```

---

## Task 2: Add Blocks Tab to Templates Page

**Files:**
- Modify: `src/app/coach/templates/page.tsx`

**Step 1: Add 'blocks' to tab type and state**

At line 8, change:
```typescript
type TemplateType = 'warmup' | 'cooldown'
```
to:
```typescript
type TabType = 'warmup' | 'cooldown' | 'blocks'
```

At line 24, change:
```typescript
const [activeTab, setActiveTab] = useState<TemplateType>('warmup')
```
to:
```typescript
const [activeTab, setActiveTab] = useState<TabType>('warmup')
```

**Step 2: Add blocks state and fetch function**

After line 27 (after `editingTemplate` state), add:

```typescript
const [blocks, setBlocks] = useState<ExerciseBlock[]>([])
const [loadingBlocks, setLoadingBlocks] = useState(false)
```

Add import at top:
```typescript
import type { ExerciseBlock } from '../programs/[id]/types'
```

Add fetch function after `fetchTemplates`:

```typescript
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
```

**Step 3: Update useEffect to fetch blocks**

Change useEffect at line 57-59:
```typescript
useEffect(() => {
  if (activeTab === 'blocks') {
    fetchBlocks()
  } else {
    fetchTemplates()
  }
}, [activeTab, fetchBlocks, fetchTemplates])
```

**Step 4: Add Blocks tab button**

After the Cooldown tab button (around line 156), add:

```typescript
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
```

**Step 5: Update header title and button based on tab**

Change header h1 (line 112):
```typescript
<h1 className="text-xl font-bold text-slate-900 dark:text-white">
  {activeTab === 'blocks' ? 'Saved Blocks' : 'Warmup & Cooldown Templates'}
</h1>
```

Change "New Template" button to conditionally show:
```typescript
{activeTab !== 'blocks' && (
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
```

**Step 6: Verify the page loads without errors**

Run: `npm run dev`
Navigate to `/coach/templates` and click all three tabs.
Expected: Tabs switch, no console errors

**Step 7: Commit**

```bash
git add src/app/coach/templates/page.tsx
git commit -m "feat: add Blocks tab to Templates page"
```

---

## Task 3: Render Blocks Grid on Blocks Tab

**Files:**
- Modify: `src/app/coach/templates/page.tsx`

**Step 1: Add BlockCard component**

After the `TemplateCard` component (around line 311), add:

```typescript
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
```

**Step 2: Add blocks rendering logic in main component**

Find the templates grid section (around line 206-217). Wrap it in a conditional and add blocks grid:

```typescript
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
              onEdit={() => {/* TODO: open block modal */}}
              onDelete={() => handleDeleteBlock(block.id)}
            />
          ))}
      </div>
    )}
  </>
) : (
  // Templates content (existing code)
  <>
    {/* ... existing search, count, and grid ... */}
  </>
)}
```

**Step 3: Add handleDeleteBlock function**

After handleDelete function (around line 78), add:

```typescript
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
```

**Step 4: Verify blocks display**

Run: `npm run dev`
Navigate to `/coach/templates`, click "Blocks" tab
Expected: Shows empty state or existing blocks (if any from Program Builder)

**Step 5: Commit**

```bash
git add src/app/coach/templates/page.tsx
git commit -m "feat: render blocks grid on Blocks tab"
```

---

## Task 4: Create BlockModal Component

**Files:**
- Create: `src/app/coach/templates/BlockModal.tsx`

**Step 1: Create the BlockModal component**

Create new file `src/app/coach/templates/BlockModal.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ExerciseBlock, ExerciseBlockItem, Exercise } from '../programs/[id]/types'

interface BlockModalProps {
  block: (ExerciseBlock & { exercise_block_items?: ExerciseBlockItem[] }) | null
  onClose: () => void
  onSave: () => void
}

export function BlockModal({ block, onClose, onSave }: BlockModalProps) {
  const isEditing = !!block
  const supabase = createClient()

  const [name, setName] = useState(block?.name || '')
  const [description, setDescription] = useState(block?.description || '')
  const [items, setItems] = useState<ExerciseBlockItem[]>(block?.exercise_block_items || [])
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([])
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available strength exercises
  const fetchExercises = useCallback(async () => {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, equipment, muscle_groups, type, primary_muscle, focus_area, video_url')
      .eq('type', 'strength')
      .order('name')

    if (data) setAvailableExercises(data)
  }, [supabase])

  useEffect(() => {
    fetchExercises()
  }, [fetchExercises])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let blockId = block?.id

      if (isEditing && block) {
        // Update existing block
        const { error } = await supabase
          .from('exercise_blocks')
          .update({ name: name.trim(), description: description.trim() || null })
          .eq('id', block.id)

        if (error) throw error

        // Delete existing items and re-insert
        await supabase
          .from('exercise_block_items')
          .delete()
          .eq('block_id', block.id)
      } else {
        // Create new block
        const { data, error } = await supabase
          .from('exercise_blocks')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            created_by: user.id,
          })
          .select()
          .single()

        if (error) throw error
        blockId = data.id
      }

      // Insert items
      if (items.length > 0 && blockId) {
        const itemInserts = items.map((item, index) => ({
          block_id: blockId,
          exercise_id: item.exercise_id,
          label: item.label || null,
          sets: item.sets || null,
          reps: item.reps || null,
          weight: item.weight || null,
          weight_unit: item.weight_unit || null,
          rest_seconds: item.rest_seconds || null,
          rpe: item.rpe || null,
          notes: item.notes || null,
          sort_order: index,
        }))

        const { error } = await supabase
          .from('exercise_block_items')
          .insert(itemInserts)

        if (error) throw error
      }

      onSave()
    } catch (err) {
      console.error('Error saving block:', err)
      setError('Failed to save block. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const addExercise = (exercise: Exercise) => {
    setItems((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        block_id: block?.id || '',
        exercise_id: exercise.id,
        exercise: exercise,
        label: null,
        sets: '3',
        reps: '10',
        weight: null,
        weight_unit: null,
        rest_seconds: null,
        rpe: null,
        notes: null,
        sort_order: prev.length,
      },
    ])
    setShowExercisePicker(false)
    setExerciseSearch('')
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof ExerciseBlockItem, value: string | number | null) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= items.length) return

    setItems((prev) => {
      const newItems = [...prev]
      const temp = newItems[index]
      newItems[index] = newItems[newIndex]
      newItems[newIndex] = temp
      return newItems
    })
  }

  const filteredExercises = availableExercises.filter(
    (ex) =>
      ex.name.toLowerCase().includes(exerciseSearch.toLowerCase()) &&
      !items.some((item) => item.exercise_id === ex.id)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {isEditing ? 'Edit' : 'New'} Exercise Block
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Block Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g., Leg Day Superset, Push Circuit"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional description..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
              />
            </div>

            {/* Exercises */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Exercises
                </label>
                <button
                  type="button"
                  onClick={() => setShowExercisePicker(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Exercise
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No exercises added yet</p>
                  <button
                    type="button"
                    onClick={() => setShowExercisePicker(true)}
                    className="mt-2 text-purple-600 dark:text-purple-400 text-sm font-medium hover:text-purple-500"
                  >
                    Add your first exercise
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start gap-3">
                        {/* Reorder buttons */}
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === items.length - 1}
                            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* Exercise details */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-2">
                            {item.exercise?.name || 'Unknown Exercise'}
                          </h4>
                          <div className="grid grid-cols-5 gap-2">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Label</label>
                              <input
                                type="text"
                                value={item.label || ''}
                                onChange={(e) => updateItem(index, 'label', e.target.value || null)}
                                placeholder="A1"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Sets</label>
                              <input
                                type="text"
                                value={item.sets || ''}
                                onChange={(e) => updateItem(index, 'sets', e.target.value)}
                                placeholder="3"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Reps</label>
                              <input
                                type="text"
                                value={item.reps || ''}
                                onChange={(e) => updateItem(index, 'reps', e.target.value)}
                                placeholder="10"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">RPE</label>
                              <input
                                type="text"
                                value={item.rpe || ''}
                                onChange={(e) => updateItem(index, 'rpe', e.target.value ? Number(e.target.value) : null)}
                                placeholder="8"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Rest</label>
                              <input
                                type="text"
                                value={item.rest_seconds || ''}
                                onChange={(e) => updateItem(index, 'rest_seconds', e.target.value ? Number(e.target.value) : null)}
                                placeholder="90"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-6 py-2 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400"
            >
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Block'}
            </button>
          </div>
        </form>

        {/* Exercise Picker Modal */}
        {showExercisePicker && (
          <div className="absolute inset-0 bg-white dark:bg-slate-900 z-10 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Add Exercise</h3>
              <button
                onClick={() => {
                  setShowExercisePicker(false)
                  setExerciseSearch('')
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  placeholder="Search strength exercises..."
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredExercises.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-500 dark:text-slate-400">No strength exercises found</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filteredExercises.slice(0, 20).map((exercise) => (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => addExercise(exercise)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-purple-500/50 transition-all text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-900 dark:text-white text-sm">{exercise.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{exercise.equipment || 'Bodyweight'}</p>
                      </div>
                      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/coach/templates/BlockModal.tsx
git commit -m "feat: create BlockModal component for editing exercise blocks"
```

---

## Task 5: Wire Up BlockModal in Templates Page

**Files:**
- Modify: `src/app/coach/templates/page.tsx`

**Step 1: Import BlockModal**

At line 6, add:
```typescript
import { BlockModal } from './BlockModal'
```

**Step 2: Add block modal state**

After `editingTemplate` state (around line 27), add:
```typescript
const [blockModalOpen, setBlockModalOpen] = useState(false)
const [editingBlock, setEditingBlock] = useState<ExerciseBlock | null>(null)
```

**Step 3: Add handlers**

After `handleModalSave`, add:
```typescript
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
```

**Step 4: Update BlockCard onEdit**

In the blocks grid, change the onEdit prop:
```typescript
onEdit={() => handleEditBlock(block)}
```

**Step 5: Add "New Block" button when on Blocks tab**

Update the header button section to also show "New Block" when on Blocks tab:
```typescript
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
```

**Step 6: Render BlockModal**

After the TemplateModal render (around line 228), add:
```typescript
{blockModalOpen && (
  <BlockModal
    block={editingBlock}
    onClose={handleBlockModalClose}
    onSave={handleBlockModalSave}
  />
)}
```

**Step 7: Test block creation and editing**

Run: `npm run dev`
1. Go to `/coach/templates`, click "Blocks" tab
2. Click "New Block", create a block with exercises
3. Verify it appears in the grid
4. Click to edit, make changes, save
5. Verify changes persist

**Step 8: Commit**

```bash
git add src/app/coach/templates/page.tsx
git commit -m "feat: wire up BlockModal in Templates page"
```

---

## Task 6: Create WorkoutSection Component

**Files:**
- Create: `src/app/coach/programs/[id]/components/WorkoutSection.tsx`

**Step 1: Create the component**

This is a large component, create `src/app/coach/programs/[id]/components/WorkoutSection.tsx`:

```typescript
'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WorkoutDay, WorkoutExercise, Exercise, ExerciseBlock, RoutineTemplate } from '../types'
import { parseRestInput, formatRestTime } from '../utils/parseRest'

type SectionType = 'warmup' | 'strength' | 'cooldown'

interface ProgramSettings {
  weightUnit: 'lbs' | 'kg'
  effortUnit: 'rpe' | 'rir'
  showWeight: boolean
  showEffort: boolean
  showRest: boolean
  showNotes: boolean
}

interface WorkoutSectionProps {
  section: SectionType
  day: WorkoutDay
  exercises: Exercise[]
  blocks: ExerciseBlock[]
  templates: RoutineTemplate[]
  settings: ProgramSettings
  onUpdate: (day: WorkoutDay) => void
  supabase: ReturnType<typeof createClient>
  onSaveAsBlock?: (exerciseId: string, exerciseName: string, dayExercises: WorkoutExercise[]) => void
}

const sectionConfig = {
  warmup: {
    label: 'Warmup',
    color: 'orange',
    bgClass: 'bg-orange-50 dark:bg-orange-500/10',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-orange-200 dark:border-orange-800',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      </svg>
    ),
  },
  strength: {
    label: 'Strength',
    color: 'purple',
    bgClass: 'bg-purple-50 dark:bg-purple-500/10',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-200 dark:border-purple-800',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
  cooldown: {
    label: 'Cooldown',
    color: 'blue',
    bgClass: 'bg-blue-50 dark:bg-blue-500/10',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-200 dark:border-blue-800',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    ),
  },
}

export function WorkoutSection({
  section,
  day,
  exercises,
  blocks,
  templates,
  settings,
  onUpdate,
  supabase,
  onSaveAsBlock,
}: WorkoutSectionProps) {
  const config = sectionConfig[section]
  const sectionExercises = day.workout_exercises.filter(e => e.section === section)

  const [collapsed, setCollapsed] = useState(sectionExercises.length === 0 && section !== 'strength')
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)
  const [showAddRow, setShowAddRow] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null)

  // Filter templates by section type (warmup templates for warmup section, etc.)
  const sectionTemplates = templates.filter(t =>
    (section === 'warmup' && t.type === 'warmup') ||
    (section === 'cooldown' && t.type === 'cooldown')
  )

  const filteredTemplates = search
    ? sectionTemplates.filter(t => t.name.toLowerCase().includes(search.toLowerCase())).slice(0, 4)
    : []

  const filteredBlocks = search && section === 'strength'
    ? blocks.filter(b => b.name.toLowerCase().includes(search.toLowerCase())).slice(0, 4)
    : []

  const filteredExercises = search
    ? exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : []

  // Debounce timers for auto-save
  const saveTimers = useRef<Record<string, NodeJS.Timeout>>({})

  const saveEx = useCallback(async (id: string, field: string, value: unknown) => {
    await supabase.from('workout_exercises').update({ [field]: value }).eq('id', id)
  }, [supabase])

  const updateEx = useCallback((id: string, field: string, value: unknown) => {
    onUpdate({
      ...day,
      workout_exercises: day.workout_exercises.map(e => e.id === id ? { ...e, [field]: value } : e)
    })

    const timerKey = `${id}-${field}`
    if (saveTimers.current[timerKey]) {
      clearTimeout(saveTimers.current[timerKey])
    }
    saveTimers.current[timerKey] = setTimeout(() => {
      saveEx(id, field, value)
      delete saveTimers.current[timerKey]
    }, 500)
  }, [day, onUpdate, saveEx])

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout)
    }
  }, [])

  const addExercise = async (ex: Exercise) => {
    const maxSortOrder = day.workout_exercises
      .filter(e => e.section === section)
      .reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)

    const { data, error } = await supabase.from('workout_exercises')
      .insert({
        day_id: day.id,
        exercise_id: ex.id,
        section: section,
        sort_order: maxSortOrder + 1,
        sets: section === 'strength' ? '3' : '1',
        reps: section === 'strength' ? '10' : '30s',
      })
      .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
      .single()

    if (error) {
      console.error('Add exercise error:', error)
      alert('Error: ' + error.message)
      return
    }
    if (data) {
      onUpdate({ ...day, workout_exercises: [...day.workout_exercises, data] })
    }
    setSearch('')
    setFocused(false)
    setShowAddRow(false)
  }

  const importTemplate = async (template: RoutineTemplate) => {
    // Fetch template exercises
    const { data: templateExercises, error } = await supabase
      .from('routine_template_exercises')
      .select(`*, exercise:exercises(*)`)
      .eq('template_id', template.id)
      .order('sort_order')

    if (error) {
      console.error('Error fetching template:', error)
      alert('Error importing template')
      return
    }

    if (!templateExercises || templateExercises.length === 0) {
      alert('This template has no exercises')
      return
    }

    const maxSortOrder = day.workout_exercises
      .filter(e => e.section === section)
      .reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)

    const newExercises: WorkoutExercise[] = []

    for (let i = 0; i < templateExercises.length; i++) {
      const te = templateExercises[i]
      const { data, error: insertError } = await supabase.from('workout_exercises')
        .insert({
          day_id: day.id,
          exercise_id: te.exercise_id,
          section: section,
          sort_order: maxSortOrder + 1 + i,
          sets: te.sets || '1',
          reps: te.reps || '30s',
          notes: te.notes,
        })
        .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
        .single()

      if (insertError) {
        console.error('Error inserting exercise:', insertError)
        continue
      }
      if (data) newExercises.push(data)
    }

    if (newExercises.length > 0) {
      onUpdate({ ...day, workout_exercises: [...day.workout_exercises, ...newExercises] })
    }
    setSearch('')
    setFocused(false)
    setShowAddRow(false)
    setCollapsed(false)
  }

  const insertBlock = async (block: ExerciseBlock) => {
    if (!block.exercise_block_items?.length) return

    const maxSortOrder = day.workout_exercises
      .filter(e => e.section === section)
      .reduce((max, e) => Math.max(max, e.sort_order ?? 0), -1)

    const newExercises: WorkoutExercise[] = []

    for (let i = 0; i < block.exercise_block_items.length; i++) {
      const item = block.exercise_block_items[i]
      const { data, error } = await supabase.from('workout_exercises')
        .insert({
          day_id: day.id,
          exercise_id: item.exercise_id,
          section: section,
          sort_order: maxSortOrder + 1 + i,
          label: item.label,
          sets: item.sets || '3',
          reps: item.reps || '10',
          weight: item.weight,
          rest_seconds: item.rest_seconds,
          rpe: item.rpe,
          notes: item.notes,
        })
        .select(`*, exercise:exercises!workout_exercises_exercise_id_fkey (*)`)
        .single()

      if (error) continue
      if (data) newExercises.push(data)
    }

    if (newExercises.length > 0) {
      onUpdate({ ...day, workout_exercises: [...day.workout_exercises, ...newExercises] })
    }
    setSearch('')
    setFocused(false)
    setShowAddRow(false)
  }

  const deleteEx = async (id: string) => {
    if (!confirm('Delete this exercise?')) return
    await supabase.from('workout_exercises').delete().eq('id', id)
    onUpdate({ ...day, workout_exercises: day.workout_exercises.filter(e => e.id !== id) })
  }

  const isStrength = section === 'strength'

  return (
    <div className={`border-t ${config.borderClass}`}>
      {/* Section Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full px-3 py-2 flex items-center justify-between ${config.bgClass} hover:opacity-80 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <span className={config.textClass}>{config.icon}</span>
          <span className={`text-xs font-semibold uppercase tracking-wide ${config.textClass}`}>
            {config.label}
          </span>
          <span className="text-xs text-slate-400">
            ({sectionExercises.length})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Section Content */}
      {!collapsed && (
        <div className="px-3 py-2">
          {sectionExercises.length > 0 ? (
            <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '24px' }} />
                <col />
                <col style={{ width: '40px' }} />
                <col style={{ width: '48px' }} />
                {isStrength && settings.showWeight && <col style={{ width: '48px' }} />}
                {isStrength && settings.showEffort && <col style={{ width: '44px' }} />}
                {isStrength && settings.showRest && <col style={{ width: '48px' }} />}
                <col style={{ width: '24px' }} />
              </colgroup>
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1 text-left">#</th>
                  <th className="py-1 text-left">Exercise</th>
                  <th className="py-1 text-center">Sets</th>
                  <th className="py-1 text-center">{isStrength ? 'Reps' : 'Time'}</th>
                  {isStrength && settings.showWeight && <th className="py-1 text-center">Wt</th>}
                  {isStrength && settings.showEffort && <th className="py-1 text-center">{settings.effortUnit.toUpperCase()}</th>}
                  {isStrength && settings.showRest && <th className="py-1 text-center">Rest</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sectionExercises.map((e, i) => (
                  <tr key={e.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-1 text-slate-400">{e.label || i + 1}</td>
                    <td className="py-1 text-slate-800 dark:text-slate-200 truncate">
                      {e.exercise?.name}
                    </td>
                    <td className="py-1">
                      <input
                        value={e.sets || ''}
                        onChange={ev => updateEx(e.id, 'sets', ev.target.value)}
                        className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                      />
                    </td>
                    <td className="py-1">
                      <input
                        value={e.reps || ''}
                        onChange={ev => updateEx(e.id, 'reps', ev.target.value)}
                        className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                      />
                    </td>
                    {isStrength && settings.showWeight && (
                      <td className="py-1">
                        <input
                          value={e.weight || ''}
                          onChange={ev => updateEx(e.id, 'weight', ev.target.value)}
                          className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                        />
                      </td>
                    )}
                    {isStrength && settings.showEffort && (
                      <td className="py-1">
                        <input
                          value={e.rpe || ''}
                          onChange={ev => updateEx(e.id, 'rpe', ev.target.value ? Number(ev.target.value) : null)}
                          className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                        />
                      </td>
                    )}
                    {isStrength && settings.showRest && (
                      <td className="py-1">
                        <input
                          value={formatRestTime(e.rest_seconds)}
                          onChange={ev => {
                            const seconds = parseRestInput(ev.target.value)
                            updateEx(e.id, 'rest_seconds', seconds)
                          }}
                          className="w-full text-center bg-transparent focus:outline-none text-slate-700 dark:text-slate-300"
                        />
                      </td>
                    )}
                    <td className="py-1">
                      <button
                        onClick={() => deleteEx(e.id)}
                        className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {/* Add row / search */}
          {(showAddRow || search || sectionExercises.length === 0) && (
            <div className="relative mt-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={(ev) => {
                  setFocused(true)
                  const rect = ev.currentTarget.getBoundingClientRect()
                  setDropdownPosition({ top: rect.bottom + 4, left: rect.left })
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setFocused(false)
                    setDropdownPosition(null)
                    if (!search) setShowAddRow(false)
                  }, 200)
                }}
                placeholder={
                  isStrength
                    ? "Search blocks or exercises..."
                    : `Search ${section} templates or exercises...`
                }
                className="w-full text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 focus:outline-none focus:border-purple-400 placeholder-slate-400"
                autoFocus={showAddRow}
              />
              {focused && search && dropdownPosition && (
                <div
                  className="fixed w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto z-50"
                  style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                >
                  {/* Templates (warmup/cooldown only) */}
                  {filteredTemplates.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 sticky top-0">
                        Templates
                      </div>
                      {filteredTemplates.map(template => (
                        <button
                          key={template.id}
                          onMouseDown={ev => {
                            ev.preventDefault()
                            importTemplate(template)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/20 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={config.textClass}>⊞</span>
                            <span className="text-slate-800 dark:text-slate-200 truncate">{template.name}</span>
                          </div>
                          <span className="text-slate-400 text-xs ml-1 flex-shrink-0">
                            {template.duration_minutes ? `~${template.duration_minutes}m` : ''}
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Blocks (strength only) */}
                  {filteredBlocks.length > 0 && (
                    <>
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 sticky top-0">
                        Saved Blocks
                      </div>
                      {filteredBlocks.map(block => (
                        <button
                          key={block.id}
                          onMouseDown={ev => {
                            ev.preventDefault()
                            insertBlock(block)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/20 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-purple-500 text-xs">⊞</span>
                            <span className="text-slate-800 dark:text-slate-200 truncate">{block.name}</span>
                          </div>
                          <span className="text-slate-400 text-xs ml-1 flex-shrink-0">
                            {block.exercise_block_items?.length || 0} ex
                          </span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* Exercises */}
                  {filteredExercises.length > 0 && (
                    <>
                      {(filteredTemplates.length > 0 || filteredBlocks.length > 0) && (
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 sticky top-0">
                          Exercises
                        </div>
                      )}
                      {filteredExercises.map(ex => (
                        <button
                          key={ex.id}
                          onMouseDown={ev => {
                            ev.preventDefault()
                            addExercise(ex)
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/20 flex justify-between items-center border-b border-slate-100 dark:border-slate-700 last:border-0 text-sm"
                        >
                          <span className="text-slate-800 dark:text-slate-200 truncate">{ex.name}</span>
                          <span className="text-slate-400 text-xs ml-1">{ex.equipment || 'BW'}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {/* No results */}
                  {filteredTemplates.length === 0 && filteredBlocks.length === 0 && filteredExercises.length === 0 && (
                    <div className="px-3 py-2 text-slate-400 text-sm">
                      No results found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Add button when section has exercises */}
          {sectionExercises.length > 0 && !showAddRow && !search && (
            <button
              onClick={() => setShowAddRow(true)}
              className="mt-2 w-full py-1 text-xs text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add {isStrength ? 'Exercise' : section === 'warmup' ? 'Warmup' : 'Cooldown'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/coach/programs/[id]/components/WorkoutSection.tsx
git commit -m "feat: create WorkoutSection component with template import"
```

---

## Task 7: Refactor WorkoutCard to Use WorkoutSection

**Files:**
- Modify: `src/app/coach/programs/[id]/components/WorkoutCard.tsx`

**Step 1: Update imports and props**

Add import at top:
```typescript
import type { RoutineTemplate } from '../types'
import { WorkoutSection } from './WorkoutSection'
```

Update WorkoutCardProps interface to include templates:
```typescript
interface WorkoutCardProps {
  day: WorkoutDay
  exercises: Exercise[]
  blocks: ExerciseBlock[]
  templates: RoutineTemplate[]  // ADD THIS
  // ... rest of props
}
```

Update destructuring in function signature:
```typescript
export function WorkoutCard({
  day,
  exercises,
  blocks,
  templates,  // ADD THIS
  // ... rest
}: WorkoutCardProps) {
```

**Step 2: Replace exercise table with WorkoutSection components**

Find the exercise table section (around lines 400-770) and replace the entire `{/* Exercise Table */}` div through `{/* Add Exercise Button */}` with:

```typescript
{/* Workout Sections */}
<WorkoutSection
  section="warmup"
  day={day}
  exercises={exercises}
  blocks={blocks}
  templates={templates}
  settings={settings}
  onUpdate={onUpdate}
  supabase={supabase}
  onSaveAsBlock={onSaveAsBlock}
/>
<WorkoutSection
  section="strength"
  day={day}
  exercises={exercises}
  blocks={blocks}
  templates={templates}
  settings={settings}
  onUpdate={onUpdate}
  supabase={supabase}
  onSaveAsBlock={onSaveAsBlock}
/>
<WorkoutSection
  section="cooldown"
  day={day}
  exercises={exercises}
  blocks={blocks}
  templates={templates}
  settings={settings}
  onUpdate={onUpdate}
  supabase={supabase}
  onSaveAsBlock={onSaveAsBlock}
/>
```

Note: You can remove the old exercise table code, search state, and related functions that are now handled by WorkoutSection.

**Step 3: Update ProgramBuilderClient to pass templates**

In `ProgramBuilderClient.tsx`, the `templates` prop is already received but typed as `unknown[]`. Update to use it.

Add to imports:
```typescript
import type { RoutineTemplate } from './types'
```

Update Props interface:
```typescript
interface Props {
  program: Program
  exercises: Exercise[]
  templates: RoutineTemplate[]
}
```

Update destructuring to include templates:
```typescript
export function ProgramBuilderClient({ program: initialProgram, exercises, templates }: Props) {
```

Pass templates to WorkoutCard:
```typescript
<WorkoutCard
  key={day.id}
  day={day}
  exercises={exercises}
  blocks={blocks}
  templates={templates}  // ADD THIS
  // ... rest of props
/>
```

**Step 4: Update page.tsx to fetch templates with exercises**

In `src/app/coach/programs/[id]/page.tsx`, update the templates fetch to include exercises:

```typescript
// Fetch warmup/cooldown templates with their exercises
const { data: templates } = await supabase
  .from('routine_templates')
  .select(`
    id, name, type, description, duration_minutes, is_archived,
    routine_template_exercises(id, exercise_id, sets, reps, notes, sort_order, exercise:exercises(*))
  `)
  .eq('is_archived', false)
  .order('name')
```

Update the return to cast templates:
```typescript
return (
  <ProgramBuilderClient
    program={sortedProgram}
    exercises={(exercises || []) as Exercise[]}
    templates={(templates || []) as RoutineTemplate[]}
  />
)
```

**Step 5: Verify everything compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Test the full flow**

Run: `npm run dev`
1. Create a warmup template with exercises
2. Go to Program Builder
3. In a workout day, expand Warmup section
4. Search for the template
5. Click to import - exercises should appear
6. Test same for cooldown
7. Test strength section still shows blocks

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: refactor WorkoutCard to use collapsible WorkoutSection components"
```

---

## Task 8: Final Testing and Cleanup

**Step 1: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass (may need to update WorkoutCard tests)

**Step 2: Update WorkoutCard tests**

If tests fail due to missing `templates` prop, update `WorkoutCard.test.tsx`:

Add to mock data:
```typescript
const mockTemplates: RoutineTemplate[] = []
```

Add to renderWorkoutCard:
```typescript
templates={mockTemplates}
```

**Step 3: Manual E2E test**

1. Go to Templates page
2. Create warmup template
3. Create cooldown template
4. Go to Blocks tab, create a block
5. Go to Program Builder
6. Expand Warmup, import template
7. Expand Cooldown, import template
8. In Strength, insert block
9. Verify all exercises appear correctly
10. Verify PDF export shows all sections

**Step 4: Final commit**

```bash
git add -A
git commit -m "test: update WorkoutCard tests for templates prop"
```

---

## Summary

This plan implements:
1. **Types** - RoutineTemplate and RoutineTemplateExercise interfaces
2. **Templates Page Blocks Tab** - View, create, edit, delete exercise blocks
3. **BlockModal** - Full CRUD for exercise blocks
4. **WorkoutSection Component** - Collapsible section with template/block/exercise search
5. **WorkoutCard Refactor** - Three sections (warmup/strength/cooldown)
6. **Template Import** - Copy template exercises into workout day

Total: ~8 tasks, each 15-30 minutes.
