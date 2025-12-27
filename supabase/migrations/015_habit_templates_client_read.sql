-- Migration: Allow clients to read habit templates assigned to them
-- Clients need to see the template details (name, description, target, etc.) for their assigned habits

-- Policy: Clients can read habit templates that are assigned to them
CREATE POLICY "Clients can read assigned habit templates"
  ON habit_templates
  FOR SELECT
  USING (
    id IN (
      SELECT habit_template_id
      FROM client_habits
      WHERE client_id = auth.uid()
      AND is_active = true
    )
  );
