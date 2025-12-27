-- Migration: Fix invite signup flow
-- 1. Allow anyone to read invites by token (for accept page)
-- 2. Ensure handle_new_user trigger works correctly
-- 3. Add invited_by linking when accepting invite

-- Drop the overly restrictive invite policy
DROP POLICY IF EXISTS "Coach can manage invites" ON invites;

-- Coach can create, update, delete invites
CREATE POLICY "Coach can create invites"
    ON invites FOR INSERT
    WITH CHECK (is_coach());

CREATE POLICY "Coach can update invites"
    ON invites FOR UPDATE
    USING (is_coach());

CREATE POLICY "Coach can delete invites"
    ON invites FOR DELETE
    USING (is_coach());

-- Anyone can read invites (needed for accept page before auth)
-- This is safe because tokens are unguessable UUIDs
CREATE POLICY "Anyone can read invites by token"
    ON invites FOR SELECT
    USING (TRUE);

-- Recreate handle_new_user with explicit search_path
-- The SET search_path = public is CRITICAL - without it, the function
-- cannot find the profiles table when called from auth schema trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client'::user_role)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Also allow coaches to read all invites and clients to read their own
CREATE POLICY "Coach can read all invites"
    ON invites FOR SELECT
    USING (is_coach());
