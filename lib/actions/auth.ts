"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { sendPasswordResetEmail, sendSignupCodeEmail } from "@/lib/email";
import { createBusinessWithOwner } from "@/lib/business-provisioning";
import {
  SIGNUP_CODE_TTL_MS,
  SIGNUP_CODE_MAX_ATTEMPTS,
  hashSignupCode,
  generateSignupCode,
  createSignupVerification,
} from "@/lib/signup-verification";
import { checkRateLimit, recordFailedAttempt, clearAttempts, rateLimitMessage } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { verifyTurnstileToken } from "@/lib/turnstile";
import {
  LoginSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  SignupSchema,
} from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const RESET_REQUEST_MAX_ATTEMPTS = 3;
const SIGNUP_RESEND_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_RESEND_MAX_ATTEMPTS = 3;
const TERMS_ERROR = "Debes aceptar los Términos y Condiciones y la Política de Privacidad para continuar.";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// subdomain is only set for the manual path (already validated unique) —
// omitted for a Google signup, which lets createBusinessWithOwner generate
// one from businessName, exactly like it always did for Google before this
// change. passwordHash is set for the email/password path, googleId for a
// brand-new Google signup — never both.
type SignupPayload = {
  businessName: string;
  subdomain?: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  firstName: string;
  lastName: string;
};

export type SignupCodeResult =
  | { success: true; verificationId: string; email: string }
  | { success: false; error: string };

// Step 1 of signup: validates the form, emails a 6-digit code, and stashes
// everything needed to finish provisioning in SignupVerification — the
// Business/User only get created once confirmSignupCode() checks the code,
// so an abandoned or fake signup never leaves a half-created business
// behind. Auto-logs in and lands on /agenda once confirmed, the same way
// the Google signup path (app/api/auth/google/callback) does (Google's
// signup skips this: Google already confirmed that address).
export async function requestSignupCode(formData: FormData): Promise<SignupCodeResult> {
  const ip = await getClientIp();
  const rl = await checkRateLimit("signup", ip, 5, 60 * 60_000);
  if (!rl.allowed) return { success: false, error: rateLimitMessage(rl.retryAfterMinutes) };
  await recordFailedAttempt("signup", ip);

  const turnstileToken = formData.get("cf-turnstile-response");
  const turnstileOk = await verifyTurnstileToken(typeof turnstileToken === "string" ? turnstileToken : "", ip);
  if (!turnstileOk) return { success: false, error: "No pudimos verificar que eres humano. Intenta de nuevo." };

  const parsed = SignupSchema.safeParse({
    businessName: formData.get("businessName"),
    subdomain: formData.get("subdomain"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { businessName, subdomain, email, password } = parsed.data;

  const [existingUser, existingSubdomain] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.business.findUnique({ where: { subdomain } }),
  ]);
  if (existingUser) {
    return { success: false, error: "Ese correo ya está registrado" };
  }
  if (existingSubdomain) {
    return { success: false, error: "Ese subdominio ya está en uso, elige otro" };
  }

  if (formData.get("acceptedTerms") !== "on") {
    return { success: false, error: TERMS_ERROR };
  }

  const passwordHash = hashPassword(password);
  const payload: SignupPayload = {
    businessName,
    subdomain,
    email,
    passwordHash,
    firstName: businessName,
    lastName: "",
  };
  const { verificationId, code } = await createSignupVerification(email, payload);

  await sendSignupCodeEmail(email, code);

  return { success: true, verificationId, email };
}

// Step 2: checks the code and, only if it matches, actually creates the
// business/owner and logs them in. acceptedTerms is required here (not
// just at request time) because a brand-new Google signup (see
// app/api/auth/google/callback/route.ts) never goes through
// requestSignupCode at all — this is the one place both paths are
// guaranteed to pass through.
export async function confirmSignupCode(
  verificationId: string,
  code: string,
  acceptedTerms: boolean
): Promise<ActionResult> {
  if (!acceptedTerms) {
    return { success: false, error: TERMS_ERROR };
  }

  const genericError = "Este código venció o no es válido. Solicita uno nuevo.";
  const verification = await prisma.signupVerification.findUnique({ where: { id: verificationId } });
  if (!verification) return { success: false, error: genericError };

  if (verification.expiresAt < new Date()) {
    await prisma.signupVerification.delete({ where: { id: verificationId } });
    return { success: false, error: genericError };
  }

  if (verification.attempts >= SIGNUP_CODE_MAX_ATTEMPTS) {
    await prisma.signupVerification.delete({ where: { id: verificationId } });
    return { success: false, error: "Demasiados intentos. Solicita un nuevo código." };
  }

  if (hashSignupCode(code) !== verification.codeHash) {
    await prisma.signupVerification.update({
      where: { id: verificationId },
      data: { attempts: { increment: 1 } },
    });
    const remaining = SIGNUP_CODE_MAX_ATTEMPTS - verification.attempts - 1;
    return { success: false, error: `Código incorrecto. Te quedan ${remaining} intentos.` };
  }

  const { businessName, subdomain, email, passwordHash, googleId, firstName, lastName } = JSON.parse(
    verification.payload
  ) as SignupPayload;

  // Re-checked here (not just at request time) in case the address or
  // subdomain was taken by someone else in the minutes between requesting
  // and confirming the code. subdomain is undefined for a Google signup —
  // nothing to re-check, createBusinessWithOwner generates one below.
  const [existingUser, existingSubdomain] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    subdomain ? prisma.business.findUnique({ where: { subdomain } }) : Promise.resolve(null),
  ]);
  if (existingUser || existingSubdomain) {
    await prisma.signupVerification.delete({ where: { id: verificationId } });
    return {
      success: false,
      error: existingUser ? "Ese correo ya está registrado" : "Ese subdominio ya está en uso, elige otro",
    };
  }

  const { business, user } = await createBusinessWithOwner(
    businessName,
    { email, passwordHash, googleId, firstName, lastName },
    subdomain,
  );
  await prisma.signupVerification.delete({ where: { id: verificationId } });

  await setSessionCookie({ uid: user.id, bid: business.id, businessName: business.name });
  redirect("/agenda");
}

