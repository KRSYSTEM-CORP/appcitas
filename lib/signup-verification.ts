import "server-only";
import { createHash, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

// Shared by both signup entry points that need to hold a pending account
// behind an emailed code: the email/password form (requestSignupCode, see
// lib/actions/auth.ts) and a brand-new Google signup (app/api/auth/google/
// callback/route.ts). Either way, confirmSignupCode() is what actually
// finishes provisioning once the code checks out.
export const SIGNUP_CODE_TTL_MS = 10 * 60 * 1000;
export const SIGNUP_CODE_MAX_ATTEMPTS = 5;

export function hashSignupCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateSignupCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Only one pending signup per email at a time — a retry (e.g. "no me llegó
// el código") replaces the previous attempt instead of piling up rows that
// would otherwise all race to create the same account.
export async function createSignupVerification(
  email: string,
  payload: unknown
): Promise<{ verificationId: string; code: string }> {
  const code = generateSignupCode();
  await prisma.signupVerification.deleteMany({ where: { email } });
  const verification = await prisma.signupVerification.create({
    data: {
      email,
      codeHash: hashSignupCode(code),
      payload: JSON.stringify(payload),
      expiresAt: new Date(Date.now() + SIGNUP_CODE_TTL_MS),
    },
  });
  return { verificationId: verification.id, code };
}
