import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client — full read/write on every bucket/table, bypasses RLS.
// Server-only by construction (the key must never reach the browser); used
// for sending Realtime broadcast pings after a mutation succeeds.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
