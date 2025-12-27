-- Migration: Ensure correct RLS policies for rivalry data access
-- This migration fixes any inconsistencies from previous migrations

-- ============================================
-- habit_completions RLS policies
-- ============================================

-- Drop ALL existing SELECT policies on habit_completions
DROP POLICY IF EXISTS "Clients can view own completions" ON habit_completions;
DROP POLICY IF EXISTS "Clients can view completions" ON habit_completions;
DROP POLICY IF EXISTS "Coach can view all completions" ON habit_completions;

-- Create the correct SELECT policy that allows rivalry access
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

-- ============================================
-- client_habits RLS policies
-- ============================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Clients can view own habits" ON client_habits;
DROP POLICY IF EXISTS "Clients can view habits" ON client_habits;
DROP POLICY IF EXISTS "Coach can view all habits" ON client_habits;

-- Create the correct SELECT policy
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

-- ============================================
-- profiles RLS policies
-- ============================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Users can view own profile or coach can view all" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

-- Create the correct SELECT policy
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
