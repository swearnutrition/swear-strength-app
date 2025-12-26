-- Add injury-friendly tags to programs
-- These indicate which body parts the program is safe for or avoids stressing

ALTER TABLE programs
ADD COLUMN injury_friendly TEXT[] DEFAULT '{}';

-- Index for filtering
CREATE INDEX idx_programs_injury_friendly ON programs USING GIN(injury_friendly);
