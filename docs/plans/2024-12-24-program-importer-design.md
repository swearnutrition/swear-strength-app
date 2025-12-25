# Program Importer Design

## Overview

Import workout programs from structured text format into the database. Modal-based UI on the programs list page with two-step flow: parse → review/resolve → import.

## User Flow

1. **Open Modal** - Click "Import Program" on `/coach/programs`
2. **Paste & Parse** - Paste text, click "Parse Program"
3. **Review & Resolve** - See parsed structure, resolve unmatched exercises (pick existing or create new)
4. **Import** - Creates all database records, redirects to Program Builder

## Input Format

```
PROGRAM: Program Name
TYPE: strength
INDEFINITE: yes
DESCRIPTION: Brief description

[WEEK 1]

[DAY 1] Day Name
[WARMUP]
A1. Exercise | 1x10
[STRENGTH]
A1. Exercise | 3x10 | Rest: 60s | RPE: 7 | Note: Optional
[COOLDOWN]
A1. Stretch | 1x30s per side

[DAY 2] Rest Day
[REST]
Light walking or mobility work.
```

## Parser Output

```typescript
interface ParsedProgram {
  name: string
  type: 'strength' | 'mobility' | 'cardio'
  is_indefinite: boolean
  description: string | null
  weeks: ParsedWeek[]
  errors: ParseError[]
}

interface ParsedWeek {
  weekNumbers: number[]  // [1] or [1,2,3] for ranges
  days: ParsedDay[]
}

interface ParsedDay {
  dayNumber: number
  name: string
  isRestDay: boolean
  restDayNotes: string | null
  exercises: ParsedExercise[]
}

interface ParsedExercise {
  section: 'warmup' | 'strength' | 'cooldown'
  label: string | null
  name: string
  sets: string
  reps: string
  restSeconds: number | null
  rpe: number | null
  notes: string | null
}

interface ParseError {
  line: number
  message: string
}
```

## Exercise Matching

1. **Exact match** (case-insensitive)
2. **Normalized match** (strip common prefixes like "Barbell", "Dumbbell")
3. **Contains match** (show suggestions)
4. **No match** → user resolves

```typescript
interface ExerciseMatch {
  parsedName: string
  status: 'matched' | 'fuzzy' | 'unmatched'
  matchedExercise?: Exercise
  suggestions?: Exercise[]
  resolution?: 'use_match' | 'create_new' | 'pick_existing'
  selectedExerciseId?: string
  newExerciseData?: { name: string; type: string }
}
```

## Components

### ImportProgramModal
- Two tabs: "Paste Program" / "Format Guide"
- Textarea for pasting
- "Parse Program" button
- Shows ParseReview when parsed

### ParseReview
- Program summary (name, type, weeks, days count)
- Exercise match list with resolution UI
- Parse errors if any
- "Import Program" button (disabled until all resolved)

### ExerciseResolver (per unmatched exercise)
- Dropdown to pick existing exercise
- "Create New" button → inline form

## Database Operations (on Import)

1. Create new exercises (if any)
2. Insert program record
3. Insert program_weeks records
4. Insert workout_days records
5. Insert workout_exercises records

All in a logical sequence (exercises first so we have IDs).

## Files to Create/Modify

- `src/lib/importParser.ts` - Parser logic
- `src/lib/exerciseMatcher.ts` - Fuzzy matching logic
- `src/app/coach/programs/ImportProgramModal.tsx` - Modal component
- `src/app/coach/programs/ProgramsClient.tsx` - Add import button (existing file)
