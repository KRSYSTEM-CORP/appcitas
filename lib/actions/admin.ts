"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import { sendAnnouncementEmail } from "@/lib/email";
import {
  PLATFORM_SETTINGS_ID,
  TRIAL_DAYS,
  FALLBACK_MONTHLY_FEE_USD_CENTS,
  monthsCoveredWithBonus,
  extendDueDateByMonths,
} from "@/lib/billing";
import {
  AnnouncementSchema,
  MaintenancePaymentSchema,
  RejectPaymentReportSchema,
  PlatformSettingsSchema,
} from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

export type AdminBusinessRow = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: Date;
  ownerId: string;
  ownerEmail: string;
  ownerStatus: "PENDING" | "ACTIVE" | "SUSPENDED";
  isExempt: boolean;
  monthlyFeeUsdCents: number | null;
  nextPaymentDueDate: Date | null;
};

// One row per business, keyed off its OWNER account's status (the account
// signup() creates) — a business's specialists/staff logins aren't gated by
// this panel, only whether the business itself can be used at all.
export async function listBusinessesForAdmin(): Promise<AdminBusinessRow[]> {
  await requireSuperAdmin();

  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    include: { users: { where: { role: "OWNER" }, take: 1 } },
  });

  return businesses
    .filter((b) => b.users[0] && !b.users[0].isSuperAdmin)
    .map((b) => ({
      id: b.id,
      name: b.name,
      subdomain: b.subdomain,
      createdAt: b.createdAt,
      ownerId: b.users[0].id,
      ownerEmail: b.users[0].email ?? "—",
      ownerStatus: b.users[0].status,
      isExempt: b.isExempt,
      monthlyFeeUsdCents: b.monthlyFeeUsdCents,
      nextPaymentDueDate: b.nextPaymentDueDate,
    }));
}

// One row per business owner (real email, not the specialist/staff logins
// which have no email at all — see User.email being optional in schema.prisma).
export async function listAnnouncementRecipients(): Promise<{ email: string; businessName: string }[]> {
  await requireSuperAdmin();
  const owners = await prisma.user.findMany({
    where: { role: "OWNER", status: "ACTIVE", email: { not: null } },
    select: { email: true, business: { select: { name: true } } },
  });
  return owners.map((o) => ({ email: o.email as string, businessName: o.business.name }));
}

export type SendAnnouncementResult =
  | { success: true; sent: number; total: number }
  | { success: false; error: string };

// Sends the same announcement to every active business's owner — used for
// product news/updates, not scoped to any one tenant. Individual send
// failures don't fail the whole batch (Promise.allSettled): the admin sees
// how many of the total actually went out.
export async function sendAnnouncement(input: unknown): Promise<SendAnnouncementResult> {
  await requireSuperAdmin();
  const parsed = AnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const recipients = await listAnnouncementRecipients();
  if (recipients.length === 0) {
    return { success: false, error: "No hay negocios activos para notificar" };
  }

  const results = await Promise.allSettled(
    recipients.map((r) => sendAnnouncementEmail(r.email, parsed.data.subject, parsed.data.message))
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;

  return { success: true, sent, total: recipients.length };
}

// Approving a pending business also starts its first billing cycle in the
// same step: a TRIAL_DAYS-day free trial from today, priced at the
// platform's standard fee — no manual billing input needed for the common
// case (see lib/billing.ts). A business that needs a different price later
// can be adjusted from its "Registrar pago" action below.
export async function approveBusiness(userId: string): Promise<ActionResult> {
  await requireSuperAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "PENDING") {
    return { success: false, error: "No encontrado o ya fue procesado" };
  }

  const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status: "ACTIVE" } }),
    prisma.business.update({
      where: { id: user.businessId },
      data: {
        monthlyFeeUsdCents: settings?.defaultMonthlyFeeUsdCents ?? FALLBACK_MONTHLY_FEE_USD_CENTS,
        nextPaymentDueDate: trialEnd,
      },
    }),
  ]);

  revalidatePath("/admin");
  return { success: true };
}

