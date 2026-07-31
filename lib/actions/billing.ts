"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isBusinessBlocked, PLATFORM_SETTINGS_ID } from "@/lib/billing";
import { createBinancePayOrder } from "@/lib/binance-pay";
import { PaymentReportSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";
import type { BinancePayOrderStatus, PagoMovilOrderStatus } from "@prisma/client";

// This whole file deliberately uses getSession() instead of requireSession():
// /billing is exactly the page a billing-blocked business needs to reach to
// report a payment and get itself unblocked, so these actions must never
// trigger the /blocked redirect the way most other actions do.
async function requireBusinessUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export type BillingInfo = {
  businessName: string;
  isExempt: boolean;
  monthlyFeeUsdCents: number | null;
  // Platform-wide rate (not per-business) — only meaningful for VES
  // businesses previewing what a report would come out to in bolívares
  // (Pago Móvil); the headline "cost" shown is always the USD amount.
  billingExchangeRate: number | null;
  // The business' own retail currency (Settings → Moneda) — used here just
  // to decide whether the Bs preview above is relevant at all.
  localCurrencyCode: string;
  nextPaymentDueDate: Date | null;
  blocked: boolean;
  paymentInstructions: string | null;
};

export async function getBillingInfo(): Promise<BillingInfo> {
  const { businessId, businessName } = await requireBusinessUser();

  const [business, settings] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        isExempt: true,
        monthlyFeeUsdCents: true,
        nextPaymentDueDate: true,
        localCurrencyCode: true,
      },
    }),
    prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } }),
  ]);

  const isExempt = business?.isExempt ?? false;
  const nextPaymentDueDate = business?.nextPaymentDueDate ?? null;

  return {
    businessName,
    isExempt,
    monthlyFeeUsdCents: business?.monthlyFeeUsdCents ?? null,
    billingExchangeRate: settings?.billingExchangeRate != null ? Number(settings.billingExchangeRate) : null,
    localCurrencyCode: business?.localCurrencyCode ?? "VES",
    nextPaymentDueDate,
    blocked: isBusinessBlocked({ isExempt, nextPaymentDueDate }),
    paymentInstructions: settings?.paymentInstructions ?? null,
  };
}

export async function listMyPaymentReports() {
  const { businessId } = await requireBusinessUser();
  return prisma.paymentReport.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    include: { lines: true },
  });
}

// A business owner's self-reported claim of having paid the maintenance fee
// externally, with a required proof-of-payment image. Stays PENDING until a
// super admin reviews it from /admin — this alone never changes the
// business' billing state or unblocks it.
export async function submitPaymentReport(input: unknown): Promise<ActionResult> {
  const { businessId, userId } = await requireBusinessUser();
  const parsed = PaymentReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.paymentReport.create({
    data: {
      businessId,
      reportedById: userId,
      proofImageDataUrl: parsed.data.proofImageDataUrl,
      note: parsed.data.note,
      lines: {
        create: parsed.data.lines.map((line) => ({
          paymentMethod: line.paymentMethod,
          amountUsdCents: line.amount,
          reference: line.reference,
        })),
      },
    },
  });

  revalidatePath("/billing");
  return { success: true };
}

export type BinancePayCheckoutResult =
  | { success: true; orderId: string; checkoutUrl: string; qrcodeLink: string }
  | { success: false; error: string };

export type BillingPlan = "MONTHLY" | "ANNUAL";

// Creates a Binance Pay checkout for the business' current maintenance-fee
// cycle — ANNUAL charges 12× the monthly fee up front; the extra 2 free
// months from prepaying a full year aren't charged for, they're just extra
// time credited once the webhook sees this amount (see
// monthsCoveredWithBonus in lib/billing.ts). Unlike submitPaymentReport,
// this needs no admin review — once the customer actually pays, Binance
// calls app/api/webhooks/binance-pay/route.ts, which marks the order PAID
// and advances nextPaymentDueDate on its own.
export async function createBinancePayCheckout(plan: BillingPlan = "MONTHLY"): Promise<BinancePayCheckoutResult> {
  const { businessId } = await requireBusinessUser();

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, monthlyFeeUsdCents: true },
  });
  if (!business?.monthlyFeeUsdCents) {
    return { success: false, error: "Todavía no tienes un ciclo de cobro configurado." };
  }

  const amountUsdCents = plan === "ANNUAL" ? business.monthlyFeeUsdCents * 12 : business.monthlyFeeUsdCents;
  const merchantTradeNo = `KRCITAS-${businessId}-${Date.now()}`;

  let order;
  try {
    order = await createBinancePayOrder({
      merchantTradeNo,
      amountUsdCents,
      description:
        plan === "ANNUAL"
          ? `Suscripción anual (12 meses + 2 de regalo) KR Citas — ${business.name}`
          : `Suscripción mensual KR Citas — ${business.name}`,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "BINANCE_PAY_NOT_CONFIGURED") {
      return { success: false, error: "El pago automático con Binance Pay todavía no está habilitado." };
    }
    return { success: false, error: "No se pudo crear el pago con Binance Pay. Intenta de nuevo." };
  }

  const saved = await prisma.binancePayOrder.create({
    data: {
      businessId,
      merchantTradeNo,
      prepayId: order.prepayId,
      amountUsdCents,
      checkoutUrl: order.checkoutUrl,
      qrcodeLink: order.qrcodeLink,
    },
  });

  return { success: true, orderId: saved.id, checkoutUrl: order.checkoutUrl, qrcodeLink: order.qrcodeLink };
}

