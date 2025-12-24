# Program Builder Refactor Design

## Overview

Refactor the 2000+ line `ProgramBuilderClient.tsx` into smaller, testable components with clear responsibilities. Add integration tests for critical paths.

## Goals

1. Split monolithic component into feature-based modules
2. Extract state management into custom hooks
3. Add test coverage for operations that have broken before (sort_order, drag-and-drop)
4. Make the codebase maintainable for future features

## File Structure

```
src/app/coach/programs/[id]/
├── page.tsx                    # (existing) Server component, data fetching
├── types.ts                    # (existing) Type definitions
├── ProgramBuilderClient.tsx    # Slimmed down orchestrator (~200 lines)
├── components/
│   ├── ProgramHeader.tsx       # Title, save indicator, settings button
│   ├── WeekSection.tsx         # Week container, add/delete/copy week
│   ├── WorkoutCard.tsx         # Day card with exercise table
│   ├── ExerciseRow.tsx         # Single exercise row (inputs, drag handle, menu)
│   ├── ExerciseSearch.tsx      # Search dropdown for adding exercises
│   ├── BlocksPanel.tsx         # Saved blocks sidebar
│   └── SettingsModal.tsx       # Settings modal
├── hooks/
│   ├── useProgramState.ts      # Program state, updateDay, updateWeek
│   ├── useExerciseOperations.ts # addExercise, deleteExercise, reorder, move
│   └── useBlockOperations.ts   # Block CRUD, insert block
├── utils/
│   └── parseRest.ts            # Rest time parsing (e.g., "30s" → 30)
└── __tests__/
    ├── useExerciseOperations.test.ts
    ├── WorkoutCard.test.tsx
    └── parseRest.test.ts
```

## Hook Responsibilities

### `useProgramState.ts`

Manages the program data and saving state.

```typescript
export function useProgramState(initialProgram: Program) {
  const [program, setProgram] = useState(initialProgram)
  const [saving, setSaving] = useState(false)

  const updateDay = (dayId: string, updates: Partial<WorkoutDay>) => { ... }
  const updateWeek = (weekId: string, updates: Partial<ProgramWeek>) => { ... }

  return { program, setProgram, saving, setSaving, updateDay, updateWeek }
}
```

### `useExerciseOperations.ts`

All exercise CRUD and reordering operations.

```typescript
export function useExerciseOperations(
  program: Program,
  setProgram: SetProgram,
  setSaving: SetSaving
) {
  const addExercise = async (dayId: string, exercise: Exercise) => { ... }
  const deleteExercise = async (exerciseId: string, dayId: string) => { ... }
  const updateExercise = (exerciseId: string, dayId: string, field: string, value: unknown) => { ... }
  const reorderExercises = async (dayId: string, fromIndex: number, toIndex: number) => { ... }
  const moveExerciseToDifferentDay = async (exerciseId: string, fromDayId: string, toDayId: string) => { ... }

  return { addExercise, deleteExercise, updateExercise, reorderExercises, moveExerciseToDifferentDay }
}
```

### `useBlockOperations.ts`

Saved blocks management.

```typescript
export function useBlockOperations(setSaving: SetSaving) {
  const [blocks, setBlocks] = useState<ExerciseBlock[]>([])

  const loadBlocks = async () => { ... }
  const saveAsBlock = async (name: string, exercises: WorkoutExercise[]) => { ... }
  const insertBlock = async (dayId: string, block: ExerciseBlock, currentExercises: WorkoutExercise[]) => { ... }
  const deleteBlock = async (blockId: string) => { ... }

  return { blocks, loadBlocks, saveAsBlock, insertBlock, deleteBlock }
}
```

## Component Responsibilities

### `ProgramHeader.tsx` (~50 lines)
- Program title (editable)
- Save indicator ("Saving..." / "Saved")
- Blocks button, Settings button
- Back link

### `WeekSection.tsx` (~100 lines)
- Week header with name
- "Add Day" button
- "Copy Week" / "Delete Week" buttons
- Renders `WorkoutCard` for each day
- Paste day button (when clipboard has content)

### `WorkoutCard.tsx` (~150 lines)
- Day header (name, rest toggle, copy/delete)
- Rest day view OR exercise table
- Renders `ExerciseRow` for each exercise
- Drop zone for cross-day drag
- "Add Exercise" button

### `ExerciseRow.tsx` (~120 lines)
- Drag handle
- Row number / label
- Exercise name (with search on click)
- Sets, Reps, Weight, RPE, Rest inputs
- Delete button (on hover)
- Menu button

### `ExerciseSearch.tsx` (~80 lines)
- Search input
- Filtered dropdown
- Block insertion option
- Handles selection callback

### `BlocksPanel.tsx` (~150 lines)
- Slide-out panel
- List of saved blocks
- Expand/collapse block items
- Add/edit/delete blocks

### `SettingsModal.tsx` (~80 lines)
- Weight unit toggle
- Effort unit toggle
- Show/hide columns

## Test Coverage

Focus on critical paths - operations that have broken before.

### `parseRest.test.ts` (~10 tests)
- "30s" → 30
- "2m" → 120
- "1m30s" → 90
- "90" → 90 (plain number)
- Invalid inputs → null

### `useExerciseOperations.test.ts` (~8 tests)
- addExercise: creates with correct sort_order
- addExercise: auto-fills from previous exercise
- deleteExercise: removes from state and DB
- reorderExercises: updates sort_order correctly
- moveExerciseToDifferentDay: moves between days, updates sort_order

### `WorkoutCard.test.tsx` (~5 tests)
- Renders exercises in order
- Add exercise shows search
- Delete exercise with confirmation
- Drag reorder updates order
- Rest day toggle shows rest view

## Testing Setup

Using Vitest + React Testing Library:
- Native ESM support, works well with Next.js
- Jest-compatible API
- Fast watch mode

## Implementation Order

1. Set up Vitest and testing infrastructure
2. Extract `parseRest.ts` utility and write tests
3. Extract hooks (`useProgramState`, `useExerciseOperations`, `useBlockOperations`)
4. Write hook tests
5. Extract components one by one
6. Write component integration tests
7. Slim down `ProgramBuilderClient.tsx` to orchestrator
8. Verify build and existing functionality

## Out of Scope

- Client data storage (separate feature, needs own design)
- Undo/redo (removed due to DB sync complexity)
- New features (this is purely a refactor)
