-- Migration: Enforce weekly habit completion window (Mon-Sun)
-- Habits can only be logged for the current week (Monday through Sunday)
-- After Sunday 9 PM in user's timezone, the week is locked

-- Create a function to check if a date is within the current tracking week
-- The tracking week runs Mon-Sun and locks Sunday at 9 PM
CREATE OR REPLACE FUNCTION is_within_tracking_week(check_date DATE, user_timezone TEXT DEFAULT 'America/New_York')
RETURNS BOOLEAN AS $$
DECLARE
    now_in_tz TIMESTAMPTZ;
    today_in_tz DATE;
    current_dow INT; -- 0=Sun, 1=Mon, ..., 6=Sat
    week_start DATE;
    week_end DATE;
    is_after_lockout BOOLEAN;
BEGIN
    -- Get current time in user's timezone
    now_in_tz := NOW() AT TIME ZONE user_timezone;
    today_in_tz := now_in_tz::DATE;
    current_dow := EXTRACT(DOW FROM today_in_tz);

    -- Calculate this week's Monday (week start)
    -- If today is Sunday (0), week started 6 days ago
    -- If today is Monday (1), week started today
    -- etc.
    IF current_dow = 0 THEN
        week_start := today_in_tz - INTERVAL '6 days';
    ELSE
        week_start := today_in_tz - ((current_dow - 1) || ' days')::INTERVAL;
    END IF;

    -- Week ends on Sunday
    week_end := week_start + INTERVAL '6 days';

    -- Check if it's Sunday after 9 PM (lockout time)
    is_after_lockout := (current_dow = 0 AND EXTRACT(HOUR FROM now_in_tz) >= 21);

    -- If after lockout, the week is closed - no edits allowed
    IF is_after_lockout THEN
        RETURN FALSE;
    END IF;

    -- Date must be within current week (Mon-Sun)
    RETURN check_date >= week_start AND check_date <= week_end;
END;
$$ LANGUAGE plpgsql STABLE;

-- Note: We can't easily use a CHECK constraint here because we need the user's timezone
-- Instead, we'll enforce this in the application layer and RLS policy

-- Create a more restrictive RLS policy for inserts that checks the date
-- First drop existing policy if it exists
DROP POLICY IF EXISTS "Clients can manage own completions" ON habit_completions;

-- Clients can SELECT their own completions (no date restriction for viewing)
CREATE POLICY "Clients can view own completions"
    ON habit_completions
    FOR SELECT
    USING (auth.uid() = client_id);

-- Clients can INSERT only for dates in the current tracking week
CREATE POLICY "Clients can insert completions for current week"
    ON habit_completions
    FOR INSERT
    WITH CHECK (
        auth.uid() = client_id
        AND is_within_tracking_week(
            completed_date,
            COALESCE(
                (SELECT timezone FROM profiles WHERE id = auth.uid()),
                'America/New_York'
            )
        )
    );

-- Clients can UPDATE their own completions only for current week dates
CREATE POLICY "Clients can update completions for current week"
    ON habit_completions
    FOR UPDATE
    USING (auth.uid() = client_id)
    WITH CHECK (
        auth.uid() = client_id
        AND is_within_tracking_week(
            completed_date,
            COALESCE(
                (SELECT timezone FROM profiles WHERE id = auth.uid()),
                'America/New_York'
            )
        )
    );

-- Clients can DELETE their own completions only for current week dates
CREATE POLICY "Clients can delete completions for current week"
    ON habit_completions
    FOR DELETE
    USING (
        auth.uid() = client_id
        AND is_within_tracking_week(
            completed_date,
            COALESCE(
                (SELECT timezone FROM profiles WHERE id = auth.uid()),
                'America/New_York'
            )
        )
    );

COMMENT ON FUNCTION is_within_tracking_week IS
'Checks if a date is within the current Mon-Sun tracking week. Returns FALSE after Sunday 9 PM (lockout).';
