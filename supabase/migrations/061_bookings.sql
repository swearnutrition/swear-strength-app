-- Bookings table for sessions and check-ins
-- Migration: 061_bookings.sql

-- Booking type enum
DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM ('session', 'checkin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Booking status enum
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed', 'no_show');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id UUID REFERENCES session_packages(id) ON DELETE SET NULL,
  booking_type booking_type NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  google_event_id TEXT,
  google_meet_link TEXT,
  rescheduled_from_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_time_range CHECK (ends_at > starts_at),
  CONSTRAINT checkin_has_no_package CHECK (
    (booking_type = 'session' AND package_id IS NOT NULL) OR
    (booking_type = 'checkin' AND package_id IS NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_coach_id ON bookings(coach_id);
CREATE INDEX IF NOT EXISTS idx_bookings_package_id ON bookings(package_id) WHERE package_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_type_status ON bookings(booking_type, status);

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Coaches can view all their bookings"
  ON bookings FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own bookings"
  ON bookings FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "Clients can create their own bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'client'
    )
  );

CREATE POLICY "Coaches can update their bookings"
  ON bookings FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Clients can update their own bookings"
  ON bookings FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER trigger_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
