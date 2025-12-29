-- Migration: Add RLS policies for coaches to reset client data
-- This allows coaches to delete workout history, personal records, and habit completions
-- for clients they manage (via the Reset Client feature)

-- ==============================================
-- PERSONAL RECORDS: Add DELETE policy for coaches
-- ==============================================
-- Coaches can delete personal records for their clients
-- Uses invited_by from profiles to verify coach-client relationship
CREATE POLICY "Coaches can delete client PRs"
    ON personal_records
    FOR DELETE
    USING (
        is_coach() AND
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = personal_records.user_id
            AND p.invited_by = auth.uid()
        )
    );

-- ==============================================
-- HABIT COMPLETIONS: Add DELETE policy for coaches
-- ==============================================
-- Coaches can delete habit completions for clients they manage
-- Uses coach_id from client_habits (which is set when habit is assigned)
CREATE POLICY "Coaches can delete client habit completions"
    ON habit_completions
    FOR DELETE
    USING (
        is_coach() AND
        EXISTS (
            SELECT 1 FROM client_habits ch
            WHERE ch.id = habit_completions.client_habit_id
            AND ch.coach_id = auth.uid()
        )
    );
