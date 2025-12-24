-- Swear Strength Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('coach', 'client');
CREATE TYPE program_type AS ENUM ('strength', 'mobility', 'cardio');
CREATE TYPE exercise_type AS ENUM ('strength', 'mobility', 'cardio');
CREATE TYPE workout_section AS ENUM ('warmup', 'strength', 'cooldown', 'cardio');
CREATE TYPE weight_unit AS ENUM ('lbs', 'kg');
CREATE TYPE activity_level AS ENUM ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active');
CREATE TYPE nutrition_goal AS ENUM ('lose', 'maintain', 'gain');

-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'client',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    last_login TIMESTAMPTZ,
    invited_by UUID REFERENCES profiles(id),
    invite_accepted_at TIMESTAMPTZ,
    preferred_weight_unit weight_unit DEFAULT 'lbs',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVITES
-- ============================================
CREATE TABLE invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invites_token ON invites(token);
CREATE INDEX idx_invites_email ON invites(email);

-- ============================================
-- EXERCISES (Master Library)
-- ============================================
CREATE TABLE exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    equipment TEXT,
    muscle_groups TEXT[] DEFAULT '{}',
    type exercise_type NOT NULL DEFAULT 'strength',
    demo_url TEXT,
    cues TEXT,
    instructions TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    submitted_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercises_name ON exercises(name);
CREATE INDEX idx_exercises_type ON exercises(type);
CREATE INDEX idx_exercises_muscle_groups ON exercises USING GIN(muscle_groups);

-- ============================================
-- PROGRAMS
-- ============================================
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type program_type NOT NULL DEFAULT 'strength',
    description TEXT,
    is_indefinite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_created_by ON programs(created_by);
CREATE INDEX idx_programs_archived ON programs(is_archived);

-- ============================================
-- PROGRAM WEEKS
-- ============================================
CREATE TABLE program_weeks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(program_id, week_number)
);

CREATE INDEX idx_program_weeks_program ON program_weeks(program_id);

-- ============================================
-- WORKOUT DAYS
-- ============================================
CREATE TABLE workout_days (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_id UUID NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    is_rest_day BOOLEAN DEFAULT FALSE,
    rest_day_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(week_id, day_number)
);

CREATE INDEX idx_workout_days_week ON workout_days(week_id);

-- ============================================
-- WORKOUT EXERCISES (Assigned to days)
-- ============================================
CREATE TABLE workout_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_id UUID NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    section workout_section NOT NULL DEFAULT 'strength',
    label TEXT, -- A1, A2, B1, etc for supersets
    sets TEXT, -- Can be "3" or "3-4"
    reps TEXT, -- Can be "10", "8-12", "30s", "AMRAP"
    weight TEXT, -- Can be "BW", "70%", or actual weight
    rest_seconds INTEGER,
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    alternative_exercise_id UUID REFERENCES exercises(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_exercises_day ON workout_exercises(day_id);
CREATE INDEX idx_workout_exercises_exercise ON workout_exercises(exercise_id);

-- ============================================
-- USER PROGRAM ASSIGNMENTS
-- ============================================
CREATE TABLE user_program_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    current_week INTEGER DEFAULT 1,
    current_day INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, program_id)
);

CREATE INDEX idx_assignments_user ON user_program_assignments(user_id);
CREATE INDEX idx_assignments_active ON user_program_assignments(is_active);

-- ============================================
-- WORKOUT LOGS (Started workouts)
-- ============================================
CREATE TABLE workout_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    workout_day_id UUID NOT NULL REFERENCES workout_days(id),
    assignment_id UUID REFERENCES user_program_assignments(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_logs_user ON workout_logs(user_id);
CREATE INDEX idx_workout_logs_day ON workout_logs(workout_day_id);
CREATE INDEX idx_workout_logs_completed ON workout_logs(completed_at);

-- ============================================
-- SET LOGS (Individual set data)
-- ============================================
CREATE TABLE set_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
    workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id),
    set_number INTEGER NOT NULL,
    weight DECIMAL(10,2),
    weight_unit weight_unit DEFAULT 'lbs',
    reps_completed INTEGER,
    duration_seconds INTEGER, -- For timed exercises
    is_bodyweight BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_set_logs_workout ON set_logs(workout_log_id);
CREATE INDEX idx_set_logs_exercise ON set_logs(workout_exercise_id);

