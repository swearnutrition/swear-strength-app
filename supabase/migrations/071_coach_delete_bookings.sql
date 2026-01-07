-- Allow coaches to delete their own bookings
-- Migration: 071_coach_delete_bookings.sql

-- Drop existing DELETE policy if any
DROP POLICY IF EXISTS "Coaches can delete their bookings" ON bookings;

-- Create DELETE policy for coaches
CREATE POLICY "Coaches can delete their bookings"
  ON bookings FOR DELETE
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Also add UPDATE policy for coaches if not exists
DROP POLICY IF EXISTS "Coaches can update their bookings" ON bookings;

CREATE POLICY "Coaches can update their bookings"
  ON bookings FOR UPDATE
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  )
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coach'
    )
  );