// "No me llegó el código" — reuses the same verification row (same payload,
// same email) with a fresh code/expiry/attempt count.
export async function resendSignupCode(verificationId: string): Promise<ActionResult> {
  const verification = await prisma.signupVerification.findUnique({ where: { id: verificationId } });
  if (!verification) {
    return { success: false, error: "Esta verificación venció. Vuelve a empezar el registro." };
  }

  const rl = await checkRateLimit("signup-resend", verificationId, SIGNUP_RESEND_MAX_ATTEMPTS, SIGNUP_RESEND_WINDOW_MS);
  if (!rl.allowed) return { success: false, error: rateLimitMessage(rl.retryAfterMinutes) };
  await recordFailedAttempt("signup-resend", verificationId);

  const code = generateSignupCode();
  await prisma.signupVerification.update({
    where: { id: verificationId },
    data: { codeHash: hashSignupCode(code), attempts: 0, expiresAt: new Date(Date.now() + SIGNUP_CODE_TTL_MS) },
  });
  await sendSignupCodeEmail(verification.email, code);

  return { success: true };
}

export async function login(formData: FormData): Promise<ActionResult> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { email, password } = parsed.data;
  const genericError = "Correo o contraseña incorrectos";

  const limit = await checkRateLimit("login", email, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
  if (!limit.allowed) {
    return { success: false, error: rateLimitMessage(limit.retryAfterMinutes) };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: true },
  });
  // user.passwordHash is null on an account that only ever signed up with
  // Google (see app/api/auth/google/callback) — a password attempt against
  // it must fail the same generic way as a non-existent email, not throw.
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    await recordFailedAttempt("login", email);
    return { success: false, error: genericError };
  }
  await clearAttempts("login", email);

  if (user.status === "PENDING") {
    return {
      success: false,
      error: "Tu negocio está pendiente de aprobación. Te avisaremos cuando puedas ingresar.",
    };
  }
  if (user.status === "SUSPENDED") {
    return { success: false, error: "Tu acceso ha sido suspendido. Contacta al administrador de KR System." };
  }

  await setSessionCookie({
    uid: user.id,
    bid: user.businessId,
    businessName: user.business.name,
  });

  redirect(user.role === "OWNER" ? "/settings" : "/agenda");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

// Always returns success regardless of whether the email is registered, so
// this form can't be used to discover which emails have accounts.
export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = RequestPasswordResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Checked (and recorded) regardless of whether the email is registered —
  // otherwise this endpoint could be used to email-bomb any address, real
  // account or not, without ever tripping a limit.
  const limit = await checkRateLimit(
    "password-reset",
    parsed.data.email,
    RESET_REQUEST_MAX_ATTEMPTS,
    RESET_REQUEST_WINDOW_MS
  );
  if (!limit.allowed) {
    return { success: false, error: rateLimitMessage(limit.retryAfterMinutes) };
  }
  await recordFailedAttempt("password-reset", parsed.data.email);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await sendPasswordResetEmail(parsed.data.email, rawToken);
  }

  return { success: true };
}

export async function resetPassword(token: string, formData: FormData): Promise<ActionResult> {
  const parsed = ResetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const genericError = "Este enlace no es válido o ya venció. Solicita uno nuevo.";
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { success: false, error: genericError };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: hashPassword(parsed.data.password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { success: true };
}

export type BusinessBranding = {
  logoDataUrl: string | null;
  brandColor: string | null;
  brandBackground: string | null;
};

const NO_BRANDING: BusinessBranding = { logoDataUrl: null, brandColor: null, brandBackground: null };

// Public lookup used on the login screen to preview a business's branding
// (logo/colors) before the visitor has authenticated, as soon as the email
// they type matches a registered owner. Always returns the same shape
// whether the email doesn't exist or exists without branding set, so it
// can't be used to check whether a given email is registered.
export async function getBusinessBrandingByEmail(email: string): Promise<BusinessBranding> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return NO_BRANDING;

  const user = await prisma.user.findUnique({
    where: { email: trimmed },
    select: { business: { select: { logoDataUrl: true, brandColor: true, brandBackground: true } } },
  });
  if (!user) return NO_BRANDING;

  return {
    logoDataUrl: user.business.logoDataUrl,
    brandColor: user.business.brandColor,
    brandBackground: user.business.brandBackground,
  };
}