-- ============================================
-- WORKOUT COMPLETIONS (Post-workout feedback)
-- ============================================
CREATE TABLE workout_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workout_log_id UUID NOT NULL UNIQUE REFERENCES workout_logs(id) ON DELETE CASCADE,
    difficulty_rating INTEGER CHECK (difficulty_rating >= 1 AND difficulty_rating <= 10),
    energy_level TEXT, -- 'low', 'medium', 'high'
    feeling INTEGER CHECK (feeling >= 1 AND feeling <= 6), -- 6-point scale
    notes TEXT,
    media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PERSONAL RECORDS
-- ============================================
CREATE TABLE personal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id),
    record_type TEXT NOT NULL, -- 'max_weight', 'max_reps', 'estimated_1rm'
    value DECIMAL(10,2) NOT NULL,
    weight_unit weight_unit DEFAULT 'lbs',
    achieved_at TIMESTAMPTZ DEFAULT NOW(),
    set_log_id UUID REFERENCES set_logs(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prs_user ON personal_records(user_id);
CREATE INDEX idx_prs_exercise ON personal_records(exercise_id);
CREATE INDEX idx_prs_user_exercise ON personal_records(user_id, exercise_id);

-- ============================================
-- HABITS
-- ============================================
CREATE TABLE habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    water BOOLEAN DEFAULT FALSE,
    water_amount INTEGER, -- glasses or ml
    sleep BOOLEAN DEFAULT FALSE,
    sleep_hours DECIMAL(3,1),
    protein BOOLEAN DEFAULT FALSE,
    protein_grams INTEGER,
    creatine BOOLEAN DEFAULT FALSE,
    custom_habits JSONB DEFAULT '{}', -- For extensibility
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

CREATE INDEX idx_habits_user_date ON habits(user_id, date);

-- ============================================
-- NUTRITION PROFILES
-- ============================================
CREATE TABLE nutrition_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    -- Input values
    weight DECIMAL(5,1), -- in user's preferred unit
    weight_unit weight_unit DEFAULT 'lbs',
    height_cm INTEGER,
    age INTEGER,
    sex TEXT, -- 'male', 'female'
    activity_level activity_level DEFAULT 'moderately_active',
    goal nutrition_goal DEFAULT 'maintain',
    -- Calculated values
    bmr INTEGER,
    tdee INTEGER,
    calories INTEGER,
    protein INTEGER, -- grams
    carbs INTEGER, -- grams
    fat INTEGER, -- grams
    meals_per_day INTEGER DEFAULT 3,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_nutrition_profiles_user ON nutrition_profiles(user_id);

-- ============================================
-- NUTRITION LOGS
-- ============================================
CREATE TABLE nutrition_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    meal_number INTEGER, -- 1, 2, 3, etc. NULL for daily total
    meal_name TEXT, -- 'Breakfast', 'Lunch', 'Snack', etc.
    -- Gram-based tracking
    calories INTEGER,
    protein INTEGER,
    carbs INTEGER,
    fat INTEGER,
    -- Portion-based tracking
    portions_protein DECIMAL(3,1), -- palms
    portions_carbs DECIMAL(3,1), -- fists
    portions_fat DECIMAL(3,1), -- thumbs
    -- Media & notes
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nutrition_logs_user_date ON nutrition_logs(user_id, date);

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(id),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON announcements(is_active, expires_at);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is coach
CREATE OR REPLACE FUNCTION is_coach()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'coach'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES: Users can read own, coach can read all
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id OR is_coach());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Coach can insert profiles"
    ON profiles FOR INSERT
    WITH CHECK (is_coach() OR auth.uid() = id);

-- INVITES: Coach only
CREATE POLICY "Coach can manage invites"
    ON invites FOR ALL
    USING (is_coach());

-- EXERCISES: Everyone can read, coach can write
CREATE POLICY "Everyone can view exercises"
    ON exercises FOR SELECT
    USING (TRUE);

CREATE POLICY "Coach can manage exercises"
    ON exercises FOR ALL
    USING (is_coach());

CREATE POLICY "Clients can submit exercises"
    ON exercises FOR INSERT
    WITH CHECK (auth.uid() = submitted_by AND is_approved = FALSE);

-- PROGRAMS: Coach can manage, clients can view assigned
CREATE POLICY "Coach can manage programs"
    ON programs FOR ALL
    USING (is_coach());

CREATE POLICY "Clients can view assigned programs"
    ON programs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_program_assignments
            WHERE program_id = programs.id
            AND user_id = auth.uid()
            AND is_active = TRUE
        )
    );

