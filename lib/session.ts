import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session-token";

export async function setSessionCookie(payload: Omit<SessionPayload, "exp">) {
  const token = signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export type Session = {
  userId: string;
  businessId: string;
  businessName: string;
  role: Role;
  isSuperAdmin: boolean;
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  // Re-validate against the DB on every call so a deleted user/business, or a
  // user suspended by the owner mid-session, is caught immediately instead of
  // trusting a still-valid signed cookie until it expires.
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user || user.businessId !== payload.bid || user.status !== "ACTIVE") return null;

  return {
    userId: user.id,
    businessId: user.businessId,
    businessName: payload.businessName,
    role: user.role,
    isSuperAdmin: user.isSuperAdmin,
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// Gates business configuration (branding, horarios, catálogo, staff) to the
// owner — a SPECIALIST with login access only manages their own agenda.
export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== "OWNER") redirect("/agenda");
  return session;
}

// Gates the platform-wide /admin panel — approving/denying/suspending any
// business's access. Independent of role/business: a super admin's own
// business membership is incidental, not what grants this.
export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!session.isSuperAdmin) redirect("/agenda");
  return session;
}
