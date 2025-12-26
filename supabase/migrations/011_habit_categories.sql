-- Migration: Add category to habit templates
-- Allows grouping habits by type (nutrition, fitness, sleep, etc.)

-- Create habit category enum
CREATE TYPE habit_category AS ENUM (
  'nutrition',
  'fitness',
  'sleep',
  'mindset',
  'lifestyle',
  'tracking'
);

-- Add category column to habit_templates
ALTER TABLE habit_templates ADD COLUMN category habit_category;

-- Create index for category filtering
CREATE INDEX idx_habit_templates_category ON habit_templates(category);
