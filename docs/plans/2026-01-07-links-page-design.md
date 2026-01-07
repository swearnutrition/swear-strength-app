# Links Page & Leads Management Design

## Overview

A linktree-style public page at `/links` for Instagram bio linking, featuring an inquiry form for potential clients, social media links, and a LyteBite sponsorship callout. Includes a coach dashboard page for managing leads.

## Page Structure

**URL:** `/links` (public, no authentication required)

### Layout (top to bottom)

1. **Hero Section**
   - Logo (large, centered, with purple glow effect)
   - Tagline: "I fix messy technique and build strong lifters."
   - Location: Rancho Cucamonga, CA

2. **Inquiry Form Card** (primary focus)
   - Gradient border (purple-to-pink)
   - Headline: "Train With Me"
   - Form fields detailed below

3. **LyteBite Sponsor Card**
   - LyteBite logo with their cyan brand color
   - Callout text: "Fuel your training with clean eats"
   - Discount code: "Use code **SWEAR** for a discount"
   - Link button to https://www.lytebite.com

4. **Social Links**
   - Instagram: instagram.com/swearstrength
   - TikTok: tiktok.com/@swearstrength
   - YouTube: youtube.com/@swearstrength
   - Facebook: facebook.com/swearstrength
   - LinkedIn: linkedin.com/in/heatherswear/

## Inquiry Form Fields

| Field | Type | Required | Options/Placeholder |
|-------|------|----------|---------------------|
| Name | text | Yes | - |
| Email | email | Yes | - |
| Phone | tel | No | - |
| Training Experience | select | Yes | "Brand new to lifting", "Less than 1 year", "1-3 years", "3-5 years", "5+ years" |
| Goals | multi-select checkboxes | Yes | "Build strength", "Fix/improve technique", "General health & fitness", "Fat loss / weight loss", "Build muscle", "Improve posture", "Other" |
| Training Format | select | Yes | "Online (independent/busy lifestyle)", "Hybrid (see me sometimes, workout on own most of the time)", "Fully in-person" |
| Current Situation | textarea | Yes | "Tell me about your gym setup, current program, and equipment access..." |
| Anything else? | textarea | No | "Anything else you'd like me to know..." |

**Submit Button:** "Send Inquiry" (purple gradient)

## Visual Styling

### Colors & Effects
- Dark background: `#0a0a0a`
- Logo with purple glow effect
- Inquiry form card: gradient border (purple-to-pink matching logo)
- LyteBite card: elevated/glass style with cyan accent from their branding
- Social buttons: purple-to-indigo gradient fill

### Social Link Buttons
- Full-width buttons with icon + platform name
- Purple-to-indigo gradient background
- Hover: scale up + glow effect
- Order: Instagram, TikTok, YouTube, Facebook, LinkedIn

### LyteBite Card
- Cyan accent color from their logo (#00B4D8 approximate)
- White text on elevated dark card
- Bold code display

### Responsive
- Mobile-first single column layout
- All elements stack vertically
- Form fields full-width

## Database Schema

### New Table: `leads`

```sql
create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  training_experience text not null,
  goals text[] not null,
  training_format text not null,
  current_situation text not null,
  anything_else text,
  status text not null default 'new',
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS policies
alter table leads enable row level security;

-- Only authenticated coaches can view leads
create policy "Coaches can view leads"
  on leads for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'coach'
    )
  );

-- Public can insert leads (form submission)
create policy "Public can submit leads"
  on leads for insert
  with check (true);

-- Coaches can update leads (status, notes)
create policy "Coaches can update leads"
  on leads for update
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'coach'
    )
  );
```

### Status Values
- `new` - Just submitted, not yet reviewed
- `contacted` - Coach has reached out
- `converted` - Became a client
- `closed` - Not moving forward

## Coach Dashboard: Leads Page

**URL:** `/coach/leads`

### Features
- Table view of all inquiries
- Columns: Name, Email, Training Format, Status, Date
- Filter by status (all, new, contacted, converted, closed)
- Click row to expand full details in modal/drawer
- Quick actions:
  - Change status dropdown
  - Add/edit notes
  - Email link (mailto:)
- Sort by date (newest first by default)

### Lead Detail View
- All form fields displayed
- Status selector
- Notes textarea (internal use)
- Contact button (opens email)
- Timestamps (created, updated)

## Email Notification

When a new lead is submitted:
- Send email to coach's registered email
- Subject: "New Training Inquiry from [Name]"
- Body includes all form answers
- Link to view in dashboard

## API Routes

### POST `/api/leads`
- Public endpoint (no auth)
- Validates form data
- Inserts into database
- Triggers email notification
- Returns success/error

### GET `/api/leads`
- Protected (coach only)
- Returns all leads with optional status filter
- Supports pagination

### PATCH `/api/leads/[id]`
- Protected (coach only)
- Updates status and/or notes

## Implementation Notes

- Use existing form components (Input, Select, Checkbox, Button)
- Add new Checkbox group component if needed for multi-select goals
- LyteBite logo will need to be added to public assets
- Email service: use existing email infrastructure or add Resend/SendGrid