-- PROGRAM WEEKS: Same as programs
CREATE POLICY "Coach can manage weeks"
    ON program_weeks FOR ALL
    USING (is_coach());

CREATE POLICY "Clients can view assigned program weeks"
    ON program_weeks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM programs p
            JOIN user_program_assignments a ON a.program_id = p.id
            WHERE p.id = program_weeks.program_id
            AND a.user_id = auth.uid()
            AND a.is_active = TRUE
        )
    );

-- WORKOUT DAYS: Same as programs
CREATE POLICY "Coach can manage workout days"
    ON workout_days FOR ALL
    USING (is_coach());

CREATE POLICY "Clients can view assigned workout days"
    ON workout_days FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM program_weeks pw
            JOIN programs p ON p.id = pw.program_id
            JOIN user_program_assignments a ON a.program_id = p.id
            WHERE pw.id = workout_days.week_id
            AND a.user_id = auth.uid()
            AND a.is_active = TRUE
        )
    );

-- WORKOUT EXERCISES: Same as programs
CREATE POLICY "Coach can manage workout exercises"
    ON workout_exercises FOR ALL
    USING (is_coach());

CREATE POLICY "Clients can view assigned workout exercises"
    ON workout_exercises FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workout_days wd
            JOIN program_weeks pw ON pw.id = wd.week_id
            JOIN programs p ON p.id = pw.program_id
            JOIN user_program_assignments a ON a.program_id = p.id
            WHERE wd.id = workout_exercises.day_id
            AND a.user_id = auth.uid()
            AND a.is_active = TRUE
        )
    );

-- ASSIGNMENTS: Coach can manage, users can view own
CREATE POLICY "Coach can manage assignments"
    ON user_program_assignments FOR ALL
    USING (is_coach());

CREATE POLICY "Users can view own assignments"
    ON user_program_assignments FOR SELECT
    USING (auth.uid() = user_id);

-- WORKOUT LOGS: Users own, coach can view all
CREATE POLICY "Users can manage own workout logs"
    ON workout_logs FOR ALL
    USING (auth.uid() = user_id OR is_coach());

-- SET LOGS: Through workout logs
CREATE POLICY "Users can manage own set logs"
    ON set_logs FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workout_logs
            WHERE id = set_logs.workout_log_id
            AND (user_id = auth.uid() OR is_coach())
        )
    );

-- WORKOUT COMPLETIONS: Through workout logs
CREATE POLICY "Users can manage own completions"
    ON workout_completions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workout_logs
            WHERE id = workout_completions.workout_log_id
            AND (user_id = auth.uid() OR is_coach())
        )
    );

-- PERSONAL RECORDS: Users own, coach can view all
CREATE POLICY "Users can view own PRs, coach can view all"
    ON personal_records FOR SELECT
    USING (auth.uid() = user_id OR is_coach());

CREATE POLICY "System can insert PRs"
    ON personal_records FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- HABITS: Users own, coach can view all
CREATE POLICY "Users can manage own habits"
    ON habits FOR ALL
    USING (auth.uid() = user_id OR is_coach());

-- NUTRITION PROFILES: Users own, coach can view all
CREATE POLICY "Users can manage own nutrition profile"
    ON nutrition_profiles FOR ALL
    USING (auth.uid() = user_id OR is_coach());

-- NUTRITION LOGS: Users own, coach can view all
CREATE POLICY "Users can manage own nutrition logs"
    ON nutrition_logs FOR ALL
    USING (auth.uid() = user_id OR is_coach());

-- ANNOUNCEMENTS: Coach can manage, everyone can view active
CREATE POLICY "Coach can manage announcements"
    ON announcements FOR ALL
    USING (is_coach());

CREATE POLICY "Everyone can view active announcements"
    ON announcements FOR SELECT
    USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_exercises_updated_at BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_program_weeks_updated_at BEFORE UPDATE ON program_weeks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_workout_days_updated_at BEFORE UPDATE ON workout_days FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_workout_exercises_updated_at BEFORE UPDATE ON workout_exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON user_program_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON habits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_nutrition_profiles_updated_at BEFORE UPDATE ON nutrition_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_nutrition_logs_updated_at BEFORE UPDATE ON nutrition_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update last_login on sign in
CREATE OR REPLACE FUNCTION handle_user_login()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE profiles SET last_login = NOW() WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