export async function denyBusiness(userId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const { count } = await prisma.user.updateMany({
    where: { id: userId, status: "PENDING" },
    data: { status: "SUSPENDED" },
  });
  if (count === 0) return { success: false, error: "No encontrado o ya fue procesado" };
  revalidatePath("/admin");
  return { success: true };
}

export async function suspendBusiness(userId: string): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  if (session.userId === userId) {
    return { success: false, error: "No puedes suspender tu propia cuenta" };
  }
  await prisma.user.updateMany({ where: { id: userId }, data: { status: "SUSPENDED" } });
  revalidatePath("/admin");
  return { success: true };
}

export async function reactivateBusiness(userId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  await prisma.user.updateMany({ where: { id: userId }, data: { status: "ACTIVE" } });
  revalidatePath("/admin");
  return { success: true };
}

// Permanently removes a business and everything under it (appointments,
// packages, payments, clients, staff, services). Deleted in explicit
// dependency order inside one transaction rather than relying solely on the
// schema's ON DELETE CASCADE graph — this is a genuinely destructive,
// irreversible action, so correctness here shouldn't depend on subtle
// Postgres cascade-ordering behavior. The client-side confirmation requires
// typing the business's exact name before this is ever called.
export async function deleteBusiness(businessId: string): Promise<ActionResult> {
  const session = await requireSuperAdmin();

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return { success: false, error: "Negocio no encontrado" };

  const owner = await prisma.user.findFirst({ where: { businessId, role: "OWNER" } });
  if (owner?.id === session.userId) {
    return { success: false, error: "No puedes eliminar tu propio negocio" };
  }

  await prisma.$transaction([
    prisma.transaction.deleteMany({
      where: { OR: [{ appointment: { businessId } }, { sessionPackage: { businessId } }] },
    }),
    prisma.notification.deleteMany({ where: { appointment: { businessId } } }),
    prisma.appointment.deleteMany({ where: { businessId } }),
    prisma.sessionPackage.deleteMany({ where: { businessId } }),
    prisma.specialistService.deleteMany({ where: { specialist: { businessId } } }),
    prisma.serviceHour.deleteMany({ where: { service: { businessId } } }),
    prisma.specialist.deleteMany({ where: { businessId } }),
    prisma.service.deleteMany({ where: { businessId } }),
    prisma.client.deleteMany({ where: { businessId } }),
    prisma.businessHour.deleteMany({ where: { businessId } }),
    prisma.user.deleteMany({ where: { businessId } }),
    prisma.business.delete({ where: { id: businessId } }),
  ]);

  revalidatePath("/admin");
  return { success: true };
}

export async function setBusinessExempt(businessId: string, exempt: boolean): Promise<ActionResult> {
  await requireSuperAdmin();
  await prisma.business.update({ where: { id: businessId }, data: { isExempt: exempt } });
  revalidatePath("/admin");
  revalidatePath("/settings");
  return { success: true };
}

// A super admin manually logging a payment they collected outside the app
// (or correcting a business's cycle) — periodEnd is whatever the admin
// types in directly, so this is also the tool to use for a one-off custom
// arrangement instead of the automatic trial/monthly/annual math.
export async function recordMaintenancePayment(businessId: string, input: unknown): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  const parsed = MaintenancePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos de pago inválidos" };
  }

  const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  if (settings?.billingExchangeRate == null) {
    return { success: false, error: "Configura la tasa de cambio de la plataforma primero" };
  }

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        businessId,
        amountUsdCents: parsed.data.amount,
        exchangeRate: settings.billingExchangeRate,
        periodEnd: parsed.data.periodEnd,
        note: parsed.data.note,
        verifiedById: session.userId,
      },
    }),
    prisma.business.update({
      where: { id: businessId },
      data: {
        monthlyFeeUsdCents: parsed.data.amount,
        nextPaymentDueDate: parsed.data.periodEnd,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/settings");
  revalidatePath("/billing");
  return { success: true };
}

export async function listPendingPaymentReports() {
  await requireSuperAdmin();
  return prisma.paymentReport.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { business: { select: { name: true } }, lines: true },
  });
}

