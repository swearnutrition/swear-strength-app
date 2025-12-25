-- ============================================
-- ADD PDF EXPORT SETTINGS TO PROGRAMS
-- ============================================

-- Add PDF-related columns to programs table
ALTER TABLE programs
ADD COLUMN IF NOT EXISTS pdf_schedule JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pdf_tips TEXT[] DEFAULT NULL;

-- pdf_schedule stores the weekly schedule configuration
-- Example: ["Upper Body A", "Rest", "Lower Body A", "Rest", "Upper Body B", "Rest", "Lower Body B"]
--
-- pdf_tips stores custom tips for the program
-- Example: ["Rest 60-90 seconds between sets", "Focus on controlled movements"]

COMMENT ON COLUMN programs.pdf_schedule IS 'Weekly schedule for PDF export (7 days, workout names or Rest)';
COMMENT ON COLUMN programs.pdf_tips IS 'Custom tips to display in PDF export';
