-- Check-in forms for virtual appointments
-- Migration: 063_checkin_forms.sql

-- Question type enum
DO $$ BEGIN
  CREATE TYPE checkin_question_type AS ENUM ('text', 'textarea', 'select', 'checkbox', 'radio');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Coach-defined form questions
CREATE TABLE IF NOT EXISTS checkin_form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_type checkin_question_type NOT NULL DEFAULT 'text',
  options JSONB, -- For select/radio/checkbox: ["Option 1", "Option 2"]
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client responses to form questions
CREATE TABLE IF NOT EXISTS checkin_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  responses JSONB NOT NULL, -- { "question_id": "answer", ... }
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_booking_response UNIQUE (booking_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkin_questions_coach ON checkin_form_questions(coach_id);
CREATE INDEX IF NOT EXISTS idx_checkin_questions_order ON checkin_form_questions(coach_id, sort_order) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_checkin_responses_booking ON checkin_form_responses(booking_id);
CREATE INDEX IF NOT EXISTS idx_checkin_responses_client ON checkin_form_responses(client_id);

-- Enable RLS
ALTER TABLE checkin_form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_form_responses ENABLE ROW LEVEL SECURITY;

-- RLS for questions
CREATE POLICY "Coaches can manage their own questions"
  ON checkin_form_questions FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Clients can view active questions from their coach"
  ON checkin_form_questions FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.client_id = auth.uid() AND b.coach_id = checkin_form_questions.coach_id
    )
  );

-- RLS for responses
CREATE POLICY "Coaches can view responses for their bookings"
  ON checkin_form_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.coach_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view their own responses"
  ON checkin_form_responses FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can submit responses for their bookings"
  ON checkin_form_responses FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update their own responses"
  ON checkin_form_responses FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Updated at trigger for questions
CREATE TRIGGER trigger_checkin_questions_updated_at
  BEFORE UPDATE ON checkin_form_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
