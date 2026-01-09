-- Migration: Fix invite delete policy
-- The delete policy was only checking is_coach() but not verifying ownership
-- This caused RLS errors when coaches tried to delete invites

-- Drop the existing delete policy
DROP POLICY IF EXISTS "Coach can delete invites" ON invites;

-- Recreate with proper ownership check
CREATE POLICY "Coach can delete invites"
    ON invites FOR DELETE
    USING (is_coach() AND created_by = auth.uid());
