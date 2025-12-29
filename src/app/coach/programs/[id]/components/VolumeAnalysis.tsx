'use client'

import React, { useMemo, useState } from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from 'recharts'
import type { Program } from '../types'

interface VolumeAnalysisProps {
  program: Program
  onClose: () => void
}

type ViewMode = 'strength' | 'mobility'
type SortField = 'muscle' | 'sets'
type SortDir = 'asc' | 'desc'

// Normalize muscle names for radar chart grouping
function normalizeMuscle(muscle: string): string {
  const m = muscle.toLowerCase().trim()
  const mappings: Record<string, string> = {
    'pectorals': 'chest', 'pecs': 'chest', 'chest': 'chest',
    'deltoids': 'shoulders', 'delts': 'shoulders', 'shoulders': 'shoulders',
    'front delts': 'shoulders', 'side delts': 'shoulders',
    'rear delts': 'back', 'posterior deltoids': 'back',
    'lats': 'back', 'latissimus': 'back', 'back': 'back',
    'upper back': 'back', 'rhomboids': 'back', 'traps': 'back', 'trapezius': 'back',
    'quads': 'legs', 'quadriceps': 'legs', 'hamstrings': 'legs', 'hams': 'legs',
    'glutes': 'legs', 'gluteus': 'legs', 'calves': 'legs', 'gastrocnemius': 'legs',
    'adductors': 'legs', 'abductors': 'legs',
    'abs': 'core', 'abdominals': 'core', 'core': 'core', 'obliques': 'core',
    'lower back': 'core', 'erectors': 'core', 'spinal erectors': 'core',
    'biceps': 'arms', 'triceps': 'arms', 'forearms': 'arms', 'grip': 'arms',
  }
  return mappings[m] || m
}

