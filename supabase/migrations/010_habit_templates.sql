-- Migration: Habit Templates
-- Allows coaches to create reusable habit templates for client assignment

-- Create update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create habit frequency enum
CREATE TYPE habit_frequency AS ENUM (
  'daily',
  'weekly',
  'monthly',
  'times_per_week',
  'specific_days',
  'biweekly'
);

-- Create habit templates table
CREATE TABLE habit_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  frequency habit_frequency NOT NULL DEFAULT 'daily',
  times_per_week INTEGER,
  specific_days INTEGER[],
  target_value NUMERIC,
  target_unit TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by coach
CREATE INDEX idx_habit_templates_created_by ON habit_templates(created_by);

-- Enable RLS
ALTER TABLE habit_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Coaches can manage their own habit templates
CREATE POLICY "Coaches can manage own habit templates"
  ON habit_templates
  FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Trigger for updated_at
CREATE TRIGGER update_habit_templates_updated_at
  BEFORE UPDATE ON habit_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
