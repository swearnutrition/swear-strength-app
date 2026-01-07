-- Fix Google Calendar credentials RLS for client bookings
-- Migration: 077_fix_google_credentials_rls.sql
--
-- Problem: When a client creates a booking, they can't read the coach's
-- Google Calendar credentials due to RLS. We need to allow clients to
-- read their coach's credentials (but not modify them).

-- Add policy for clients to read their coach's Google credentials
-- Only for coaches they have a relationship with (via bookings or packages)
CREATE POLICY "Clients can read their coach google credentials"
  ON google_calendar_credentials FOR SELECT
  USING (
    -- Client has an existing booking with this coach
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.client_id = auth.uid() AND b.coach_id = google_calendar_credentials.coach_id
    )
    OR
    -- Client has a session package with this coach
    EXISTS (
      SELECT 1 FROM session_packages sp
      WHERE sp.client_id = auth.uid() AND sp.coach_id = google_calendar_credentials.coach_id
    )
    OR
    -- Client has habits assigned by this coach
    EXISTS (
      SELECT 1 FROM client_habits ch
      WHERE ch.client_id = auth.uid() AND ch.coach_id = google_calendar_credentials.coach_id
    )
  );
