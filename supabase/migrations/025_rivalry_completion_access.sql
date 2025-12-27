-- Migration: Allow rivalry participants to view each other's habit completions
-- This is needed so rivals can see each other's progress/scores

-- Drop the existing SELECT policy and recreate with rivalry access
DROP POLICY IF EXISTS "Clients can view own completions" ON habit_completions;

-- Recreate with rivalry access included
CREATE POLICY "Clients can view completions"
    ON habit_completions
    FOR SELECT
    USING (
        -- User can view their own completions
        auth.uid() = client_id
        -- Or coach can view all completions
        OR is_coach()
        -- Or user is in a rivalry with this person (check via client_habits linked to rivalry)
        OR EXISTS (
            SELECT 1
            FROM client_habits ch
            JOIN habit_rivalries hr ON ch.rivalry_id = hr.id
            WHERE ch.id = habit_completions.client_habit_id
            AND hr.status = 'active'
            AND (
                (hr.challenger_id = auth.uid() AND hr.opponent_id = habit_completions.client_id)
                OR (hr.opponent_id = auth.uid() AND hr.challenger_id = habit_completions.client_id)
            )
        )
    );

-- Also allow viewing client_habits for rivals (needed to get habit IDs)
DROP POLICY IF EXISTS "Clients can view own habits" ON client_habits;

CREATE POLICY "Clients can view habits"
    ON client_habits
    FOR SELECT
    USING (
        -- User can view their own habits
        auth.uid() = client_id
        -- Or coach can view all
        OR is_coach()
        -- Or user is in a rivalry with this habit's owner
        OR EXISTS (
            SELECT 1
            FROM habit_rivalries hr
            WHERE hr.id = client_habits.rivalry_id
            AND hr.status = 'active'
            AND (hr.challenger_id = auth.uid() OR hr.opponent_id = auth.uid())
        )
    );
