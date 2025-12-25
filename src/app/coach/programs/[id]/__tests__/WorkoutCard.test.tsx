import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkoutCard } from '../components/WorkoutCard'
import type { WorkoutDay, Exercise, ExerciseBlock, WorkoutExercise, RoutineTemplate } from '../types'

// Mock Supabase client
function createMockSupabase() {
  const defaultResult = { data: null, error: null }

  const createThenable = (result: { data: unknown; error: unknown }) => ({
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve(result)
      return Promise.resolve(result)
    },
    select: vi.fn().mockImplementation(() => Promise.resolve(result)),
  })

  const chainable: Record<string, ReturnType<typeof vi.fn>> = {
    from: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  }

  chainable.from.mockReturnValue(chainable)
  chainable.insert.mockReturnValue(chainable)
  chainable.update.mockReturnValue(chainable)
  chainable.delete.mockReturnValue(chainable)
  chainable.select.mockReturnValue(chainable)
  chainable.eq.mockImplementation(() => createThenable(defaultResult))
  chainable.single.mockImplementation(() => Promise.resolve(defaultResult))

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
  video_url: null,
}

const mockExercise2: Exercise = {
  id: 'ex-2',
  name: 'Bench Press',
  equipment: 'barbell',
  muscle_groups: ['chest'],
  type: 'strength',
  primary_muscle: 'pectorals',
  focus_area: 'upper',
  video_url: null,
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
  duration_seconds: null,
  distance: null,
  distance_unit: null,
  target_pace: null,
  hr_zone: null,
  intervals: null,
  interval_rest_seconds: null,
  notes: null,
  sort_order: 0,
}

const mockDay: WorkoutDay = {
  id: 'day-1',
  week_id: 'week-1',
  day_number: 1,
  name: 'Day 1',
  subtitle: null,
  is_rest_day: false,
  rest_day_notes: null,
  cardio_notes: null,
  warmup_template_id: null,
  cooldown_template_id: null,
  workout_exercises: [mockWorkoutExercise],
}

const defaultSettings = {
  weightUnit: 'lbs' as const,
  effortUnit: 'rpe' as const,
  showWeight: true,
  showEffort: true,
  showRest: true,
  showNotes: true,
}

const mockTemplates: RoutineTemplate[] = []

