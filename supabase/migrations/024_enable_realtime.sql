-- Migration: Enable Supabase Realtime for rivalry-related tables
-- This allows clients to receive real-time updates when habits are completed

-- Enable realtime for habit_completions table
ALTER PUBLICATION supabase_realtime ADD TABLE habit_completions;

-- Enable realtime for rivalry_comments table
ALTER PUBLICATION supabase_realtime ADD TABLE rivalry_comments;

-- Enable realtime for client_notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE client_notifications;
