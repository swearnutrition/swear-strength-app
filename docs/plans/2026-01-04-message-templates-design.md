# Message Templates & Variable Shortcuts Design

## Overview

Add message templates and variable shortcuts (`{firstname}`, `{name}`) for coaches to quickly send personalized messages to clients.

## Features

### Variable Shortcuts

Two variables available:
- `{firstname}` - Client's first name (extracted from full name)
- `{name}` - Client's full name

**Where they work:**
- DMs (instant and scheduled)
- Mass DMs (instant and scheduled)

**Not supported in:**
- Group chats
- Announcements

**Replacement behavior:**
- Variables replaced at send time, not in composer
- Case-insensitive matching (`{FirstName}` works)
- Missing name defaults to empty string

### Message Templates

**Storage:**
- New `message_templates` table
- Per-coach templates (not shared)

**UI Components:**

1. **Template Icon** - In MessageInput, next to schedule/media buttons (DMs only)

2. **Template Dropdown** - On icon click:
   - List of templates (name + preview)
   - Click to insert into message input
   - "Manage Templates" link at bottom

3. **Manage Templates Modal:**
   - List existing templates with edit/delete
   - Create new template form
   - Fields: name, content (textarea)
   - Helper text showing `{firstname}`, `{name}` variables

## Database Schema

```sql
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_templates_coach ON message_templates(coach_id);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their own templates"
  ON message_templates FOR ALL
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);
```

## API Endpoints

### GET /api/message-templates
Returns all templates for the authenticated coach.

### POST /api/message-templates
Create a new template. Body: `{ name, content }`

### PATCH /api/message-templates/[id]
Update a template. Body: `{ name?, content? }`

### DELETE /api/message-templates/[id]
Delete a template.

## Variable Replacement

### Helper Function

```typescript
function replaceVariables(content: string, client: { name: string }): string {
  const firstName = client.name?.split(' ')[0] || ''
  const fullName = client.name || ''

  return content
    .replace(/\{firstname\}/gi, firstName)
    .replace(/\{name\}/gi, fullName)
}
```

### Where Replacement Happens

1. **Instant DM** - In `/api/messages` POST handler before inserting message
2. **Scheduled DM** - In `process-scheduled-messages` edge function when processing
3. **Instant Mass DM** - In `/api/mass-dm` POST handler, per-recipient
4. **Scheduled Mass DM** - In `process-scheduled-messages` edge function, per-recipient

## UI Components

### TemplateButton
- Icon button for MessageInput
- Opens TemplateDropdown on click

### TemplateDropdown
- List of templates with name/preview
- onClick inserts template content
- "Manage Templates" link

### ManageTemplatesModal
- CRUD interface for templates
- Template list with edit/delete
- Create/edit form with name + content fields
- Variable helper text

### useMessageTemplates Hook
- Fetch, create, update, delete templates
- Loading and error states

## File Changes

### New Files
- `src/components/messaging/TemplateButton.tsx`
- `src/components/messaging/TemplateDropdown.tsx`
- `src/components/messaging/ManageTemplatesModal.tsx`
- `src/hooks/useMessageTemplates.ts`
- `src/app/api/message-templates/route.ts`
- `src/app/api/message-templates/[id]/route.ts`
- `src/lib/replaceVariables.ts`
- `supabase/migrations/055_message_templates.sql`

### Modified Files
- `src/components/messaging/MessageInput.tsx` - Add template button (conditionally for DMs)
- `src/app/api/messages/route.ts` - Apply variable replacement for DMs
- `src/app/api/mass-dm/route.ts` - Apply variable replacement per-recipient
- `supabase/functions/process-scheduled-messages/index.ts` - Apply variable replacement