// Get display name for muscle
function getDisplayName(muscle: string): string {
  // Replace underscores with spaces and normalize
  const m = muscle.toLowerCase().replace(/_/g, ' ').trim()
  const mappings: Record<string, string> = {
    'pectorals': 'Chest', 'pecs': 'Chest', 'chest': 'Chest',
    'deltoids': 'Shoulders', 'delts': 'Shoulders', 'shoulders': 'Shoulders',
    'front delts': 'Shoulders', 'side delts': 'Shoulders',
    'rear delts': 'Rear Delts', 'posterior deltoids': 'Rear Delts',
    'lateral delts': 'Lateral Delts',
    'lats': 'Lats', 'latissimus': 'Lats',
    'back': 'Back', 'upper back': 'Upper Back', 'rhomboids': 'Rhomboids',
    'traps': 'Traps', 'trapezius': 'Traps',
    'quads': 'Quads', 'quadriceps': 'Quads',
    'hamstrings': 'Hamstrings', 'hams': 'Hamstrings',
    'glutes': 'Glutes', 'gluteus': 'Glutes',
    'glute medius': 'Glute Medius',
    'calves': 'Calves', 'gastrocnemius': 'Calves',
    'adductors': 'Adductors', 'abductors': 'Abductors',
    'abs': 'Abdominals', 'abdominals': 'Abdominals', 'core': 'Core',
    'obliques': 'Obliques',
    'lower back': 'Lower Back', 'erectors': 'Lower Back', 'spinal erectors': 'Lower Back',
    'upper chest': 'Upper Chest',
    'biceps': 'Biceps', 'triceps': 'Triceps', 'forearms': 'Forearms', 'grip': 'Forearms',
  }
  // Return mapped name or convert to title case (capitalize each word)
  return mappings[m] || m.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

// Format focus area names (converts snake_case to Title Case)
function formatFocusArea(focus: string): string {
  // Replace underscores with spaces and capitalize each word
  return focus
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Normalize mobility focus areas for radar chart grouping
function normalizeMobilityFocus(focus: string): string {
  const f = focus.toLowerCase().replace(/_/g, ' ').trim()

  // Map to mobility-specific categories
  if (f.includes('spine') || f.includes('lumbar') || f.includes('thoracic') || f.includes('cervical')) {
    return 'spine'
  }
  if (f.includes('hip') || f.includes('glute') || f.includes('piriformis') || f.includes('psoas')) {
    return 'hips'
  }
  if (f.includes('shoulder') || f.includes('rotator') || f.includes('scapula')) {
    return 'shoulders'
  }
  if (f.includes('ankle') || f.includes('calf') || f.includes('achilles') || f.includes('foot')) {
    return 'ankles'
  }
  if (f.includes('knee') || f.includes('quad') || f.includes('hamstring') || f.includes('it band')) {
    return 'knees'
  }
  if (f.includes('wrist') || f.includes('elbow') || f.includes('forearm') || f.includes('arm')) {
    return 'arms'
  }

  return 'other'
}

// Parse sets string to number
function parseSets(setsStr: string | null): number {
  if (!setsStr) return 0
  const cleaned = setsStr.trim()
  if (cleaned.includes('-')) {
    const [min, max] = cleaned.split('-').map(s => parseInt(s.trim()))
    return (min + max) / 2
  }
  return parseInt(cleaned) || 0
}

export function VolumeAnalysis({ program, onClose }: VolumeAnalysisProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('strength')
  const [sortField, setSortField] = useState<SortField>('muscle')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Calculate strength data
  const strengthData = useMemo(() => {
    const muscleMap = new Map<string, number>()
    const radarMap = new Map<string, number>()
    let totalExercises = 0
    let totalSets = 0

    for (const week of program.program_weeks) {
      for (const day of week.workout_days) {
        if (day.is_rest_day) continue

        for (const we of day.workout_exercises) {
          // Only count strength section
          if (we.section !== 'strength') continue

          const exercise = we.exercise
          if (!exercise) continue

          const sets = parseSets(we.sets)
          if (sets === 0) continue

          totalExercises++
          totalSets += sets

          // Count primary muscle (full sets)
          if (exercise.primary_muscle) {
            const displayName = getDisplayName(exercise.primary_muscle)
            const radarGroup = normalizeMuscle(exercise.primary_muscle)

            muscleMap.set(displayName, (muscleMap.get(displayName) || 0) + sets)
            radarMap.set(radarGroup, (radarMap.get(radarGroup) || 0) + sets)
          }

          // Count secondary muscles (half sets)
          if (exercise.muscle_groups) {
            for (const muscle of exercise.muscle_groups) {
              if (exercise.primary_muscle &&
                  normalizeMuscle(muscle) === normalizeMuscle(exercise.primary_muscle)) {
                continue
              }

              const displayName = getDisplayName(muscle)
              const radarGroup = normalizeMuscle(muscle)

              muscleMap.set(displayName, (muscleMap.get(displayName) || 0) + sets * 0.5)
              radarMap.set(radarGroup, (radarMap.get(radarGroup) || 0) + sets * 0.5)
            }
          }
        }
      }
    }

    const muscleList = Array.from(muscleMap.entries())
      .map(([muscle, sets]) => ({ muscle, sets: Math.round(sets) }))

    const radarGroups = ['Core', 'Shoulders', 'Arms', 'Legs', 'Back', 'Chest']
    const radarData = radarGroups.map(group => ({
      subject: group,
      value: Math.round(radarMap.get(group.toLowerCase()) || 0),
      fullMark: Math.max(...Array.from(radarMap.values()), 1),
    }))

    return { muscleList, radarData, totalExercises, totalSets }
  }, [program])

  // Calculate mobility data (warmup + cooldown)
  const mobilityData = useMemo(() => {
    const focusMap = new Map<string, number>()
    const radarMap = new Map<string, number>()
    let totalExercises = 0

    for (const week of program.program_weeks) {
      for (const day of week.workout_days) {
        if (day.is_rest_day) continue

        for (const we of day.workout_exercises) {
          // Only count warmup and cooldown sections
          if (we.section !== 'warmup' && we.section !== 'cooldown') continue

          const exercise = we.exercise
          if (!exercise) continue

          totalExercises++

          // Use focus_area for mobility exercises, fall back to primary_muscle
          const target = exercise.focus_area || exercise.primary_muscle
          if (target) {
            // Format for display (converts snake_case to Title Case)
            const displayName = formatFocusArea(target)
            focusMap.set(displayName, (focusMap.get(displayName) || 0) + 1)

            // Normalize for radar chart
            const radarGroup = normalizeMobilityFocus(target)
            radarMap.set(radarGroup, (radarMap.get(radarGroup) || 0) + 1)
          }
        }
      }
    }

    const focusList = Array.from(focusMap.entries())
      .map(([focus, count]) => ({ muscle: focus, sets: count }))

    // Mobility-specific radar categories
    const radarGroups = ['Spine', 'Hips', 'Shoulders', 'Knees', 'Ankles', 'Arms']
    const radarData = radarGroups.map(group => ({
      subject: group,
      value: Math.round(radarMap.get(group.toLowerCase()) || 0),
      fullMark: Math.max(...Array.from(radarMap.values()), 1),
    }))

    return { muscleList: focusList, radarData, totalExercises }
  }, [program])

  const currentData = viewMode === 'strength' ? strengthData : mobilityData
  const { muscleList, radarData, totalExercises } = currentData
  const totalSets = viewMode === 'strength' ? strengthData.totalSets : 0

  // Sort muscle list
  const sortedMuscles = useMemo(() => {
    return [...muscleList].sort((a, b) => {
      if (sortField === 'muscle') {
        return sortDir === 'asc'
          ? a.muscle.localeCompare(b.muscle)
          : b.muscle.localeCompare(a.muscle)
      }
      return sortDir === 'asc' ? a.sets - b.sets : b.sets - a.sets
    })
  }, [muscleList, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'muscle' ? 'asc' : 'desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>
    return <span className="text-purple-500 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Summary
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setViewMode('strength')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              viewMode === 'strength'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Strength
          </button>
          <button
            onClick={() => setViewMode('mobility')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              viewMode === 'mobility'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Mobility
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {muscleList.length === 0 ? (
            <div className="text-center py-12 px-5">
              <p className="text-slate-500 dark:text-slate-400">
                No {viewMode} exercises found
              </p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                Add exercises to see breakdown
              </p>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between py-2">
                  <span className="text-slate-600 dark:text-slate-400">Total Exercises</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{totalExercises}</span>
                </div>
                {viewMode === 'strength' && (
                  <div className="flex justify-between py-2">
                    <span className="text-slate-600 dark:text-slate-400">Total Sets</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{totalSets}</span>
                  </div>
                )}
              </div>

              {/* Radar Chart Section */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                  {viewMode === 'strength' ? 'Muscle Distribution' : 'Focus Area Distribution'}
                </h3>
                <div style={{ width: '100%', height: 250 }}>
                  <ResponsiveContainer>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: '#64748b', fontSize: 12 }}
                      />
                      <Radar
                        name={viewMode === 'strength' ? 'Sets' : 'Exercises'}
                        dataKey="value"
                        stroke="#a78bfa"
                        fill="#a78bfa"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table Section */}
              <div className="px-5 py-4 pb-8">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  {viewMode === 'strength' ? 'Set Count Per Muscle Group' : 'Exercise Count Per Focus Area'}
                </h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th
                        className="py-2 text-left font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:text-purple-600"
                        onClick={() => handleSort('muscle')}
                      >
                        {viewMode === 'strength' ? 'Muscle Group' : 'Focus Area'} <SortIcon field="muscle" />
                      </th>
                      <th
                        className="py-2 text-right font-medium text-slate-600 dark:text-slate-400 cursor-pointer hover:text-purple-600"
                        onClick={() => handleSort('sets')}
                      >
                        {viewMode === 'strength' ? 'Sets' : 'Count'} <SortIcon field="sets" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMuscles.map((item, idx) => (
                      <tr
                        key={item.muscle}
                        className={idx % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/30' : ''}
                      >
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">
                          {item.muscle}
                        </td>
                        <td className="py-2.5 text-right text-slate-900 dark:text-white font-medium">
                          {item.sets}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
