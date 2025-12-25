-- Add cardio_notes column to workout_days
-- This allows coaches to add free-form cardio prescriptions to any workout day
-- without needing structured exercise entries

ALTER TABLE workout_days
ADD COLUMN IF NOT EXISTS cardio_notes TEXT DEFAULT NULL;

COMMENT ON COLUMN workout_days.cardio_notes IS 'Free-form cardio prescription text (e.g., "30 min Zone 2 run" or "20 min HIIT: 30s on/30s off")';
