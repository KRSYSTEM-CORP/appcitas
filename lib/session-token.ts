import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  uid: string;
  bid: string;
  businessName: string;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function signSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const full: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const data = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expectedSig = sign(data);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
