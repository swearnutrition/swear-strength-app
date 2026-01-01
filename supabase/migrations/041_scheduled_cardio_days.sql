-- Add scheduled_cardio_days to user_program_assignments
-- Allows clients to specify which days they'll do cardio

ALTER TABLE user_program_assignments
ADD COLUMN scheduled_cardio_days INTEGER[] DEFAULT NULL;
