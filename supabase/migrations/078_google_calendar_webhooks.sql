-- Google Calendar Webhook Channels
-- Migration: 078_google_calendar_webhooks.sql
--
-- Stores watch channel information for Google Calendar push notifications.
-- When events are modified/deleted in Google Calendar, we receive webhooks
-- and can sync those changes back to our bookings table.

CREATE TABLE IF NOT EXISTS google_calendar_watch_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL, -- UUID we generate for the watch channel
  resource_id TEXT NOT NULL, -- Opaque ID returned by Google
  expiration TIMESTAMPTZ NOT NULL, -- When the channel expires (max 7 days)
  sync_token TEXT, -- For incremental sync
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_coach_watch_channel UNIQUE (coach_id)
);

-- Index for looking up by channel_id (used in webhook callbacks)
CREATE INDEX IF NOT EXISTS idx_watch_channels_channel_id ON google_calendar_watch_channels(channel_id);
CREATE INDEX IF NOT EXISTS idx_watch_channels_coach_id ON google_calendar_watch_channels(coach_id);
CREATE INDEX IF NOT EXISTS idx_watch_channels_expiration ON google_calendar_watch_channels(expiration);

-- Enable RLS
ALTER TABLE google_calendar_watch_channels ENABLE ROW LEVEL SECURITY;

-- Only coaches can manage their own watch channels
CREATE POLICY "Coaches can manage their own watch channels"
  ON google_calendar_watch_channels FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER trigger_watch_channels_updated_at
  BEFORE UPDATE ON google_calendar_watch_channels
  FOR EACH ROW
  EXECUTE FUNCTION update_session_packages_updated_at();
