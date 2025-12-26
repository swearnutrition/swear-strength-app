-- Program Tags Migration
-- Adds difficulty, style tags, and primary muscle focus to programs

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE program_difficulty AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE program_style AS ENUM ('powerlifting', 'bodybuilding', 'general_fitness', 'athletic', 'rehab_prehab');

-- ============================================
-- ADD COLUMNS TO PROGRAMS TABLE
-- ============================================
ALTER TABLE programs
ADD COLUMN difficulty program_difficulty,
ADD COLUMN style program_style,
ADD COLUMN primary_muscles TEXT[] DEFAULT '{}';

-- Index for filtering by difficulty and style
CREATE INDEX idx_programs_difficulty ON programs(difficulty);
CREATE INDEX idx_programs_style ON programs(style);