// Polled by the client while a Binance Pay checkout is open — once the
// webhook marks it PAID, the UI can refresh the page to show the new due
// date without the customer or an admin doing anything else.
export async function getBinancePayOrderStatus(orderId: string): Promise<BinancePayOrderStatus | null> {
  const { businessId } = await requireBusinessUser();
  const order = await prisma.binancePayOrder.findFirst({
    where: { id: orderId, businessId },
    select: { status: true },
  });
  return order?.status ?? null;
}

export type PagoMovilOrderResult =
  | { success: true; orderId: string; amountBs: string; expiresAt: Date }
  | { success: false; error: string };

const PAGO_MOVIL_ORDER_TTL_MINUTES = 60;

// Reserves a specific Bs amount (the real fee plus a few random bolívar
// cents) for the business to transfer via Pago Móvil — there's no merchant
// API to create a "checkout" the way Binance Pay has, so this is the closest
// equivalent: a unique-enough amount that app/api/webhooks/banesco-email/
// route.ts can match a forwarded bank notification email back to, without
// needing the payer to type in any reference code. Expires after
// PAGO_MOVIL_ORDER_TTL_MINUTES so a stale unpaid reservation can't keep
// colliding with new ones asking for the same bumped amount.
export async function createPagoMovilOrder(plan: BillingPlan = "MONTHLY"): Promise<PagoMovilOrderResult> {
  const { businessId } = await requireBusinessUser();

  const [business, settings] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { monthlyFeeUsdCents: true } }),
    prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } }),
  ]);
  if (!business?.monthlyFeeUsdCents) {
    return { success: false, error: "Todavía no tienes un ciclo de cobro configurado." };
  }
  if (settings?.billingExchangeRate == null) {
    return { success: false, error: "El pago automático por Pago Móvil todavía no está habilitado." };
  }

  const amountUsdCents = plan === "ANNUAL" ? business.monthlyFeeUsdCents * 12 : business.monthlyFeeUsdCents;
  const rate = Number(settings.billingExchangeRate);
  const baseAmountBsCents = Math.round((amountUsdCents / 100) * rate * 100);

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + PAGO_MOVIL_ORDER_TTL_MINUTES);

  // The random offset (+0.01 to +0.99 Bs) is what disambiguates this order
  // from any other business's pending request for the same base fee —
  // checked across every business, not just this one (Citas has no RLS
  // layer to work around here, unlike KR POS).
  let expectedAmountBsCents: number | null = null;
  for (let attempt = 0; attempt < 10 && expectedAmountBsCents == null; attempt++) {
    const candidate = baseAmountBsCents + 1 + Math.floor(Math.random() * 98);
    const collision = await prisma.pagoMovilOrder.findFirst({
      where: { expectedAmountBsCents: candidate, status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!collision) expectedAmountBsCents = candidate;
  }
  if (expectedAmountBsCents == null) {
    return {
      success: false,
      error: "Hay demasiadas solicitudes de pago activas ahora mismo — intenta de nuevo en unos minutos.",
    };
  }

  const order = await prisma.pagoMovilOrder.create({
    data: {
      businessId,
      amountUsdCents,
      exchangeRate: settings.billingExchangeRate,
      expectedAmountBsCents,
      expiresAt,
    },
  });

  return {
    success: true,
    orderId: order.id,
    amountBs: (expectedAmountBsCents / 100).toFixed(2),
    expiresAt,
  };
}

// Polled by the client while a Pago Móvil order is open — once the webhook
// at app/api/webhooks/banesco-email/route.ts matches a forwarded
// notification email to this order, the UI can refresh to show the new due
// date without the customer or an admin doing anything else. Nothing ever
// writes an EXPIRED status to the row itself (there's no cron sweeping
// these) — a still-PENDING order past its expiresAt is reported as EXPIRED
// here instead, purely derived, so the polling UI knows to stop waiting.
export async function getPagoMovilOrderStatus(orderId: string): Promise<PagoMovilOrderStatus | null> {
  const { businessId } = await requireBusinessUser();
  const order = await prisma.pagoMovilOrder.findFirst({
    where: { id: orderId, businessId },
    select: { status: true, expiresAt: true },
  });
  if (!order) return null;
  if (order.status === "PENDING" && order.expiresAt < new Date()) return "EXPIRED";
  return order.status;
}
