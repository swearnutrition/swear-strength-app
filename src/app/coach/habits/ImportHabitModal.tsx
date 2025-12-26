'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HabitCategory, categoryLabels, categoryColors } from './HabitsClient'

type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'times_per_week' | 'specific_days' | 'biweekly'

interface ParsedHabit {
  name: string
  description?: string
  frequency: HabitFrequency
  times_per_week?: number
  specific_days?: number[]
  target_value?: number
  target_unit?: string
  category?: HabitCategory
}

interface ImportHabitModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (count: number) => void
}

const FORMAT_GUIDE = `# Habit Templates

## Simple habits (one per line)
Drink 8 glasses of water
Take daily vitamins
Morning stretch routine
10 minute meditation

## With frequency
Walk 10000 steps | daily
Meal prep | weekly
Check weight | biweekly
Review goals | monthly

## X times per week (flexible days)
Strength training | 3x/week
Cardio session | 4x/week

## Specific days
Upper body workout | Mon, Wed, Fri
Yoga class | Tue, Thu

## With target values
Protein intake | daily | 150g
Water | daily | 8 glasses
Steps | daily | 10000 steps
Sleep | daily | 8 hours

## Full format
Name | frequency | target | description
Protein intake | daily | 150g | Track protein consumption
Meal prep | weekly | | Prep meals for the week`

const dayMap: Record<string, number> = {
  'sun': 0, 'sunday': 0,
  'mon': 1, 'monday': 1,
  'tue': 2, 'tuesday': 2,
  'wed': 3, 'wednesday': 3,
  'thu': 4, 'thursday': 4,
  'fri': 5, 'friday': 5,
  'sat': 6, 'saturday': 6,
}

// Keywords for auto-detecting category
const categoryKeywords: Record<HabitCategory, string[]> = {
  nutrition: ['protein', 'water', 'eat', 'meal', 'food', 'calories', 'macro', 'vitamin', 'supplement', 'drink', 'diet', 'carb', 'fat', 'fiber', 'vegetable', 'fruit', 'snack', 'sugar', 'alcohol', 'lunch', 'breakfast', 'dinner', 'hydrat'],
  fitness: ['workout', 'exercise', 'train', 'strength', 'cardio', 'stretch', 'warmup', 'warm-up', 'cooldown', 'cool-down', 'gym', 'run', 'walk', 'step', 'squat', 'push', 'pull', 'lift', 'mobility', 'foam', 'yoga', 'active', 'recovery', 'sport'],
  sleep: ['sleep', 'bed', 'wake', 'rest', 'nap', 'screen', 'night', 'morning routine'],
  mindset: ['meditat', 'journal', 'gratitude', 'mindful', 'breath', 'intention', 'goal', 'reflect', 'mental', 'stress', 'anxiety', 'read', 'learn', 'affirmation'],
  lifestyle: ['routine', 'habit', 'prepare', 'plan', 'organize', 'clean', 'tidy', 'schedule', 'grocery', 'shop', 'bag', 'pack', 'limit'],
  tracking: ['track', 'log', 'record', 'weigh', 'measure', 'photo', 'check-in', 'checkin', 'progress', 'review'],
}

function detectCategory(name: string): HabitCategory | undefined {
  const lowerName = name.toLowerCase()

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword)) {
        return category as HabitCategory
      }
    }
  }

  return undefined
}

function parseHabitLine(line: string): ParsedHabit | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null

  const parts = trimmed.split('|').map(p => p.trim())
  const name = parts[0]
  if (!name) return null

  const habit: ParsedHabit = {
    name,
    frequency: 'daily',
    category: detectCategory(name),
  }

  if (parts.length === 1) {
    // Just the name, default to daily
    return habit
  }

  // Check second part for frequency
  const freqPart = parts[1]?.toLowerCase() || ''

  // Check for specific days (Mon, Wed, Fri format)
  const dayMatches = freqPart.match(/\b(sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi)
  if (dayMatches && dayMatches.length > 0) {
    habit.frequency = 'specific_days'
    habit.specific_days = [...new Set(dayMatches.map(d => dayMap[d.toLowerCase()]))].sort()
  }
  // Check for Xx/week format
  else if (/^\d+x\/week$/i.test(freqPart)) {
    habit.frequency = 'times_per_week'
    habit.times_per_week = parseInt(freqPart)
  }
  // Standard frequencies
  else if (freqPart === 'daily') {
    habit.frequency = 'daily'
  } else if (freqPart === 'weekly') {
    habit.frequency = 'weekly'
  } else if (freqPart === 'biweekly') {
    habit.frequency = 'biweekly'
  } else if (freqPart === 'monthly') {
    habit.frequency = 'monthly'
  }

  // Check for target value (e.g., "150g", "8 glasses", "10000 steps")
  const targetPart = parts[2]?.trim()
  if (targetPart) {
    const targetMatch = targetPart.match(/^([\d.]+)\s*(.*)$/)
    if (targetMatch) {
      habit.target_value = parseFloat(targetMatch[1])
      habit.target_unit = targetMatch[2] || undefined
    }
  }

  // Description is the last part
  if (parts.length >= 4 && parts[3]?.trim()) {
    habit.description = parts[3].trim()
  }

  return habit
}

