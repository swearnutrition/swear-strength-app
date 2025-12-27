-- Migration: Add struggling habit tracking and rivalry request system

-- Add struggling_since to client_habits to track when a habit started underperforming
ALTER TABLE client_habits ADD COLUMN IF NOT EXISTS struggling_since DATE;

-- Create index for finding struggling habits
CREATE INDEX IF NOT EXISTS idx_client_habits_struggling
  ON client_habits(struggling_since)
  WHERE struggling_since IS NOT NULL;

-- Create rivalry_requests table for clients to request rivalries
CREATE TABLE IF NOT EXISTS rivalry_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id),
  client_habit_id UUID NOT NULL REFERENCES client_habits(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create partial unique index for one pending request per habit per client
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_rivalry_request
  ON rivalry_requests(client_id, client_habit_id)
  WHERE status = 'pending';

-- Create index for pending requests
CREATE INDEX IF NOT EXISTS idx_rivalry_requests_pending
  ON rivalry_requests(coach_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_rivalry_requests_client
  ON rivalry_requests(client_id);

-- Enable RLS
ALTER TABLE rivalry_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Clients can create and view their own requests
CREATE POLICY "Clients can manage own rivalry requests"
  ON rivalry_requests
  FOR ALL
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

-- Policy: Coaches can view and update requests from their clients
CREATE POLICY "Coaches can view and manage client rivalry requests"
  ON rivalry_requests
  FOR ALL
  USING (auth.uid() = coach_id);

-- Trigger for updated_at
CREATE TRIGGER update_rivalry_requests_updated_at
  BEFORE UPDATE ON rivalry_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically update struggling_since based on completion rate
-- This function is called by a cron job weekly
CREATE OR REPLACE FUNCTION update_struggling_habits()
RETURNS void AS $$
DECLARE
  habit RECORD;
  completion_rate NUMERIC;
  days_to_check INTEGER := 14;
BEGIN
  -- Get all active habits
  FOR habit IN
    SELECT ch.id, ch.client_id, ch.struggling_since
    FROM client_habits ch
    WHERE ch.is_active = true
  LOOP
    -- Calculate completion rate for last 14 days
    SELECT
      COALESCE(
        COUNT(DISTINCT hc.completed_date)::NUMERIC / days_to_check * 100,
        0
      ) INTO completion_rate
    FROM habit_completions hc
    WHERE hc.client_habit_id = habit.id
    AND hc.completed_date >= CURRENT_DATE - days_to_check
    AND hc.completed_date <= CURRENT_DATE;

    -- If completion rate is below 50%, mark as struggling
    IF completion_rate < 50 THEN
      -- Only set struggling_since if not already set
      IF habit.struggling_since IS NULL THEN
        UPDATE client_habits
        SET struggling_since = CURRENT_DATE
        WHERE id = habit.id;
      END IF;
    ELSE
      -- Clear struggling status if doing better
      IF habit.struggling_since IS NOT NULL THEN
        UPDATE client_habits
        SET struggling_since = NULL
        WHERE id = habit.id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule weekly struggling habits check (every Sunday at 8 PM)
SELECT cron.schedule(
  'update-struggling-habits-weekly',
  '0 20 * * 0', -- Every Sunday at 8 PM UTC
  $$SELECT update_struggling_habits()$$
);
