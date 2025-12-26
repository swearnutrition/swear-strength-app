'use client'

import { useState, useEffect } from 'react'
import { HabitTemplate, HabitCategory, categoryLabels, categoryColors } from './HabitsClient'

type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'times_per_week' | 'specific_days' | 'biweekly'

interface HabitModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (habit: Partial<HabitTemplate>) => void
  habit: HabitTemplate | null
}

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function HabitModal({ isOpen, onClose, onSave, habit }: HabitModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<HabitCategory | ''>('')
  const [frequency, setFrequency] = useState<HabitFrequency>('daily')
  const [timesPerWeek, setTimesPerWeek] = useState<number>(3)
  const [specificDays, setSpecificDays] = useState<number[]>([])
  const [hasTarget, setHasTarget] = useState(false)
  const [targetValue, setTargetValue] = useState<string>('')
  const [targetUnit, setTargetUnit] = useState('')

  useEffect(() => {
    if (habit) {
      setName(habit.name)
      setDescription(habit.description || '')
      setCategory(habit.category || '')
      setFrequency(habit.frequency)
      setTimesPerWeek(habit.times_per_week || 3)
      setSpecificDays(habit.specific_days || [])
      setHasTarget(!!habit.target_value)
      setTargetValue(habit.target_value?.toString() || '')
      setTargetUnit(habit.target_unit || '')
    } else {
      setName('')
      setDescription('')
      setCategory('')
      setFrequency('daily')
      setTimesPerWeek(3)
      setSpecificDays([])
      setHasTarget(false)
      setTargetValue('')
      setTargetUnit('')
    }
  }, [habit, isOpen])

  const toggleDay = (day: number) => {
    setSpecificDays(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) return

    onSave({
      name: name.trim(),
      description: description.trim() || null,
      category: category || null,
      frequency,
      times_per_week: frequency === 'times_per_week' ? timesPerWeek : null,
      specific_days: frequency === 'specific_days' ? specificDays : null,
      target_value: hasTarget && targetValue ? parseFloat(targetValue) : null,
      target_unit: hasTarget && targetUnit ? targetUnit.trim() : null,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {habit ? 'Edit Habit Template' : 'New Habit Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Drink water, Take vitamins, Stretch"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              autoFocus
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
              placeholder="Optional notes or instructions..."
              rows={2}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {(['nutrition', 'fitness', 'sleep', 'mindset', 'lifestyle', 'tracking'] as HabitCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(category === cat ? '' : cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    category === cat
                      ? categoryColors[cat]
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
              <option value="times_per_week">X times per week (flexible)</option>
              <option value="specific_days">Specific days of the week</option>
            </select>
          </div>

          {/* Times per week input */}
          {frequency === 'times_per_week' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Times per week
              </label>
              <input
                type="number"
                min={1}
                max={7}
                value={timesPerWeek}
                onChange={(e) => setTimesPerWeek(parseInt(e.target.value) || 1)}
                className="w-32 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
              <p className="mt-2 text-sm text-slate-500">
                Client can complete on any {timesPerWeek} days of the week.
              </p>
            </div>
          )}

          {/* Specific days picker */}
          {frequency === 'specific_days' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select days
              </label>
              <div className="flex gap-2 flex-wrap">
                {dayLabels.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleDay(index)}
                    className={`w-12 h-12 rounded-xl font-medium transition-all ${
                      specificDays.includes(index)
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {specificDays.length === 0 && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Select at least one day.
                </p>
              )}
            </div>
          )}

          {/* Target toggle */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Track a target value
                </label>
                <p className="text-sm text-slate-500">
                  e.g., 150g protein, 8 glasses of water, 10,000 steps
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHasTarget(!hasTarget)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  hasTarget ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    hasTarget ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {hasTarget && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Target value
                  </label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="150"
                    step="any"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="grams, glasses, steps..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-3 px-4 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || (frequency === 'specific_days' && specificDays.length === 0)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium py-3 px-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {habit ? 'Save Changes' : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
