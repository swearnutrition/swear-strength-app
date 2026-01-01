'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ScheduleMode = 'scheduled' | 'flexible'
type ReminderThreshold = 2 | 3 | 4 | 7 | null
type Step = 'mode' | 'scheduled' | 'cardio' | 'flexible'

interface WorkoutScheduleModalProps {
  isOpen: boolean
  onClose: () => void
  assignmentId: string
  programName: string
  workoutDaysPerWeek: number
  cardioDaysPerWeek?: number
  currentSchedule?: number[] | null
  currentCardioDays?: number[] | null
  currentMode?: ScheduleMode
  currentThreshold?: ReminderThreshold
  onSave: (data: { mode: ScheduleMode; scheduledDays?: number[]; scheduledCardioDays?: number[]; reminderThreshold?: ReminderThreshold }) => void
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
]

const REMINDER_OPTIONS: { value: ReminderThreshold; label: string; description: string }[] = [
  { value: 2, label: 'After 2 days', description: 'Aggressive accountability' },
  { value: 3, label: 'After 3 days', description: 'Recommended' },
  { value: 4, label: 'After 4 days', description: 'Relaxed' },
  { value: 7, label: 'After 1 week', description: 'Very flexible' },
  { value: null, label: 'No reminders', description: 'Self-paced' },
]

