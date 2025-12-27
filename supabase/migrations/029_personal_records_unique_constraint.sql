-- Add unique constraint for upsert on personal_records
ALTER TABLE personal_records
ADD CONSTRAINT personal_records_user_exercise_type_unique
UNIQUE (user_id, exercise_id, record_type);
