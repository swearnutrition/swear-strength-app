-- ============================================
-- CLIENT EXERCISE NOTES
-- Personal notes clients can leave on exercises
-- ============================================

CREATE TABLE IF NOT EXISTS client_exercise_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can have one note per exercise (they can update it)
    UNIQUE(user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_client_exercise_notes_user ON client_exercise_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_client_exercise_notes_exercise ON client_exercise_notes(exercise_id);

ALTER TABLE client_exercise_notes ENABLE ROW LEVEL SECURITY;

-- Drop policies first if they exist
DROP POLICY IF EXISTS "Users can manage own exercise notes" ON client_exercise_notes;
DROP POLICY IF EXISTS "Coaches can view client exercise notes" ON client_exercise_notes;

-- Users can manage their own exercise notes
CREATE POLICY "Users can manage own exercise notes"
    ON client_exercise_notes FOR ALL
    USING (auth.uid() = user_id);

-- Coaches can view their clients' exercise notes
-- (clients are connected to coaches via program assignments)
CREATE POLICY "Coaches can view client exercise notes"
    ON client_exercise_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_program_assignments upa
            JOIN programs p ON p.id = upa.program_id
            WHERE p.created_by = auth.uid()
            AND upa.user_id = client_exercise_notes.user_id
        )
    );
