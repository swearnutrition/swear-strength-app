-- Allow users to update their own assignment's schedule preferences
-- ============================================

-- Drop if exists, then create
DROP POLICY IF EXISTS "Users can update own assignment schedule" ON user_program_assignments;

-- Users can update specific columns on their own assignments
CREATE POLICY "Users can update own assignment schedule"
    ON user_program_assignments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
