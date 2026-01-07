-- Fix session functions to properly bypass RLS
-- Migration: 076_fix_session_functions_rls.sql
--
-- The SECURITY DEFINER functions need to:
-- 1. Use SET search_path to prevent injection
-- 2. Be owned by postgres to bypass RLS
-- 3. Have proper error handling

-- Drop existing functions
DROP FUNCTION IF EXISTS decrement_session(UUID);
DROP FUNCTION IF EXISTS increment_session(UUID);

-- Recreate decrement_session with RLS bypass
CREATE OR REPLACE FUNCTION decrement_session(package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE session_packages
  SET remaining_sessions = remaining_sessions - 1
  WHERE id = package_id AND remaining_sessions > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate increment_session with RLS bypass (for refunds on cancellation)
CREATE OR REPLACE FUNCTION increment_session(package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE session_packages
  SET remaining_sessions = remaining_sessions + 1
  WHERE id = package_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION decrement_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_session(UUID) TO authenticated;

-- Add policy for clients to update their own session packages
-- This allows the SECURITY DEFINER functions to work when called by clients
-- Note: Using DO block to handle "policy already exists" gracefully
DO $$
BEGIN
  -- Try to create the policy, ignore if it already exists
  BEGIN
    CREATE POLICY "Clients can update their session count"
      ON session_packages FOR UPDATE
      USING (client_id = auth.uid())
      WITH CHECK (client_id = auth.uid());
  EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, that's fine
    NULL;
  END;
END
$$;
