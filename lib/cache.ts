import "server-only";
import { Redis } from "@upstash/redis";

// automaticDeserialization disabled so GET always returns the raw stored
// string — we parse it ourselves (see reviveDates) instead of letting the
// SDK's default JSON.parse silently turn every cached Date into a plain
// string, which breaks any code downstream that calls a Date method
// (Intl.DateTimeFormat, .getTime(), etc.) on what it still thinks is a Date.
const redis = Redis.fromEnv({ automaticDeserialization: false });

// ISO 8601 date-time, e.g. "2026-08-29T14:32:00.000Z" — exactly what
// JSON.stringify produces for a Date via its toJSON(), so this only ever
// fires on values that really were Date instances before caching.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === "string" && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

// Every key is prefixed "citas:" — this Upstash database is shared with KR
// POS, and the prefix keeps the two apps' keys visually distinct in the
// Upstash console even though their tenant IDs (different databases, cuid
// primary keys) can never actually collide.
const PREFIX = "citas:";

// Read-through cache: serves a cached value when present, otherwise calls
// fetcher, caches the result, and returns it. Redis failures never break the
// app — a read/write error just falls through to (or skips caching) the
// real data source, since a cache is an optimization, not a source of truth.
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const fullKey = PREFIX + key;
  try {
    const raw = await redis.get<string>(fullKey);
    if (raw != null) return JSON.parse(raw, reviveDates) as T;
  } catch (err) {
    console.error("[cache] read failed, falling through to source:", fullKey, err);
  }

  const value = await fetcher();

  try {
    await redis.set(fullKey, JSON.stringify(value), { ex: ttlSeconds });
  } catch (err) {
    console.error("[cache] write failed:", fullKey, err);
  }

  return value;
}

// Call alongside revalidatePath() in any action that mutates data a cached
// key above depends on.
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    await redis.del(...keys.map((k) => PREFIX + k));
  } catch (err) {
    console.error("[cache] invalidate failed:", keys, err);
  }
}
