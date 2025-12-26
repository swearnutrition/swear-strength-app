-- Migration: Habit Completions
-- Tracks client check-ins for assigned habits

-- Create habit completions table
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_habit_id UUID NOT NULL REFERENCES client_habits(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- When it was completed
  completed_date DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),

  -- For habits with targets (e.g., 150g protein)
  value NUMERIC, -- Actual value achieved

  -- Optional note from client
  note TEXT,

  -- Prevent duplicate completions for same day
  UNIQUE(client_habit_id, completed_date)
);

-- Indexes for fast lookups
CREATE INDEX idx_habit_completions_client_habit ON habit_completions(client_habit_id);
CREATE INDEX idx_habit_completions_client ON habit_completions(client_id);
CREATE INDEX idx_habit_completions_date ON habit_completions(completed_date);
CREATE INDEX idx_habit_completions_client_date ON habit_completions(client_id, completed_date);

-- Enable RLS
ALTER TABLE habit_completions ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can manage their own completions
CREATE POLICY "Clients can manage own completions"
  ON habit_completions
  FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Policy: Coaches can view completions for their clients
CREATE POLICY "Coaches can view client completions"
  ON habit_completions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM client_habits ch
      WHERE ch.id = habit_completions.client_habit_id
      AND ch.coach_id = auth.uid()
    )
  );

-- View for habit stats (streak calculation, completion rate)
CREATE OR REPLACE VIEW habit_stats AS
SELECT
  ch.id AS client_habit_id,
  ch.client_id,
  ch.coach_id,
  ht.name AS habit_name,
  ht.frequency,
  COALESCE(ch.custom_frequency, ht.frequency) AS effective_frequency,
  COUNT(hc.id) AS total_completions,
  MAX(hc.completed_date) AS last_completed,
  MIN(hc.completed_date) AS first_completed
FROM client_habits ch
JOIN habit_templates ht ON ht.id = ch.habit_template_id
LEFT JOIN habit_completions hc ON hc.client_habit_id = ch.id
WHERE ch.is_active = TRUE
GROUP BY ch.id, ch.client_id, ch.coach_id, ht.name, ht.frequency, ch.custom_frequency;
