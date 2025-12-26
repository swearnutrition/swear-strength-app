-- Expand program styles and add delivery method

-- Add new values to program_style enum
ALTER TYPE program_style ADD VALUE 'crossfit';
ALTER TYPE program_style ADD VALUE 'olympic_weightlifting';
ALTER TYPE program_style ADD VALUE 'strongman';
ALTER TYPE program_style ADD VALUE 'calisthenics';
ALTER TYPE program_style ADD VALUE 'hybrid';
ALTER TYPE program_style ADD VALUE 'sport_specific';

-- Create delivery method enum for how client receives the program
CREATE TYPE program_delivery AS ENUM ('pdf', 'app', 'in_person', 'hybrid');

-- Add delivery method column
ALTER TABLE programs
ADD COLUMN delivery_method program_delivery DEFAULT 'pdf';
