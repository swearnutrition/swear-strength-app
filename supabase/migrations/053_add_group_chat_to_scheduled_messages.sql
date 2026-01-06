-- Migration: Add group_chat support to scheduled_messages
-- Allows scheduling messages to group chats

-- Add group_chat_id column for group messages
ALTER TABLE scheduled_messages
ADD COLUMN group_chat_id UUID REFERENCES group_chats(id) ON DELETE CASCADE;

-- Update the message_type constraint to include group_chat
ALTER TABLE scheduled_messages
DROP CONSTRAINT scheduled_messages_message_type_check;

ALTER TABLE scheduled_messages
ADD CONSTRAINT scheduled_messages_message_type_check
CHECK (message_type IN ('dm', 'mass_dm', 'announcement', 'group_chat'));

-- Add index for group chat lookups
CREATE INDEX idx_scheduled_messages_group_chat ON scheduled_messages(group_chat_id)
WHERE group_chat_id IS NOT NULL;
