-- Migration: Allow rivalry participants to read each other's profiles
-- This is needed so rivals can see each other's names and emails for nudging

-- Drop the existing policy and recreate with rivalry access
DROP POLICY IF EXISTS "Users can view own profile or coach can view all" ON profiles;

-- Recreate with rivalry access included
CREATE POLICY "Users can view profiles"
    ON profiles FOR SELECT
    USING (
        -- User can view their own profile
        auth.uid() = id
        -- Or coach can view all profiles
        OR is_coach()
        -- Or user is in a rivalry with this person
        OR EXISTS (
            SELECT 1 FROM habit_rivalries hr
            WHERE hr.status = 'active'
            AND (
                (hr.challenger_id = auth.uid() AND hr.opponent_id = profiles.id)
                OR (hr.opponent_id = auth.uid() AND hr.challenger_id = profiles.id)
            )
        )
    );