describe('WorkoutCard', () => {
  let mockOnUpdate: ReturnType<typeof vi.fn>
  let mockOnDelete: ReturnType<typeof vi.fn>
  let mockOnCopy: ReturnType<typeof vi.fn>
  let mockOnSaveAsBlock: ReturnType<typeof vi.fn>
  let mockOnGlobalDragStart: ReturnType<typeof vi.fn>
  let mockOnGlobalDragEnd: ReturnType<typeof vi.fn>
  let mockOnDropFromOtherDay: ReturnType<typeof vi.fn>
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnUpdate = vi.fn()
    mockOnDelete = vi.fn()
    mockOnCopy = vi.fn()
    mockOnSaveAsBlock = vi.fn()
    mockOnGlobalDragStart = vi.fn()
    mockOnGlobalDragEnd = vi.fn()
    mockOnDropFromOtherDay = vi.fn()
    mockSupabase = createMockSupabase()
  })

  const renderWorkoutCard = (overrides?: Partial<Parameters<typeof WorkoutCard>[0]>) => {
    return render(
      <WorkoutCard
        day={mockDay}
        exercises={[mockExercise, mockExercise2]}
        blocks={[]}
        templates={mockTemplates}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
        onCopy={mockOnCopy}
        isCopied={false}
        onSaveAsBlock={mockOnSaveAsBlock}
        supabase={mockSupabase as unknown as Parameters<typeof WorkoutCard>[0]['supabase']}
        settings={defaultSettings}
        globalDragExercise={null}
        onGlobalDragStart={mockOnGlobalDragStart}
        onGlobalDragEnd={mockOnGlobalDragEnd}
        onDropFromOtherDay={mockOnDropFromOtherDay}
        {...overrides}
      />
    )
  }

  describe('rendering', () => {
    it('renders the day name', () => {
      renderWorkoutCard()
      expect(screen.getByDisplayValue('Day 1')).toBeInTheDocument()
    })

    it('renders exercises in the workout', () => {
      renderWorkoutCard()
      expect(screen.getByText('Squat')).toBeInTheDocument()
    })

    it('renders exercise details (sets, reps, weight)', () => {
      renderWorkoutCard()
      expect(screen.getByDisplayValue('3')).toBeInTheDocument() // sets
      expect(screen.getByDisplayValue('10')).toBeInTheDocument() // reps
      expect(screen.getByDisplayValue('100')).toBeInTheDocument() // weight
    })

    it('shows rest time in formatted display', () => {
      renderWorkoutCard()
      // 90 seconds should display as "1m30s"
      expect(screen.getByDisplayValue('1m30s')).toBeInTheDocument()
    })

    it('renders add exercise row when no exercises', () => {
      const emptyDay = { ...mockDay, workout_exercises: [] }
      renderWorkoutCard({ day: emptyDay })
      // Empty state shows the add exercise input in strength section
      expect(screen.getByPlaceholderText('Search blocks or exercises...')).toBeInTheDocument()
    })

    it('shows copied indicator when isCopied is true', () => {
      renderWorkoutCard({ isCopied: true })
      // The copy button has title "Copied!" when copied
      expect(screen.getByTitle('Copied!')).toBeInTheDocument()
    })
  })

  describe('exercise search', () => {
    it('shows search results when typing in empty day', async () => {
      const user = userEvent.setup()
      const emptyDay = { ...mockDay, workout_exercises: [] }
      renderWorkoutCard({ day: emptyDay })

      // Type in search (search is always visible when no exercises in strength section)
      const searchInput = screen.getByPlaceholderText('Search blocks or exercises...')
      await user.type(searchInput, 'Bench')

      // Should show matching exercise in dropdown
      await waitFor(() => {
        expect(screen.getByText('Bench Press')).toBeInTheDocument()
      })
    })

    it('filters exercises based on search term', async () => {
      const user = userEvent.setup()
      const emptyDay = { ...mockDay, workout_exercises: [] }
      renderWorkoutCard({ day: emptyDay })

      const searchInput = screen.getByPlaceholderText('Search blocks or exercises...')
      await user.type(searchInput, 'xyz')

      // Should show "No results found" message
      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument()
      })
    })
  })

  describe('editing exercises', () => {
    it('calls onUpdate when sets are changed', async () => {
      const user = userEvent.setup()
      renderWorkoutCard()

      const setsInput = screen.getByDisplayValue('3')
      await user.clear(setsInput)
      await user.type(setsInput, '5')

      // Trigger blur to save
      fireEvent.blur(setsInput)

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled()
      })
    })

    it('calls onUpdate when reps are changed', async () => {
      const user = userEvent.setup()
      renderWorkoutCard()

      const repsInput = screen.getByDisplayValue('10')
      await user.clear(repsInput)
      await user.type(repsInput, '12')

      fireEvent.blur(repsInput)

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalled()
      })
    })
  })

  describe('day operations', () => {
    it('updates day name when changed', async () => {
      const user = userEvent.setup()
      renderWorkoutCard()

      const nameInput = screen.getByDisplayValue('Day 1')
      await user.clear(nameInput)
      await user.type(nameInput, 'Leg Day')

      fireEvent.blur(nameInput)

      await waitFor(() => {
        expect(mockSupabase.update).toHaveBeenCalled()
      })
    })

    it('calls onCopy when copy button is clicked', async () => {
      const user = userEvent.setup()
      renderWorkoutCard()

      // Find copy button by its SVG content (clipboard icon)
      const buttons = screen.getAllByRole('button')
      const copyButton = buttons.find(btn =>
        btn.querySelector('svg path[d*="M9 5H7a2 2 0 00-2 2v12"]')
      )

      if (copyButton) {
        await user.click(copyButton)
        expect(mockOnCopy).toHaveBeenCalled()
      }
    })
  })

  describe('rest day toggle', () => {
    it('shows rest day UI when toggled', () => {
      const restDay = { ...mockDay, is_rest_day: true, rest_day_notes: 'Recovery day' }
      renderWorkoutCard({ day: restDay })

      // The actual placeholder includes more text
      expect(screen.getByPlaceholderText('Add rest day notes (recovery tips, stretching, etc.)')).toBeInTheDocument()
    })
  })
})
