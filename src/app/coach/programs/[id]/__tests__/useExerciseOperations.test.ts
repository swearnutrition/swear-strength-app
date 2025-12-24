import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useExerciseOperations } from '../hooks/useExerciseOperations'
import type { Program, Exercise, WorkoutExercise } from '../types'

// Simple mock that returns chainable methods
function createMockSupabase(overrides: {
  insertResult?: { data: unknown; error: unknown }
  deleteResult?: { data: unknown; error: unknown }
  updateResult?: { data: unknown; error: unknown }
  selectResult?: { data: unknown; error: unknown }
} = {}) {
  const defaultResult = { data: null, error: null }

  // Create a thenable object that also has chainable methods
  const createThenable = (result: { data: unknown; error: unknown }) => {
    const thenable = {
      then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve(result)
        return Promise.resolve(result)
      },
      // Also make it chainable for methods like .select() after .eq()
      select: vi.fn().mockImplementation(() => {
        return Promise.resolve(result)
      }),
    }
    return thenable
  }

  const chainable: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  }

  // Chain all methods to return chainable, except terminal ones
  chainable.from.mockReturnValue(chainable)
  chainable.insert.mockReturnValue(chainable)
  chainable.update.mockReturnValue(chainable)
  chainable.delete.mockReturnValue(chainable)
  chainable.select.mockReturnValue(chainable)

  // eq returns a thenable that also has .select()
  chainable.eq.mockImplementation(() => {
    return createThenable(overrides.updateResult || overrides.selectResult || defaultResult)
  })

  chainable.single.mockImplementation(() => {
    return Promise.resolve(overrides.insertResult || defaultResult)
  })

  return chainable
}

const mockExercise: Exercise = {
  id: 'ex-1',
  name: 'Squat',
  equipment: 'barbell',
  muscle_groups: ['legs'],
  type: 'strength',
  primary_muscle: 'quadriceps',
  focus_area: 'lower',
}

const mockWorkoutExercise: WorkoutExercise = {
  id: 'we-1',
  day_id: 'day-1',
  exercise_id: 'ex-1',
  exercise: mockExercise,
  section: 'strength',
  label: null,
  sets: '3',
  reps: '10',
  weight: '100',
  weight_unit: 'lbs',
  rest_seconds: 90,
  rpe: 8,
  notes: null,
  sort_order: 0,
}

const createMockProgram = (exercises: WorkoutExercise[] = [mockWorkoutExercise]): Program => ({
  id: 'prog-1',
  name: 'Test Program',
  type: 'strength',
  description: null,
  is_indefinite: false,
  is_archived: false,
  created_by: 'user-1',
  program_weeks: [{
    id: 'week-1',
    program_id: 'prog-1',
    week_number: 1,
    name: 'Week 1',
    workout_days: [{
      id: 'day-1',
      week_id: 'week-1',
      day_number: 1,
      name: 'Day 1',
      subtitle: null,
      is_rest_day: false,
      rest_day_notes: null,
      warmup_template_id: null,
      cooldown_template_id: null,
      workout_exercises: exercises,
    }],
  }],
})

