-- Enhanced Exercise Schema Migration
-- Run this in your Supabase SQL Editor after 001_initial_schema.sql

-- ============================================
-- NEW ENUMS
-- ============================================

-- Muscle groups for strength exercises
CREATE TYPE muscle_group AS ENUM (
    'chest', 'upper_chest', 'back', 'lats', 'rhomboids', 'lower_traps', 'traps', 'mid_back',
    'shoulders', 'rear_delts', 'lateral_delts', 'rotator_cuff',
    'biceps', 'triceps', 'forearms',
    'quads', 'hamstrings', 'glutes', 'glute_medius', 'adductors', 'calves',
    'core', 'abs', 'obliques', 'erectors', 'hip_flexors',
    'full_body'
);

-- Focus areas for mobility exercises
CREATE TYPE mobility_focus AS ENUM (
    'hip_flexors', 'hips', 'groin', 'hamstrings', 'quads',
    'thoracic_spine', 'lumbar_spine', 'cervical_spine',
    'shoulders', 'shoulder_internal_rotation', 'shoulder_external_rotation', 'scapular',
    'lats', 'pecs', 'ankles', 'calves', 'feet', 'wrists', 'elbows', 'neck'
);

-- Logging types for exercises
CREATE TYPE logging_type AS ENUM (
    'weight_reps',      -- Standard strength: weight + reps
    'reps_only',        -- Bodyweight: just reps
    'duration',         -- Timed: seconds/minutes
    'distance',         -- Cardio: meters/miles
    'weight_duration'   -- Weighted holds: weight + time
);

-- ============================================
-- ALTER EXERCISES TABLE
-- ============================================

-- Add new columns
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS primary_muscle muscle_group;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS secondary_muscles muscle_group[] DEFAULT '{}';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS focus_area mobility_focus;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS logging_type logging_type DEFAULT 'weight_reps';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS default_sets INTEGER DEFAULT 3;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS default_reps TEXT DEFAULT '10';
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS video_thumbnail TEXT;

-- Rename demo_url to video_url for clarity
ALTER TABLE exercises RENAME COLUMN demo_url TO video_url;

-- Add index for focus_area (mobility filtering)
CREATE INDEX IF NOT EXISTS idx_exercises_focus_area ON exercises(focus_area);
CREATE INDEX IF NOT EXISTS idx_exercises_primary_muscle ON exercises(primary_muscle);
CREATE INDEX IF NOT EXISTS idx_exercises_logging_type ON exercises(logging_type);

-- ============================================
-- WARMUP/COOLDOWN TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS routine_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('warmup', 'cooldown')),
    description TEXT,
    duration_minutes INTEGER,
    created_by UUID NOT NULL REFERENCES profiles(id),
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routine_template_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES routine_templates(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    sets TEXT,
    reps TEXT, -- Can be "10", "30s", "5 each side"
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_templates_type ON routine_templates(type);
CREATE INDEX IF NOT EXISTS idx_routine_template_exercises_template ON routine_template_exercises(template_id);

-- Enable RLS
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_template_exercises ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routine_templates
CREATE POLICY "Coach can manage routine templates"
    ON routine_templates FOR ALL
    USING (is_coach());

CREATE POLICY "Everyone can view routine templates"
    ON routine_templates FOR SELECT
    USING (TRUE);

-- RLS Policies for routine_template_exercises
CREATE POLICY "Coach can manage template exercises"
    ON routine_template_exercises FOR ALL
    USING (is_coach());

CREATE POLICY "Everyone can view template exercises"
    ON routine_template_exercises FOR SELECT
    USING (TRUE);

-- Add triggers for updated_at
CREATE TRIGGER update_routine_templates_updated_at
    BEFORE UPDATE ON routine_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ADD WARMUP/COOLDOWN TEMPLATE REFS TO WORKOUT_DAYS
-- ============================================

ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS warmup_template_id UUID REFERENCES routine_templates(id);
ALTER TABLE workout_days ADD COLUMN IF NOT EXISTS cooldown_template_id UUID REFERENCES routine_templates(id);

-- ============================================
-- CLIENT NOTES (for coach feedback view)
-- ============================================

CREATE TABLE IF NOT EXISTS client_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workout_log_id UUID REFERENCES workout_logs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_user ON client_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_unread ON client_notes(is_read) WHERE is_read = FALSE;

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notes"
    ON client_notes FOR ALL
    USING (auth.uid() = user_id OR is_coach());
