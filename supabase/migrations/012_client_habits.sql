-- Migration: Client Habits
-- Assigns habit templates to clients with start dates and custom settings

-- Create client habits table (assigns templates to clients)
CREATE TABLE client_habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  habit_template_id UUID NOT NULL REFERENCES habit_templates(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),

  -- Override template settings if needed
  custom_frequency habit_frequency,
  custom_times_per_week INTEGER,
  custom_specific_days INTEGER[],
  custom_target_value NUMERIC,
  custom_target_unit TEXT,

  -- Assignment details
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE, -- NULL means ongoing
  notes TEXT, -- Coach notes for the client about this habit

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate assignments
  UNIQUE(client_id, habit_template_id, start_date)
);

-- Indexes for performance
CREATE INDEX idx_client_habits_client ON client_habits(client_id);
CREATE INDEX idx_client_habits_coach ON client_habits(coach_id);
CREATE INDEX idx_client_habits_template ON client_habits(habit_template_id);
CREATE INDEX idx_client_habits_active ON client_habits(is_active) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE client_habits ENABLE ROW LEVEL SECURITY;

-- Policy: Coaches can manage habits for their clients
CREATE POLICY "Coaches can manage client habits"
  ON client_habits
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Policy: Clients can view their own assigned habits
CREATE POLICY "Clients can view own habits"
  ON client_habits
  FOR SELECT
  USING (auth.uid() = client_id);

-- Trigger for updated_at
CREATE TRIGGER update_client_habits_updated_at
  BEFORE UPDATE ON client_habits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
