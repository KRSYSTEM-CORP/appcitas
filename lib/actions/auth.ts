"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";
import { sendPasswordResetEmail } from "@/lib/email";
import { createBusinessWithOwner } from "@/lib/business-provisioning";
import {
  LoginSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
  SignupSchema,
} from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Self-serve: the business is active immediately, with a free trial (see
// createBusinessWithOwner/lib/billing.ts) — no super admin approval step.
// Auto-logs in and lands straight on /settings, the same way the Google
// signup path (app/api/auth/google/callback) does.
export async function signup(formData: FormData): Promise<ActionResult> {
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

  const passwordHash = hashPassword(password);
  const { business, user } = await createBusinessWithOwner(
    businessName,
    { email, passwordHash, firstName: businessName, lastName: "" },
    subdomain,
  );

  await setSessionCookie({ uid: user.id, bid: business.id, businessName: business.name });
  redirect("/settings");
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

  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: true },
  });
  // user.passwordHash is null on an account that only ever signed up with
  // Google (see app/api/auth/google/callback) — a password attempt against
  // it must fail the same generic way as a non-existent email, not throw.
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return { success: false, error: genericError };
  }

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

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
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
    where: { tokenHash: hashResetToken(token) },
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
