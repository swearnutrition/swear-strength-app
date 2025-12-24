'use client'

import { useState, useCallback } from 'react'
import type { Program, WorkoutDay, ProgramWeek } from '../types'

export function useProgramState(initialProgram: Program) {
  const [program, setProgram] = useState(initialProgram)
  const [saving, setSaving] = useState(false)

  const updateDay = useCallback((dayId: string, updatedDay: WorkoutDay) => {
    setProgram(p => ({
      ...p,
      program_weeks: p.program_weeks.map(week => ({
        ...week,
        workout_days: week.workout_days.map(day =>
          day.id === dayId ? updatedDay : day
        ),
      })),
    }))
  }, [])

  const updateWeek = useCallback((weekId: string, updates: Partial<ProgramWeek>) => {
    setProgram(p => ({
      ...p,
      program_weeks: p.program_weeks.map(week =>
        week.id === weekId ? { ...week, ...updates } : week
      ),
    }))
  }, [])

  const findDayById = useCallback((dayId: string): { day: WorkoutDay; weekIndex: number; dayIndex: number } | null => {
    for (let wi = 0; wi < program.program_weeks.length; wi++) {
      for (let di = 0; di < program.program_weeks[wi].workout_days.length; di++) {
        if (program.program_weeks[wi].workout_days[di].id === dayId) {
          return {
            day: program.program_weeks[wi].workout_days[di],
            weekIndex: wi,
            dayIndex: di,
          }
        }
      }
    }
    return null
  }, [program])

  return {
    program,
    setProgram,
    saving,
    setSaving,
    updateDay,
    updateWeek,
    findDayById,
  }
}

export type ProgramStateHook = ReturnType<typeof useProgramState>
