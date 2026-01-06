-- Functions to manage session counts atomically
-- Migration: 066_session_functions.sql

-- Decrement session count
CREATE OR REPLACE FUNCTION decrement_session(package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE session_packages
  SET remaining_sessions = remaining_sessions - 1
  WHERE id = package_id AND remaining_sessions > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment session count (for refunds)
CREATE OR REPLACE FUNCTION increment_session(package_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE session_packages
  SET remaining_sessions = remaining_sessions + 1
  WHERE id = package_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION decrement_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_session(UUID) TO authenticated;
