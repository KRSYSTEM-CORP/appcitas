import "server-only";
import { prisma } from "@/lib/prisma";

// Simple DB-backed sliding-window limiter for the unauthenticated auth
// surface (login, password-reset request) — there's no session yet at that
// point, so this can't piggyback on withTenant/RLS the way everything else
// does. A serverless-safe alternative to an in-memory counter, which
// wouldn't survive across Vercel function instances anyway.
function buildKey(scope: string, identifier: string): string {
  return `${scope}:${identifier.trim().toLowerCase()}`;
}

export type RateLimitStatus = { allowed: boolean; retryAfterMinutes: number };

export async function checkRateLimit(
  scope: string,
  identifier: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitStatus> {
  const key = buildKey(scope, identifier);
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.loginAttempt.count({ where: { key, createdAt: { gte: since } } });
  if (count >= maxAttempts) {
    return { allowed: false, retryAfterMinutes: Math.ceil(windowMs / 60_000) };
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

// Recorded on every failed attempt (wrong password, unknown email) — never
// on a merely malformed submission, so a validation typo doesn't cost the
// user part of their attempt budget.
export async function recordFailedAttempt(scope: string, identifier: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { key: buildKey(scope, identifier) } });
}

// Called on a successful login so a legitimate user who mistyped their
// password a few times isn't left sitting near the limit afterward.
export async function clearAttempts(scope: string, identifier: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key: buildKey(scope, identifier) } });
}

export function rateLimitMessage(retryAfterMinutes: number): string {
  return `Demasiados intentos. Espera ${retryAfterMinutes} minutos e intenta de nuevo.`;
}
