import "server-only";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fire-and-forget "something changed, refetch" ping over Supabase Realtime's
// REST broadcast endpoint — no business data in the payload, so a leaked
// channel name discloses nothing; the real data still only ever comes back
// through our own tenant-scoped, session-authenticated queries. Never
// awaited for its result by callers — a dropped ping just means a screen
// catches up on its next normal revalidation instead of instantly.
export async function notifyLive(channel: string, event: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ topic: channel, event, payload: {} }] }),
    });
  } catch {
    // Best-effort — never blocks or fails the mutation it followed.
  }
}

export function agendaChannel(businessId: string) {
  return `citas:${businessId}`;
}