// Approving a self-reported payment sums up the payment-method lines the
// business owner entered (their claim of what they actually paid) rather
// than assuming it matches the configured monthly fee exactly — it creates
// the same kind of Payment record recordMaintenancePayment does, using the
// platform-wide rate, and pushes the due date out by however many months
// that amount covers (see monthsCoveredWithBonus — a full year prepaid
// earns 2 bonus months), which unblocks the business. Falls back to a flat
// single month if the business somehow has no monthlyFeeUsdCents configured
// (shouldn't happen for anything approved after the trial-defaults change,
// but a pre-existing business could still be in that state).
export async function approvePaymentReport(reportId: string): Promise<ActionResult> {
  const session = await requireSuperAdmin();

  const report = await prisma.paymentReport.findUnique({
    where: { id: reportId },
    include: { lines: true },
  });
  if (!report || report.status !== "PENDING") {
    return { success: false, error: "Reporte no encontrado o ya fue procesado" };
  }
  if (report.lines.length === 0) {
    return { success: false, error: "El reporte no tiene métodos de pago" };
  }

  const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  if (settings?.billingExchangeRate == null) {
    return { success: false, error: "Configura la tasa de cambio de la plataforma primero" };
  }

  const business = await prisma.business.findUnique({ where: { id: report.businessId } });
  if (!business) {
    return { success: false, error: "Negocio no encontrado" };
  }

  const totalUsdCents = report.lines.reduce((sum, line) => sum + line.amountUsdCents, 0);
  const months = business.monthlyFeeUsdCents
    ? monthsCoveredWithBonus(totalUsdCents, business.monthlyFeeUsdCents)
    : 1;
  const periodEnd = extendDueDateByMonths(business.nextPaymentDueDate, months || 1);

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        businessId: report.businessId,
        amountUsdCents: totalUsdCents,
        exchangeRate: settings.billingExchangeRate,
        periodEnd,
        note: report.note ? `Reportado por el usuario: ${report.note}` : "Reportado por el usuario",
        verifiedById: session.userId,
      },
    }),
    prisma.business.update({ where: { id: report.businessId }, data: { nextPaymentDueDate: periodEnd } }),
    prisma.paymentReport.update({
      where: { id: reportId },
      data: { status: "APPROVED", reviewedById: session.userId, reviewedAt: new Date() },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/billing");
  revalidatePath("/settings");
  return { success: true };
}

export async function rejectPaymentReport(reportId: string, input: unknown): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  const parsed = RejectPaymentReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const result = await prisma.paymentReport.updateMany({
    where: { id: reportId, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedById: session.userId,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reviewNote,
    },
  });

  if (result.count === 0) {
    return { success: false, error: "Reporte no encontrado o ya fue procesado" };
  }
  revalidatePath("/admin");
  revalidatePath("/billing");
  return { success: true };
}

export async function getPlatformSettings(): Promise<{
  paymentInstructions: string | null;
  billingExchangeRate: number | null;
  defaultMonthlyFeeUsdCents: number | null;
}> {
  await requireSuperAdmin();
  const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  return {
    paymentInstructions: settings?.paymentInstructions ?? null,
    billingExchangeRate: settings?.billingExchangeRate != null ? Number(settings.billingExchangeRate) : null,
    defaultMonthlyFeeUsdCents: settings?.defaultMonthlyFeeUsdCents ?? null,
  };
}

export async function updatePlatformSettings(input: unknown): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = PlatformSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.platformSettings.upsert({
    where: { id: PLATFORM_SETTINGS_ID },
    create: {
      id: PLATFORM_SETTINGS_ID,
      paymentInstructions: parsed.data.paymentInstructions,
      billingExchangeRate: parsed.data.billingExchangeRate,
      defaultMonthlyFeeUsdCents: parsed.data.defaultMonthlyFee,
    },
    update: {
      paymentInstructions: parsed.data.paymentInstructions,
      billingExchangeRate: parsed.data.billingExchangeRate,
      defaultMonthlyFeeUsdCents: parsed.data.defaultMonthlyFee,
    },
  });

  revalidatePath("/admin");
  return { success: true };
}
