import { createBrowserClient } from '@supabase/ssr'

// Note: Using untyped client for now. Once Supabase project is created,
// generate types with: npx supabase gen types typescript --project-id <your-project-id> > src/lib/supabase/database.types.ts
// Then update this file to use the generated types.

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
