-- Migration: Remove pending client (invite_id) support from data tables
-- This simplifies the system - coaches can only assign packages/habits/programs
-- to clients who have already signed up, not pending invites.

-- ============================================
-- DROP MIGRATION FUNCTION
-- ============================================
DROP FUNCTION IF EXISTS migrate_pending_client_data(UUID, UUID);

-- ============================================
-- SESSION PACKAGES - Remove invite_id support
-- ============================================

-- First, delete any packages that are still linked to invites (orphaned)
DELETE FROM session_packages WHERE invite_id IS NOT NULL;

-- Drop the constraint that allows either client_id or invite_id
ALTER TABLE session_packages DROP CONSTRAINT IF EXISTS session_packages_client_or_invite;

-- Drop the invite_id foreign key and column
ALTER TABLE session_packages DROP CONSTRAINT IF EXISTS session_packages_invite_id_fkey;
DROP INDEX IF EXISTS idx_session_packages_invite;
ALTER TABLE session_packages DROP COLUMN IF EXISTS invite_id;

-- Make client_id NOT NULL again
ALTER TABLE session_packages ALTER COLUMN client_id SET NOT NULL;

-- ============================================
-- CLIENT HABITS - Remove invite_id support
-- ============================================

-- Delete any habits linked to invites
DELETE FROM client_habits WHERE invite_id IS NOT NULL;

-- Drop constraints
ALTER TABLE client_habits DROP CONSTRAINT IF EXISTS client_habits_client_or_invite;
DROP INDEX IF EXISTS client_habits_unique_assignment;

-- Drop invite_id column
ALTER TABLE client_habits DROP CONSTRAINT IF EXISTS client_habits_invite_id_fkey;
DROP INDEX IF EXISTS idx_client_habits_invite;
ALTER TABLE client_habits DROP COLUMN IF EXISTS invite_id;

-- Make client_id NOT NULL again
ALTER TABLE client_habits ALTER COLUMN client_id SET NOT NULL;

-- Recreate the original unique constraint
ALTER TABLE client_habits ADD CONSTRAINT client_habits_client_id_habit_template_id_start_date_key
  UNIQUE (client_id, habit_template_id, start_date);

-- ============================================
-- USER PROGRAM ASSIGNMENTS - Remove invite_id support
-- ============================================

-- Delete any program assignments linked to invites
DELETE FROM user_program_assignments WHERE invite_id IS NOT NULL;

-- Drop constraints
ALTER TABLE user_program_assignments DROP CONSTRAINT IF EXISTS program_assignments_client_or_invite;
DROP INDEX IF EXISTS program_assignments_unique;

-- Drop the RLS policy for invite-based assignments
DROP POLICY IF EXISTS "Coaches can manage program assignments for invited clients" ON user_program_assignments;

-- Drop invite_id column
ALTER TABLE user_program_assignments DROP CONSTRAINT IF EXISTS user_program_assignments_invite_id_fkey;
DROP INDEX IF EXISTS idx_program_assignments_invite;
ALTER TABLE user_program_assignments DROP COLUMN IF EXISTS invite_id;

-- Make user_id NOT NULL again
ALTER TABLE user_program_assignments ALTER COLUMN user_id SET NOT NULL;

-- Recreate the original unique constraint
ALTER TABLE user_program_assignments ADD CONSTRAINT user_program_assignments_user_id_program_id_key
  UNIQUE (user_id, program_id);

-- ============================================
-- CONVERSATIONS - Remove invite_id support
-- ============================================

-- Delete any conversations linked to invites (shouldn't be any with messages)
DELETE FROM conversations WHERE invite_id IS NOT NULL;

-- Drop constraints
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_client_or_invite;
DROP INDEX IF EXISTS conversations_unique_client;
DROP INDEX IF EXISTS conversations_unique_invite;

-- Drop invite_id column
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_invite_id_fkey;
DROP INDEX IF EXISTS idx_conversations_invite;
ALTER TABLE conversations DROP COLUMN IF EXISTS invite_id;

-- Make client_id NOT NULL again
ALTER TABLE conversations ALTER COLUMN client_id SET NOT NULL;

-- Recreate the original unique constraint
ALTER TABLE conversations ADD CONSTRAINT conversations_client_id_key UNIQUE (client_id);

-- ============================================
-- BOOKINGS - Remove invite_id support
-- ============================================

-- Delete any bookings linked to invites
DELETE FROM bookings WHERE invite_id IS NOT NULL AND client_id IS NULL;

-- Update any bookings that have both (shouldn't happen, but just in case)
UPDATE bookings SET invite_id = NULL WHERE invite_id IS NOT NULL;

-- Drop the constraint that allows invite-based bookings
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS booking_client_validation;

-- Drop invite_id column
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_invite_id_fkey;
DROP INDEX IF EXISTS idx_bookings_invite;
ALTER TABLE bookings DROP COLUMN IF EXISTS invite_id;

-- Make client_id NOT NULL
ALTER TABLE bookings ALTER COLUMN client_id SET NOT NULL;
