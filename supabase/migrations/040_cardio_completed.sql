-- Add cardio_completed field to workout_completions
-- Tracks whether the client completed the prescribed cardio for this workout

ALTER TABLE workout_completions
ADD COLUMN cardio_completed BOOLEAN DEFAULT NULL;

-- NULL = no cardio prescribed, true = completed, false = skipped
