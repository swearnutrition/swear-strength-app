# Workout Sections & Template Import Design

## Overview

Add warmup/cooldown sections to the Program Builder WorkoutCard, with the ability to import from saved templates. Also add a "Blocks" tab to the Templates page for managing saved exercise blocks.

## Design Decisions

1. **Hybrid template approach** - Templates are copied as editable exercises (not linked)
2. **Collapsible sections** - Warmup → Strength → Cooldown, each collapsible
3. **Unified search** - Templates and exercises appear in same search dropdown
4. **Section-specific content**:
   - Warmup/Cooldown: Templates + exercises (no blocks)
   - Strength: Blocks + exercises (no templates)

## WorkoutCard Sections

### Layout

```
┌─────────────────────────────────────────┐
│ Workout 1                    Rest □  ⋮  │
│ Day 1                                   │
├─────────────────────────────────────────┤
│ ▼ WARMUP (3 exercises)          [orange]│
│   # │ Exercise      │ Sets │ Reps/Time │
│   1 │ Arm Circles   │ 2    │ 10 each   │
│   2 │ Cat-Cow       │ 2    │ 30s       │
│   [Type to search templates/exercises]  │
├─────────────────────────────────────────┤
│ ▼ STRENGTH (4 exercises)        [purple]│
│   # │ Exercise │ Sets│Reps│ Wt│RPE│Rest│
│   1 │ Squat    │ 4   │ 8  │135│ 8 │90s │
│   [Type to search blocks/exercises]     │
├─────────────────────────────────────────┤
│ ▶ COOLDOWN (0 exercises)          [blue]│
│   [collapsed - click to expand]         │
├─────────────────────────────────────────┤
│ ⚡ Cardio                                │
│   [30 min Zone 2 run...]                │
├─────────────────────────────────────────┤
│ Type to add workout notes...            │
└─────────────────────────────────────────┘
```

### Section Behavior

- **Warmup** (orange): Collapsed by default if empty, expanded if has exercises
- **Strength** (purple): Always expanded (current main behavior)
- **Cooldown** (blue): Collapsed by default if empty, expanded if has exercises

### Section-Specific Columns

**Warmup/Cooldown table:**
- `#` | `Exercise` | `Sets` | `Reps/Time` | `Notes` | `⋮`
- Simpler display, no weight/RPE/rest

**Strength table (current):**
- `#` | `Exercise` | `Sets` | `Reps` | `Wt` | `RPE` | `Rest` | `⋮`

### Search Dropdown Content

**Warmup/Cooldown sections:**
```
Templates
  ├── Dynamic Warmup (5 exercises)
  └── Upper Body Prep (4 exercises)

Exercises
  ├── Arm Circles
  └── Cat-Cow
```

**Strength section (current behavior):**
```
Saved Blocks
  ├── Leg Day Superset (3 exercises)
  └── Push/Pull (4 exercises)

Exercises
  ├── Squat
  └── Bench Press
```

## Template Import Flow

When user selects a template:

1. Fetch `routine_template_exercises` for selected template
2. For each template exercise, insert into `workout_exercises`:
   ```typescript
   {
     day_id: currentDay.id,
     exercise_id: templateExercise.exercise_id,
     section: 'warmup' | 'cooldown', // based on which section
     sets: templateExercise.sets,
     reps: templateExercise.reps,
     notes: templateExercise.notes,
     sort_order: nextSortOrder++
   }
   ```
3. Update local state immediately
4. No `warmup_template_id` stored - exercises are independent copies

## Templates Page - Blocks Tab

### Tab Layout

```
┌─────────────────────────────────────────────────────┐
│ < Warmup & Cooldown Templates      + New Template   │
├─────────────────────────────────────────────────────┤
│ [Warmup] [Cooldown] [Blocks]                        │
│   orange    blue     purple                         │
├─────────────────────────────────────────────────────┤
│ Q Search blocks...                                  │
│                                                     │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│ │ Leg Day SS  │ │ Push/Pull   │ │ Core Circuit│    │
│ │ 3 exercises │ │ 4 exercises │ │ 5 exercises │    │
│ │ [Edit][Del] │ │ [Edit][Del] │ │ [Edit][Del] │    │
│ └─────────────┘ └─────────────┘ └─────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Block Modal

Similar to TemplateModal but with strength-specific fields:

- Name
- Exercise search (filters to strength exercises)
- Exercise list with:
  - Superset labels (A1, A2, B1, etc.)
  - Sets, Reps, Weight, RPE, Rest
  - Reorder up/down
  - Delete

## Files to Modify

### 1. `WorkoutCard.tsx`
- Extract section rendering into reusable component
- Add collapse/expand state per section
- Filter exercises by `section` field
- Add template search for warmup/cooldown
- Different table columns per section type

### 2. `templates/page.tsx`
- Add third tab "Blocks" with purple styling
- Fetch `exercise_blocks` when on Blocks tab
- Render block cards in grid
- Wire up BlockModal for create/edit

### 3. `templates/BlockModal.tsx` (new)
- Form for block name
- Exercise picker (strength exercises)
- Editable exercise list with all strength fields
- Superset labeling
- Save/update to `exercise_blocks` + `exercise_block_items`

### 4. `ProgramBuilderClient.tsx`
- Pass `templates` prop to WorkoutCard
- Templates already fetched, just needs threading

### 5. `types.ts`
- Add `RoutineTemplate` interface if not exists
- Add `RoutineTemplateExercise` interface if not exists

## No Database Changes

All required tables already exist:
- `routine_templates` - warmup/cooldown templates
- `routine_template_exercises` - template exercise items
- `exercise_blocks` - saved exercise blocks
- `exercise_block_items` - block exercise items
- `workout_exercises.section` - already has warmup/strength/cooldown/cardio enum

## Implementation Order

1. **Templates page Blocks tab** - Add tab, fetch blocks, display grid
2. **BlockModal** - Create/edit blocks UI
3. **WorkoutCard sections** - Refactor into collapsible sections
4. **Template import** - Add template search and import to warmup/cooldown
5. **Test & polish** - Verify all flows work together
