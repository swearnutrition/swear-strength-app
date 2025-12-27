# Premium Workout Tracker Design

## Overview

Replace `WorkoutDayClient.tsx` with a premium workout tracking interface featuring glassmorphism effects, gradient accents, volume tracking, PR detection, and micro-animations.

## Goals

1. **Preserve all existing functionality** - set logging, timer, progress, expansion, completion
2. **Add volume tracking** - total workout volume and per-exercise volume
3. **Add dual PR detection** - weight PRs and volume PRs with celebrations
4. **Add extra sets** - users can add sets beyond the programmed workout
5. **Apply premium styling** - full design system from spec

## Architecture

### Files to Modify

1. **`src/hooks/useColors.ts`** - Extend with premium color system (gradients, shadows, glassmorphism)
2. **`src/app/(client)/workouts/[dayId]/WorkoutDayClient.tsx`** - Complete rewrite with premium UI
3. **`src/app/globals.css`** - Add keyframe animations (pulse-glow, float, celebrate, fadeIn)

### Files to Create

None - we're enhancing existing files.

### Database Changes

None - using existing `personal_records` table with:
- `record_type: 'weight'` for weight PRs
- `record_type: 'volume'` for volume PRs (single set: weight × reps)

## Color System Extension

Add to `useColors.ts`:

```typescript
interface ThemeColors {
  // Existing colors...

  // New premium colors
  bgGradient: string
  bgCard: string
  bgCardHover: string
  bgGlass: string
  bgTertiary: string
  bgInput: string

  borderGlow: string
  borderLight: string

  purpleLight: string
  purpleGlow: string
  purpleGradient: string

  greenGradient: string
  greenLight: string

  amberGradient: string
  amberLight: string

  shadowSm: string
  shadowMd: string
  shadowLg: string
  shadowPurple: string
  shadowGreen: string
  shadowAmber: string
}
```

Dark theme values from spec:
- `bgGradient: 'linear-gradient(180deg, #0c0a1d 0%, #1a1333 50%, #0f0d1a 100%)'`
- `bgCard: 'rgba(26, 22, 48, 0.6)'`
- `purpleGradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)'`
- etc.

## Component Structure

```
WorkoutDayClient
├── Header
│   ├── BackButton
│   ├── WorkoutInfo (program name, week, day, duration)
│   └── ProgressRing (percentage complete)
│
├── TotalVolumeCard
│   ├── Volume number (gradient text)
│   └── Change badge (+12% from last time, if available)
│
├── Sections (warmup, strength, cardio, cooldown)
│   └── ExerciseCard (for each exercise)
│       ├── PRBadge (if exercise has new PR)
│       ├── ExerciseName
│       ├── SetsPrescription (3×5 @ RPE 6)
│       ├── InfoButton / DemoButton
│       ├── CoachNote (if present)
│       ├── ExpandedInfo (target muscles, purpose, cues)
│       ├── SetRows (for each set)
│       │   ├── SetNumber / CheckCircle
│       │   ├── WeightInput
│       │   ├── RepsInput
│       │   └── TrophyBadge (if set is PR)
│       ├── AddSetButton
│       └── ExerciseVolumeDisplay
│
└── CompleteWorkoutButton
```

## PR Detection Logic

### On Set Completion

```typescript
async function checkForPRs(
  exerciseId: string,
  weight: number,
  reps: number,
  userId: string
): Promise<{ isWeightPR: boolean; isVolumePR: boolean }> {
  const supabase = createClient()

  // Fetch existing PRs for this exercise
  const { data: existingPRs } = await supabase
    .from('personal_records')
    .select('record_type, value')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)

  const weightPR = existingPRs?.find(pr => pr.record_type === 'weight')
  const volumePR = existingPRs?.find(pr => pr.record_type === 'volume')

  const currentVolume = weight * reps

  const isWeightPR = !weightPR || weight > weightPR.value
  const isVolumePR = !volumePR || currentVolume > volumePR.value

  return { isWeightPR, isVolumePR }
}
```

### On PR Achievement

```typescript
async function savePR(
  userId: string,
  exerciseId: string,
  recordType: 'weight' | 'volume',
  value: number,
  setLogId: string
) {
  const supabase = createClient()

  // Upsert - update if exists, insert if not
  await supabase
    .from('personal_records')
    .upsert({
      user_id: userId,
      exercise_id: exerciseId,
      record_type: recordType,
      value: value,
      set_log_id: setLogId,
      achieved_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,exercise_id,record_type'
    })
}
```

Note: May need to add unique constraint on `(user_id, exercise_id, record_type)` if not present.

## Volume Calculations

```typescript
// Single set volume
const setVolume = (weight: number, reps: number) => weight * reps

// Exercise volume (all completed sets)
const exerciseVolume = (sets: SetData[]) =>
  sets
    .filter(s => s.completed && s.weight && s.reps)
    .reduce((sum, s) => sum + (parseFloat(s.weight) * parseInt(s.reps)), 0)

// Total workout volume
const totalVolume = (exercises: ExerciseWithSets[]) =>
  exercises.reduce((sum, ex) => sum + exerciseVolume(ex.sets), 0)
```

## State Management

```typescript
interface SetData {
  weight: string
  reps: string
  completed: boolean
  isWeightPR: boolean
  isVolumePR: boolean
}

interface ExerciseState {
  sets: SetData[]
  currentVolume: number
  previousBestVolume: number | null
  previousWeightPR: number | null
  previousVolumePR: number | null
  isExpanded: boolean
  showInfo: boolean
}

// Top-level state
const [exerciseStates, setExerciseStates] = useState<Record<string, ExerciseState>>({})
const [totalVolume, setTotalVolume] = useState(0)
```

## Animations (globals.css)

```css
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
  50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.5); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}

@keyframes celebrate {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

## Data Flow

1. **Page Load:**
   - Fetch workout day with exercises
   - Fetch existing set_logs for this workout
   - Fetch personal_records for all exercises in workout
   - Initialize state with existing data + PR thresholds

2. **Set Completion:**
   - Save set_log to database
   - Check if weight > previous weight PR
   - Check if weight × reps > previous volume PR
   - If PR, save to personal_records
   - Update local state with PR flags
   - Trigger celebration animation

3. **Add Set:**
   - Add new SetData to exercise's sets array
   - No database write until set is completed

4. **Complete Workout:**
   - Update workout_log with completed_at
   - Navigate back to workouts list

## Deferred Features

- **Add extra exercises** - User can add exercises not in the program (requires exercise picker modal)

## Implementation Order

1. Extend `useColors.ts` with premium color system
2. Add keyframe animations to `globals.css`
3. Rewrite `WorkoutDayClient.tsx`:
   - Header with progress ring
   - Total volume card
   - Section headers
   - Exercise cards (basic structure)
   - Set logging rows
   - PR detection and celebration
   - Add set button
   - Exercise volume display
   - Expanded info section
   - Complete workout button
4. Test with real workout data
