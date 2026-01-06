-- Coach availability templates and overrides
-- Migration: 062_coach_availability.sql

-- Availability type enum
DO $$ BEGIN
  CREATE TYPE availability_type AS ENUM ('session', 'checkin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Weekly availability templates
CREATE TABLE IF NOT EXISTS coach_availability_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  availability_type availability_type NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_concurrent_clients INTEGER NOT NULL DEFAULT 2 CHECK (max_concurrent_clients > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  CONSTRAINT unique_coach_day_type UNIQUE (coach_id, availability_type, day_of_week, start_time)
);

-- Date-specific overrides (blackouts or extra availability)
CREATE TABLE IF NOT EXISTS coach_availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  availability_type availability_type NOT NULL,
  override_date DATE NOT NULL,
  start_time TIME, -- NULL means entire day
  end_time TIME,
  is_blocked BOOLEAN NOT NULL DEFAULT true,
  max_concurrent_clients INTEGER CHECK (max_concurrent_clients > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_override_time CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_availability_templates_coach ON coach_availability_templates(coach_id);
CREATE INDEX IF NOT EXISTS idx_availability_templates_lookup ON coach_availability_templates(coach_id, availability_type, day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_coach ON coach_availability_overrides(coach_id);
CREATE INDEX IF NOT EXISTS idx_availability_overrides_lookup ON coach_availability_overrides(coach_id, availability_type, override_date);

-- Enable RLS
ALTER TABLE coach_availability_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_availability_overrides ENABLE ROW LEVEL SECURITY;

-- RLS for templates
CREATE POLICY "Coaches can manage their own templates"
  ON coach_availability_templates FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Anyone can view coach templates"
  ON coach_availability_templates FOR SELECT
  USING (true);

-- RLS for overrides
CREATE POLICY "Coaches can manage their own overrides"
  ON coach_availability_overrides FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Anyone can view coach overrides"
  ON coach_availability_overrides FOR SELECT
  USING (true);
