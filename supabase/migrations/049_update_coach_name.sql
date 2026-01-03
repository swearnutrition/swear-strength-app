-- Migration: Update coach display name to Coach Heather
UPDATE profiles SET name = 'Coach Heather' WHERE role = 'coach';
