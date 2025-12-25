-- Add cardio-specific fields to workout_exercises
-- These allow tracking duration, distance, pace, and heart rate zones for cardio workouts

ALTER TABLE workout_exercises
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS distance DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS distance_unit TEXT DEFAULT NULL CHECK (distance_unit IN ('miles', 'km', 'meters', 'yards')),
ADD COLUMN IF NOT EXISTS target_pace TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hr_zone INTEGER DEFAULT NULL CHECK (hr_zone >= 1 AND hr_zone <= 5),
ADD COLUMN IF NOT EXISTS intervals INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS interval_rest_seconds INTEGER DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN workout_exercises.duration_seconds IS 'Duration in seconds for cardio exercises (e.g., 1800 for 30 min)';
COMMENT ON COLUMN workout_exercises.distance IS 'Distance for cardio exercises';
COMMENT ON COLUMN workout_exercises.distance_unit IS 'Unit for distance: miles, km, meters, yards';
COMMENT ON COLUMN workout_exercises.target_pace IS 'Target pace as string (e.g., "8:30/mile", "5:00/km")';
COMMENT ON COLUMN workout_exercises.hr_zone IS 'Heart rate zone 1-5';
COMMENT ON COLUMN workout_exercises.intervals IS 'Number of intervals for interval training';
COMMENT ON COLUMN workout_exercises.interval_rest_seconds IS 'Rest between intervals in seconds';
