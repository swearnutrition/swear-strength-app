-- Migration: Habit Rivalries
-- Allows coaches to create head-to-head habit challenges between two clients

-- Create rivalry status enum
CREATE TYPE rivalry_status AS ENUM (
  'pending',
  'active',
  'completed',
  'cancelled'
);

-- Create habit rivalries table
CREATE TABLE habit_rivalries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  challenger_id UUID NOT NULL REFERENCES profiles(id),
  opponent_id UUID NOT NULL REFERENCES profiles(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status rivalry_status DEFAULT 'active',
  winner_id UUID REFERENCES profiles(id), -- Set when rivalry completes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure challenger and opponent are different
  CONSTRAINT different_rivals CHECK (challenger_id != opponent_id)
);

-- Indexes
CREATE INDEX idx_habit_rivalries_coach ON habit_rivalries(coach_id);
CREATE INDEX idx_habit_rivalries_challenger ON habit_rivalries(challenger_id);
CREATE INDEX idx_habit_rivalries_opponent ON habit_rivalries(opponent_id);
CREATE INDEX idx_habit_rivalries_status ON habit_rivalries(status) WHERE status = 'active';

-- Add rivalry_id to client_habits to link habits to a rivalry
ALTER TABLE client_habits ADD COLUMN rivalry_id UUID REFERENCES habit_rivalries(id) ON DELETE SET NULL;
CREATE INDEX idx_client_habits_rivalry ON client_habits(rivalry_id) WHERE rivalry_id IS NOT NULL;

-- Enable RLS
ALTER TABLE habit_rivalries ENABLE ROW LEVEL SECURITY;

-- Policy: Coaches can manage rivalries they created
CREATE POLICY "Coaches can manage own rivalries"
  ON habit_rivalries
  FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

-- Policy: Clients can view rivalries they're part of
CREATE POLICY "Clients can view own rivalries"
  ON habit_rivalries
  FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- Trigger for updated_at
CREATE TRIGGER update_habit_rivalries_updated_at
  BEFORE UPDATE ON habit_rivalries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- View for rivalry standings (completion counts)
CREATE OR REPLACE VIEW rivalry_standings AS
SELECT
  r.id AS rivalry_id,
  r.name,
  r.start_date,
  r.end_date,
  r.status,
  r.challenger_id,
  r.opponent_id,
  cp.name AS challenger_name,
  op.name AS opponent_name,
  -- Challenger completions
  (
    SELECT COUNT(DISTINCT hc.completed_date)
    FROM habit_completions hc
    JOIN client_habits ch ON ch.id = hc.client_habit_id
    WHERE ch.rivalry_id = r.id
    AND ch.client_id = r.challenger_id
    AND hc.completed_date >= r.start_date
    AND hc.completed_date <= r.end_date
  ) AS challenger_completions,
  -- Opponent completions
  (
    SELECT COUNT(DISTINCT hc.completed_date)
    FROM habit_completions hc
    JOIN client_habits ch ON ch.id = hc.client_habit_id
    WHERE ch.rivalry_id = r.id
    AND ch.client_id = r.opponent_id
    AND hc.completed_date >= r.start_date
    AND hc.completed_date <= r.end_date
  ) AS opponent_completions
FROM habit_rivalries r
JOIN profiles cp ON cp.id = r.challenger_id
JOIN profiles op ON op.id = r.opponent_id;