function parseHabits(text: string): ParsedHabit[] {
  const lines = text.split('\n')
  const habits: ParsedHabit[] = []

  for (const line of lines) {
    const habit = parseHabitLine(line)
    if (habit) {
      habits.push(habit)
    }
  }

  return habits
}

export function ImportHabitModal({ isOpen, onClose, onSuccess }: ImportHabitModalProps) {
  const [tab, setTab] = useState<'paste' | 'guide'>('paste')
  const [inputText, setInputText] = useState('')
  const [parsed, setParsed] = useState<ParsedHabit[]>([])
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<'input' | 'review'>('input')
  const supabase = createClient()

  const handleParse = () => {
    const result = parseHabits(inputText)
    setParsed(result)
    if (result.length > 0) {
      setStep('review')
    }
  }

  const handleRemoveHabit = (index: number) => {
    setParsed(prev => prev.filter((_, i) => i !== index))
  }

  const handleImport = async () => {
    if (parsed.length === 0) return
    setImporting(true)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) throw new Error('Not logged in')

      const habitsToInsert = parsed.map(h => ({
        name: h.name,
        description: h.description || null,
        frequency: h.frequency,
        times_per_week: h.times_per_week || null,
        specific_days: h.specific_days || null,
        target_value: h.target_value || null,
        target_unit: h.target_unit || null,
        category: h.category || null,
        created_by: userData.user.id,
      }))

      const { error } = await supabase
        .from('habit_templates')
        .insert(habitsToInsert)

      if (error) throw error

      onSuccess(parsed.length)
      handleClose()
    } catch (err) {
      console.error('Import error:', err)
      alert('Failed to import habits: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setStep('input')
    setInputText('')
    setParsed([])
    onClose()
  }

  if (!isOpen) return null

  const frequencyLabels: Record<HabitFrequency, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    times_per_week: 'Times/Week',
    specific_days: 'Specific Days',
    biweekly: 'Biweekly',
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Import Habit Templates</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'input' ? (
          <>
            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-2">
              <button
                onClick={() => setTab('paste')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'paste'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                Paste Habits
              </button>
              <button
                onClick={() => setTab('guide')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === 'guide'
                    ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'
                }`}
              >
                Format Guide
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              {tab === 'paste' ? (
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your habits here (one per line)..."
                  className="w-full h-80 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                />
              ) : (
                <div className="bg-slate-800 rounded-lg p-4 overflow-auto">
                  <pre className="text-sm text-slate-300 whitespace-pre-wrap">{FORMAT_GUIDE}</pre>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!inputText.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Parse Habits
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Review Step */}
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4">
                <span className="text-sm text-slate-500">
                  {parsed.length} habit{parsed.length !== 1 ? 's' : ''} found
                </span>
              </div>

              <div className="space-y-2">
                {parsed.map((habit, index) => (
                  <div
                    key={index}
                    className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium text-slate-900 dark:text-white">{habit.name}</span>
                        {habit.category && (
                          <span className={`text-xs px-2 py-0.5 rounded ${categoryColors[habit.category]}`}>
                            {categoryLabels[habit.category]}
                          </span>
                        )}
                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                          {habit.frequency === 'times_per_week'
                            ? `${habit.times_per_week}x/week`
                            : habit.frequency === 'specific_days'
                            ? habit.specific_days?.map(d => dayLabels[d]).join(', ')
                            : frequencyLabels[habit.frequency]}
                        </span>
                        {habit.target_value && (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            {habit.target_value} {habit.target_unit}
                          </span>
                        )}
                      </div>
                      {habit.description && (
                        <p className="text-sm text-slate-500">{habit.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveHabit(index)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {parsed.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-500">No habits to import. Go back and add some.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between flex-shrink-0">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={parsed.length === 0 || importing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? 'Importing...' : `Import ${parsed.length} Habit${parsed.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
