# Program Builder Design

## Overview

A spreadsheet-style program builder inspired by Superset Sheets, allowing coaches to create structured workout programs with weeks displayed as horizontal columns and exercises in editable tables.

## Layout Structure

### Main Container
- **Header**: Program name (editable), type badge, description field, Save/Publish buttons
- **Week Navigation**: Horizontal scrollable row of week columns
- **Content Area**: Scrollable grid of week columns with workout day cards

### Week Columns
- Each week displayed as a vertical column
- Week header with name (editable) and week number
- Contains workout day cards stacked vertically
- "Add Week" button at the end to append new weeks
- Week actions: duplicate, delete, reorder via drag

### Workout Day Cards
- Card header: Day name (e.g., "Push Day"), day number, rest day toggle
- Subtitle field for notes (e.g., "Upper Body Focus")
- Expandable/collapsible sections:
  - Warmup (collapsible, uses template or custom)
  - Strength (main section, always visible)
  - Cooldown (collapsible, uses template or custom)
- Card actions: duplicate, copy to clipboard, delete

### Exercise Tables (Spreadsheet Style)
Each section contains a spreadsheet-like table:

| Exercise | Sets | Reps | Weight | RPE | Rest | Notes |
|----------|------|------|--------|-----|------|-------|
| Bench Press | 4 | 8-10 | 185 | 8 | 90s | Focus on control |
| A1: DB Fly | 3 | 12 | 30 | 7 | - | Superset |
| A2: Push-up | 3 | 15 | BW | 7 | 60s | Superset |

- Inline editing for all cells
- Row selection for bulk actions
- Drag handles for reordering
- Superset grouping indicated by labels (A1, A2, B1, B2)

## Adding Exercises

### Quick Add (Primary Method)
- "Add exercise" row at bottom of each table
- Autocomplete search as you type
- Shows exercise name, muscle group, equipment
- Press Enter or click to add
- Tab to move through cells after adding

### Browse by Category
- "Browse" button opens modal/sidebar
- Filter by:
  - Muscle group (Chest, Back, Legs, etc.)
  - Focus area (Strength, Mobility, Cardio)
  - Equipment (Barbell, Dumbbell, Machine, Bodyweight)
- Click to add, multi-select for batch add
- Recently used exercises at top

### Creating Supersets
- Select multiple exercise rows
- Click "Group as Superset" button
- Assigns labels (A1, A2 or B1, B2, etc.)
- Visual grouping with bracket/highlight
- Ungroup option to separate

### Reordering
- Drag handle on each row
- Drag between sections (move from Strength to Warmup)
- Drag between days (move exercise to different workout)

## Templates & Copying

### Warmup/Cooldown Templates
- "Apply Template" button in warmup/cooldown sections
- Opens modal with saved templates
- Preview exercises in template before applying
- Replaces current section content
- Option to "Customize" after applying

### Copy Workout
- Copy entire workout day to clipboard
- Paste into same program (different day/week)
- Paste into different program
- Keyboard shortcuts: Cmd/Ctrl+C, Cmd/Ctrl+V

### Copy Week
- Duplicate entire week with all workouts
- Useful for repeating training blocks
- Option to copy as "progression" (auto-increment weights/sets)

### Rest Days
- Toggle any day as "Rest Day"
- Optional rest day notes (recovery focus, etc.)
- Visual distinction (grayed out, different styling)

## Header & Program Info

### Program Header
- **Name**: Large, editable title
- **Type Badge**: Strength / Hypertrophy / Mobility / Custom
- **Description**: Multi-line text area
- **Duration**: Auto-calculated from weeks
- **Status**: Draft / Published

### Saving
- Auto-save with debounce (2 second delay)
- "Saving..." indicator during save
- "All changes saved" confirmation
- Manual save button available
- Undo/Redo support (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)

### Programs List Page
- Grid/list of all programs
- Status filter (Draft, Published, Archived)
- Search by name
- Sort by date, name, type
- Quick actions: Edit, Duplicate, Archive, Delete

## Database Mapping

Uses existing schema:
- `programs` → Program header info
- `program_weeks` → Week columns
- `workout_days` → Day cards within weeks
- `workout_exercises` → Exercise rows in tables

Key fields:
- `workout_exercises.section` → warmup/strength/cooldown/cardio
- `workout_exercises.label` → Superset grouping (A1, A2, etc.)
- `workout_days.is_rest_day` → Rest day toggle
- `programs.is_indefinite` → Rolling/indefinite programs

## UI/UX Details

### Visual Hierarchy
- Week columns have subtle borders/shadows
- Current/selected week highlighted
- Workout cards have rounded corners, card shadows
- Exercise tables use alternating row colors
- Supersets visually grouped with bracket or background

### Responsive Behavior
- Desktop: Multiple weeks visible horizontally
- Tablet: 2-3 weeks visible, horizontal scroll
- Mobile: Single week view with week selector

### Keyboard Navigation
- Tab through cells in exercise table
- Arrow keys for cell navigation
- Enter to confirm edit, Escape to cancel
- Keyboard shortcuts for common actions

## Implementation Phases

### Phase 1: Core Structure
- Program header and basic info
- Week management (add, delete, reorder)
- Workout day cards with sections
- Basic exercise table display

### Phase 2: Exercise Management
- Quick add with autocomplete
- Browse exercises modal
- Drag-and-drop reordering
- Inline cell editing

### Phase 3: Advanced Features
- Superset grouping
- Copy/paste workouts and weeks
- Template application
- Rest day support

### Phase 4: Polish
- Auto-save with indicators
- Undo/redo
- Keyboard shortcuts
- Programs list page
