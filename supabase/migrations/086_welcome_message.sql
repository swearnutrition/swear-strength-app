-- Migration: Add welcome message for coaches
-- Coaches can set a welcome message that is automatically sent to new clients when they sign up

-- Add welcome_message column to profiles for coaches
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_message TEXT;

-- Add welcome_message_enabled flag
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_message_enabled BOOLEAN DEFAULT true;

-- Create trigger function to send welcome message when client accepts invite
CREATE OR REPLACE FUNCTION trigger_welcome_message()
RETURNS TRIGGER AS $$
DECLARE
    v_coach_id UUID;
    v_welcome_message TEXT;
    v_welcome_enabled BOOLEAN;
    v_conversation_id UUID;
BEGIN
    -- Only trigger when invite_accepted_at changes from NULL to a value
    IF NOT (OLD.invite_accepted_at IS NULL AND NEW.invite_accepted_at IS NOT NULL) THEN
        RETURN NEW;
    END IF;

    -- Only process if this is a client with an inviter
    IF NEW.role != 'client' OR NEW.invited_by IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the coach's welcome message settings
    SELECT id, welcome_message, COALESCE(welcome_message_enabled, true)
    INTO v_coach_id, v_welcome_message, v_welcome_enabled
    FROM profiles
    WHERE id = NEW.invited_by;

    -- If no welcome message set or disabled, skip
    IF v_welcome_message IS NULL OR v_welcome_message = '' OR NOT v_welcome_enabled THEN
        RETURN NEW;
    END IF;

    -- Create or get the conversation
    INSERT INTO conversations (client_id)
    VALUES (NEW.id)
    ON CONFLICT (client_id) DO UPDATE SET client_id = conversations.client_id
    RETURNING id INTO v_conversation_id;

    -- Send the welcome message from the coach
    INSERT INTO messages (conversation_id, sender_id, content, content_type)
    VALUES (v_conversation_id, v_coach_id, v_welcome_message, 'text');

    -- Update conversation's last_message_at
    UPDATE conversations
    SET last_message_at = NOW()
    WHERE id = v_conversation_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_client_signup_welcome ON profiles;

-- Create trigger
CREATE TRIGGER on_client_signup_welcome
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_welcome_message();

-- Set a default welcome message for existing coaches
UPDATE profiles
SET welcome_message = 'Welcome to my coaching program! I''m excited to have you on board. I''m currently getting everything set up for you, so please be patient. In the meantime, if you have any questions, feel free to message me here anytime!'
WHERE role = 'coach' AND welcome_message IS NULL;