describe('useExerciseOperations', () => {
  let mockSetProgram: ReturnType<typeof vi.fn>
  let mockSetSaving: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetProgram = vi.fn()
    mockSetSaving = vi.fn()
  })

  describe('addExercise', () => {
    it('creates exercise with correct sort_order when adding to empty day', async () => {
      const program = createMockProgram([])
      const newExerciseData = {
        id: 'we-new',
        day_id: 'day-1',
        exercise_id: 'ex-1',
        exercise: mockExercise,
        section: 'strength',
        label: null,
        sets: '3',
        reps: '10',
        weight: null,
        weight_unit: null,
        rest_seconds: null,
        rpe: null,
        notes: null,
        sort_order: 0,
      }

      const mockSupabase = createMockSupabase({
        insertResult: { data: newExerciseData, error: null },
      })

      const { result } = renderHook(() =>
        useExerciseOperations({
          program,
          setProgram: mockSetProgram,
          setSaving: mockSetSaving,
          supabase: mockSupabase as unknown as Parameters<typeof useExerciseOperations>[0]['supabase'],
        })
      )

      const newExercise = await act(async () =>
        result.current.addExercise('day-1', mockExercise, [])
      )

      expect(newExercise).not.toBeNull()
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          day_id: 'day-1',
          exercise_id: 'ex-1',
          sort_order: 0,
        })
      )
    })

    it('creates exercise with sort_order = max + 1 when adding to day with existing exercises', async () => {
      const existingExercises: WorkoutExercise[] = [
        { ...mockWorkoutExercise, id: 'we-1', sort_order: 0 },
        { ...mockWorkoutExercise, id: 'we-2', sort_order: 1 },
        { ...mockWorkoutExercise, id: 'we-3', sort_order: 2 },
      ]
      const program = createMockProgram(existingExercises)

      const mockSupabase = createMockSupabase({
        insertResult: { data: { ...mockWorkoutExercise, id: 'we-new', sort_order: 3 }, error: null },
      })

      const { result } = renderHook(() =>
        useExerciseOperations({
          program,
          setProgram: mockSetProgram,
          setSaving: mockSetSaving,
          supabase: mockSupabase as unknown as Parameters<typeof useExerciseOperations>[0]['supabase'],
        })
      )

      await act(async () =>
        result.current.addExercise('day-1', mockExercise, existingExercises)
      )

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          sort_order: 3,
        })
      )
    })

    it('auto-fills sets, reps, rpe, rest from previous exercise', async () => {
      const previousExercise: WorkoutExercise = {
        ...mockWorkoutExercise,
        sets: '5',
        reps: '8',
        rpe: 9,
        rest_seconds: 120,
        weight: '200',
      }
      const program = createMockProgram([previousExercise])

      const mockSupabase = createMockSupabase({
        insertResult: { data: { ...mockWorkoutExercise, id: 'we-new' }, error: null },
      })

      const { result } = renderHook(() =>
        useExerciseOperations({
          program,
          setProgram: mockSetProgram,
          setSaving: mockSetSaving,
          supabase: mockSupabase as unknown as Parameters<typeof useExerciseOperations>[0]['supabase'],
        })
      )

      await act(async () =>
        result.current.addExercise('day-1', mockExercise, [previousExercise])
      )

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          sets: '5',
          reps: '8',
          rpe: 9,
          rest_seconds: 120,
          weight: '200',
        })
      )
    })
  })

  describe('deleteExercise', () => {
    it('deletes exercise and returns true on success', async () => {
      const mockSupabase = createMockSupabase({
        deleteResult: { data: null, error: null },
      })

      const program = createMockProgram()
      const { result } = renderHook(() =>
        useExerciseOperations({
          program,
          setProgram: mockSetProgram,
          setSaving: mockSetSaving,
          supabase: mockSupabase as unknown as Parameters<typeof useExerciseOperations>[0]['supabase'],
        })
      )

      const success = await act(async () =>
        result.current.deleteExercise('we-1')
      )

      expect(success).toBe(true)
      expect(mockSupabase.from).toHaveBeenCalledWith('workout_exercises')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'we-1')
    })
  })

  describe('reorderExercises', () => {
    it('reorders exercises correctly when moving first to last', async () => {
      const exercises: WorkoutExercise[] = [
        { ...mockWorkoutExercise, id: 'we-1', sort_order: 0 },
        { ...mockWorkoutExercise, id: 'we-2', sort_order: 1 },
        { ...mockWorkoutExercise, id: 'we-3', sort_order: 2 },
      ]
      const program = createMockProgram(exercises)

      const mockSupabase = createMockSupabase({
        updateResult: { data: null, error: null },
      })

      const { result } = renderHook(() =>
        useExerciseOperations({
          program,
          setProgram: mockSetProgram,
          setSaving: mockSetSaving,
          supabase: mockSupabase as unknown as Parameters<typeof useExerciseOperations>[0]['supabase'],
        })
      )

      // Move first exercise to last position (index 0 to index 2)
      const reordered = await act(async () =>
        result.current.reorderExercises('day-1', exercises, 0, 2)
      )

      // After moving index 0 to index 2: [we-2, we-3, we-1]
      expect(reordered[0].id).toBe('we-2')
      expect(reordered[1].id).toBe('we-3')
      expect(reordered[2].id).toBe('we-1')
    })
  })

  describe('moveExerciseToDifferentDay', () => {
    it('returns false when source and target day are the same', async () => {
      const mockSupabase = createMockSupabase()
      const program = createMockProgram()

      const { result } = renderHook(() =>
        useExerciseOperations({
          program,
          setProgram: mockSetProgram,
          setSaving: mockSetSaving,
          supabase: mockSupabase as unknown as Parameters<typeof useExerciseOperations>[0]['supabase'],
        })
      )

      const success = await act(async () =>
        result.current.moveExerciseToDifferentDay('we-1', 'day-1', 'day-1')
      )

      expect(success).toBe(false)
      expect(mockSetSaving).not.toHaveBeenCalled()
    })

    it('moves exercise to different day and updates state', async () => {
      const programWithTwoDays: Program = {
        ...createMockProgram(),
        program_weeks: [{
          id: 'week-1',
          program_id: 'prog-1',
          week_number: 1,
          name: 'Week 1',
          workout_days: [
            {
              id: 'day-1',
              week_id: 'week-1',
              day_number: 1,
              name: 'Day 1',
              subtitle: null,
              is_rest_day: false,
              rest_day_notes: null,
              warmup_template_id: null,
              cooldown_template_id: null,
              workout_exercises: [mockWorkoutExercise],
            },
            {
              id: 'day-2',
              week_id: 'week-1',
              day_number: 2,
              name: 'Day 2',
              subtitle: null,
              is_rest_day: false,
              rest_day_notes: null,
              warmup_template_id: null,
              cooldown_template_id: null,
              workout_exercises: [],
            },
          ],
        }],
      }

      const mockSupabase = createMockSupabase({
        selectResult: { data: [{ id: 'we-1' }], error: null },
      })

      const { result } = renderHook(() =>
        useExerciseOperations({
          program: programWithTwoDays,
          setProgram: mockSetProgram,
          setSaving: mockSetSaving,
          supabase: mockSupabase as unknown as Parameters<typeof useExerciseOperations>[0]['supabase'],
        })
      )

      const success = await act(async () =>
        result.current.moveExerciseToDifferentDay('we-1', 'day-1', 'day-2')
      )

      expect(success).toBe(true)
      expect(mockSetSaving).toHaveBeenCalledWith(true)
      expect(mockSetSaving).toHaveBeenCalledWith(false)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        day_id: 'day-2',
        sort_order: 0, // Target day has 0 exercises
      })
      expect(mockSetProgram).toHaveBeenCalled()
    })
  })
})
