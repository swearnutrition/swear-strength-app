-- Add cancellation_reason field to bookings table
-- Also update the welcome message for coaches

-- Add cancellation_reason column
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Update the welcome message for coaches
UPDATE profiles
SET welcome_message = 'Welcome to Swear Strength!

I''m excited to have you on board. You''re all set to start booking your sessions through the app. A few things to know:

- Quick Book: Need to schedule multiple sessions at once? Use Quick Book to plan out your training over the next 3 months.
- Rescheduling: Life happens. You can cancel or reschedule directly in the app and I''ll be notified automatically.
- 24-Hour Notice: Please give me at least 24 hours heads up if you need to cancel so I can offer the slot to someone else.

If you have any questions, just message me here. Let''s get to work!'
WHERE role = 'coach';
