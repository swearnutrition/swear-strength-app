-- Add booking_cancelled and booking_rescheduled notification types
ALTER TABLE coach_notifications
DROP CONSTRAINT IF EXISTS coach_notifications_type_check;

ALTER TABLE coach_notifications
ADD CONSTRAINT coach_notifications_type_check
CHECK (type IN (
  'missed_workout',
  'workout_completed',
  'program_started',
  'streak_milestone',
  'inactive_warning',
  'workout_inactive',
  'booking_cancelled',
  'booking_rescheduled'
));
