import "server-only";
import { headers } from "next/headers";

// Vercel sets x-forwarded-for with the real client IP first in the list
// (any proxies it passed through are appended after). Falls back to a
// constant key in local dev / when the header is missing, so rate limiting
// degrades to "shared across all local requests" instead of throwing.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
