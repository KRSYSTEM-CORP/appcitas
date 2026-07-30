import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(hash, "hex");
  if (derivedKey.length !== storedBuffer.length) return false;
  return timingSafeEqual(derivedKey, storedBuffer);
}
