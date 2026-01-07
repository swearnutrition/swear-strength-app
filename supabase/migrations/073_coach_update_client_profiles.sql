-- Migration: Allow coaches to update client profiles (for client_type, etc.)

-- Create policy for coaches to update client profiles
CREATE POLICY "Coaches can update client profiles"
ON profiles FOR UPDATE
TO authenticated
USING (
    is_coach() AND role = 'client'
)
WITH CHECK (
    is_coach() AND role = 'client'
);
