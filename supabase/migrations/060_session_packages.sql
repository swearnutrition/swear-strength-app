-- Session packages for in-person training clients
-- Migration: 060_session_packages.sql

-- Session packages table
CREATE TABLE IF NOT EXISTS session_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_sessions INTEGER NOT NULL CHECK (total_sessions > 0),
  remaining_sessions INTEGER NOT NULL CHECK (remaining_sessions >= 0),
  session_duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (session_duration_minutes > 0),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Package adjustment history
CREATE TABLE IF NOT EXISTS session_package_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES session_packages(id) ON DELETE CASCADE,
  adjustment INTEGER NOT NULL,
  previous_balance INTEGER NOT NULL,
  new_balance INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_packages_client_id ON session_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_coach_id ON session_packages(coach_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_expires_at ON session_packages(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_package_adjustments_package_id ON session_package_adjustments(package_id);

-- Enable RLS
ALTER TABLE session_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_package_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_packages
CREATE POLICY "Coaches can view their clients packages"
  ON session_packages FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own packages"
  ON session_packages FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can create packages for their clients"
  ON session_packages FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "Coaches can update their clients packages"
  ON session_packages FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete their clients packages"
  ON session_packages FOR DELETE
  USING (coach_id = auth.uid());

-- RLS Policies for session_package_adjustments
CREATE POLICY "Coaches can view adjustments for their packages"
  ON session_package_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.id = package_id AND sp.coach_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view adjustments for their packages"
  ON session_package_adjustments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.id = package_id AND sp.client_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can create adjustments"
  ON session_package_adjustments FOR INSERT
  WITH CHECK (
    adjusted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.id = package_id AND sp.coach_id = auth.uid()
    )
  );

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_session_packages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_session_packages_updated_at
  BEFORE UPDATE ON session_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