export function WorkoutScheduleModal({
  isOpen,
  onClose,
  assignmentId,
  programName,
  workoutDaysPerWeek,
  cardioDaysPerWeek = 0,
  currentSchedule,
  currentCardioDays,
  currentMode = 'flexible',
  currentThreshold = 3,
  onSave,
}: WorkoutScheduleModalProps) {
  const [step, setStep] = useState<Step>('mode')
  const [mode, setMode] = useState<ScheduleMode>(currentMode)
  const [selectedDays, setSelectedDays] = useState<number[]>(currentSchedule || [])
  const [selectedCardioDays, setSelectedCardioDays] = useState<number[]>(currentCardioDays || [])
  const [reminderThreshold, setReminderThreshold] = useState<ReminderThreshold>(currentThreshold)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const hasCardioDays = cardioDaysPerWeek > 0

  const toggleDay = (dayValue: number) => {
    setSelectedDays(prev => {
      if (prev.includes(dayValue)) {
        return prev.filter(d => d !== dayValue)
      } else {
        return [...prev, dayValue].sort((a, b) => a - b)
      }
    })
  }

  const toggleCardioDay = (dayValue: number) => {
    setSelectedCardioDays(prev => {
      if (prev.includes(dayValue)) {
        return prev.filter(d => d !== dayValue)
      } else {
        return [...prev, dayValue].sort((a, b) => a - b)
      }
    })
  }

  const handleModeSelect = (selectedMode: ScheduleMode) => {
    setMode(selectedMode)
    setStep(selectedMode)
  }

  const handleBack = () => {
    if (step === 'cardio') {
      setStep('scheduled')
    } else {
      setStep('mode')
    }
  }

  const handleNext = () => {
    if (step === 'scheduled' && hasCardioDays) {
      setStep('cardio')
    } else {
      handleSave()
    }
  }

  const handleSave = async () => {
    setSaving(true)

    const updateData: Record<string, unknown> = {
      schedule_mode: mode,
      schedule_set_at: new Date().toISOString(),
    }

    if (mode === 'scheduled') {
      updateData.scheduled_days = selectedDays
      updateData.scheduled_cardio_days = selectedCardioDays.length > 0 ? selectedCardioDays : null
      updateData.reminder_threshold = 7 // Backup threshold for scheduled mode
    } else {
      updateData.scheduled_days = null
      updateData.scheduled_cardio_days = null
      updateData.reminder_threshold = reminderThreshold
    }

    const { error } = await supabase
      .from('user_program_assignments')
      .update(updateData)
      .eq('id', assignmentId)

    setSaving(false)

    if (!error) {
      onSave({
        mode,
        scheduledDays: mode === 'scheduled' ? selectedDays : undefined,
        scheduledCardioDays: mode === 'scheduled' && selectedCardioDays.length > 0 ? selectedCardioDays : undefined,
        reminderThreshold: mode === 'flexible' ? reminderThreshold : undefined,
      })
      onClose()
    }
  }

  if (!isOpen) return null

  const isMinimumMet = selectedDays.length >= workoutDaysPerWeek
  const isCardioMinimumMet = selectedCardioDays.length >= cardioDaysPerWeek

  const getTitle = () => {
    switch (step) {
      case 'mode': return 'Set Up Your Schedule'
      case 'scheduled': return 'Pick Your Workout Days'
      case 'cardio': return 'Pick Your Cardio Days'
      case 'flexible': return 'Reminder Preferences'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              step === 'cardio'
                ? 'bg-orange-100 dark:bg-orange-500/20'
                : 'bg-purple-100 dark:bg-purple-500/20'
            }`}>
              {step === 'cardio' ? (
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {getTitle()}
              </h2>
              <p className="text-sm text-slate-500">{programName}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {step === 'mode' && (
            <div className="space-y-4">
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                How do you want to train?
              </p>

              {/* Scheduled Days Option */}
              <button
                onClick={() => handleModeSelect('scheduled')}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 dark:group-hover:bg-purple-500/30 transition-colors">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Scheduled Days</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      I know which days I&apos;ll work out each week
                    </div>
                  </div>
                </div>
              </button>

              {/* Flexible Option */}
              <button
                onClick={() => handleModeSelect('flexible')}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-500/30 transition-colors">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Flexible</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      I&apos;ll work out when I can
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )}

          {step === 'scheduled' && (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Which days will you do your <span className="font-medium text-purple-600 dark:text-purple-400">strength workouts</span>? Select at least {workoutDaysPerWeek} day{workoutDaysPerWeek !== 1 ? 's' : ''}.
              </p>

              {/* Day selector */}
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = selectedDays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleDay(day.value)}
                      className={`flex flex-col items-center py-3 rounded-xl transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-xs font-medium">{day.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Selected count */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected
                </span>
                {selectedDays.length > 0 && selectedDays.length < workoutDaysPerWeek && (
                  <span className="text-amber-600 dark:text-amber-400">
                    Need {workoutDaysPerWeek - selectedDays.length} more
                  </span>
                )}
                {isMinimumMet && (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Good to go!
                  </span>
                )}
              </div>

              {/* Benefits callout */}
              <div className="bg-purple-50 dark:bg-purple-500/10 rounded-xl p-4">
                <h4 className="font-medium text-purple-900 dark:text-purple-300 text-sm mb-2">What happens:</h4>
                <ul className="text-sm text-purple-700 dark:text-purple-400 space-y-1">
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    See today&apos;s workout on your dashboard
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Get a reminder if you miss a scheduled day
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === 'cardio' && (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Which days will you do <span className="font-medium text-orange-600 dark:text-orange-400">cardio</span>? Select at least {cardioDaysPerWeek} day{cardioDaysPerWeek !== 1 ? 's' : ''}.
              </p>

              {/* Day selector - show which days are already selected for strength */}
              <div className="grid grid-cols-7 gap-2">
                {DAYS_OF_WEEK.map(day => {
                  const isStrengthDay = selectedDays.includes(day.value)
                  const isCardioSelected = selectedCardioDays.includes(day.value)
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleCardioDay(day.value)}
                      className={`flex flex-col items-center py-3 rounded-xl transition-all relative ${
                        isCardioSelected
                          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                          : isStrengthDay
                            ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-xs font-medium">{day.label}</span>
                      {isStrengthDay && !isCardioSelected && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span>Strength day</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-orange-500 rounded" />
                  <span>Cardio day</span>
                </div>
              </div>

              {/* Selected count */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  {selectedCardioDays.length} cardio day{selectedCardioDays.length !== 1 ? 's' : ''} selected
                </span>
                {selectedCardioDays.length > 0 && selectedCardioDays.length < cardioDaysPerWeek && (
                  <span className="text-amber-600 dark:text-amber-400">
                    Need {cardioDaysPerWeek - selectedCardioDays.length} more
                  </span>
                )}
                {isCardioMinimumMet && (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Good to go!
                  </span>
                )}
              </div>

              {/* Info callout */}
              <div className="bg-orange-50 dark:bg-orange-500/10 rounded-xl p-4">
                <p className="text-sm text-orange-700 dark:text-orange-400">
                  Cardio days will appear on your calendar. You can do cardio on the same day as strength training if you want!
                </p>
              </div>
            </div>
          )}

          {step === 'flexible' && (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                When should we nudge you if you haven&apos;t worked out?
              </p>

              {/* Reminder options */}
              <div className="space-y-2">
                {REMINDER_OPTIONS.map(option => {
                  const isSelected = reminderThreshold === option.value
                  return (
                    <button
                      key={option.value ?? 'none'}
                      onClick={() => setReminderThreshold(option.value)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className={`font-medium ${isSelected ? 'text-purple-900 dark:text-purple-300' : 'text-slate-900 dark:text-white'}`}>
                            {option.label}
                          </div>
                          <div className={`text-sm ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {option.description}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Info callout */}
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  {reminderThreshold === null
                    ? "You won't get automatic reminders, but your coach can still check in if you've been inactive for a while."
                    : `We'll send you a friendly reminder if you haven't logged a workout in ${reminderThreshold} days.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex gap-3">
          {step === 'mode' ? (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium rounded-xl transition-colors"
            >
              Skip for now
            </button>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="flex-1 px-4 py-3 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={
                  (step === 'scheduled' && !isMinimumMet) ||
                  (step === 'cardio' && !isCardioMinimumMet) ||
                  saving
                }
                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all"
              >
                {saving ? 'Saving...' : step === 'scheduled' && hasCardioDays ? 'Next' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
