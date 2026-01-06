-- Add archived column to announcements table
ALTER TABLE announcements
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for archived status
CREATE INDEX IF NOT EXISTS idx_announcements_archived ON announcements(archived, created_at DESC);
