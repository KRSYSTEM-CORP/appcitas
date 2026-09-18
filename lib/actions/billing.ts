"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant-db";
import { getSession } from "@/lib/session";
import { isBusinessBlocked, PLATFORM_SETTINGS_ID } from "@/lib/billing";
import { fetchBcvRate } from "@/lib/bcv-rate";
import { getOrSetCache } from "@/lib/cache";
import { PaymentReportSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

// This whole file deliberately uses getSession() instead of requireSession():
// /billing is exactly the page a billing-blocked business needs to reach to
// report a payment and get itself unblocked, so these actions must never
// trigger the /blocked redirect the way most other actions do.
async function requireBusinessUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// Bs per 1 USD, used only to price the subscription's Pago Móvil amount —
// deliberately independent of any one business' own Business.exchangeRate
// (which could be disabled, denominated in a foreign currency other than
// USD, or simply belong to a different business than KR System's own
// billing). Self-heals the same way a business' own rate does: the daily
// cron at app/api/cron/bcv-rate/route.ts refreshes it proactively, and this
// read-time check catches it if that ever fails to run. Cached like the
// per-business rate, since /billing (and every business' payment-report
// hint) reads this on every load.
const PLATFORM_STALE_RATE_MS = 20 * 60 * 60 * 1000;

export type PlatformExchangeRateInfo = { rate: number | null; updatedAt: Date | null };

export async function getPlatformExchangeRateInfo(): Promise<PlatformExchangeRateInfo> {
  return getOrSetCache("platformExchangeRateInfo", 600, computePlatformExchangeRateInfo);
}

async function computePlatformExchangeRateInfo(): Promise<PlatformExchangeRateInfo> {
  const settings = await prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } });
  let rate = settings?.platformExchangeRate != null ? Number(settings.platformExchangeRate) : null;
  let updatedAt = settings?.platformExchangeRateUpdatedAt ?? null;

  const isStale = updatedAt == null || Date.now() - updatedAt.getTime() > PLATFORM_STALE_RATE_MS;
  if (isStale) {
    try {
      const freshRate = await fetchBcvRate("USD");
      updatedAt = new Date();
      await prisma.platformSettings.upsert({
        where: { id: PLATFORM_SETTINGS_ID },
        create: { id: PLATFORM_SETTINGS_ID, platformExchangeRate: freshRate, platformExchangeRateUpdatedAt: updatedAt },
        update: { platformExchangeRate: freshRate, platformExchangeRateUpdatedAt: updatedAt },
      });
      rate = freshRate;
    } catch {
      // Keep serving the last known rate; the next page load or the cron retries.
    }
  }

  return { rate, updatedAt };
}

export type BillingInfo = {
  businessName: string;
  isExempt: boolean;
  monthlyFeeUsdCents: number | null;
  // monthlyFeeUsdCents converted to Bolívares at KR System's own platform
  // rate (see getPlatformExchangeRateInfo above) — null only if that rate
  // has never been set yet (e.g. brand new install, BCV unreachable on
  // first load). Recomputed on every page load, so it tracks the rate's
  // daily updates automatically instead of being stored anywhere.
  monthlyFeeLocalAmount: number | null;
  // The raw Bs-per-USD rate itself (same source as monthlyFeeLocalAmount) —
  // exposed so PaymentReportForm can convert a Pago Móvil line the business
  // types directly in Bolívares back to the USD amount the schema expects,
  // instead of asking them to do that math themselves.
  platformRate: number | null;
  nextPaymentDueDate: Date | null;
  blocked: boolean;
  paymentInstructions: string | null;
  binanceQrDataUrl: string | null;
  binanceId: string | null;
  pagoMovilBank: string | null;
  pagoMovilPhone: string | null;
  pagoMovilId: string | null;
};

export async function getBillingInfo(): Promise<BillingInfo> {
  const { businessId, businessName } = await requireBusinessUser();

  const [[business, settings], platformRate] = await Promise.all([
    withTenant(businessId, (tx) =>
      Promise.all([
        tx.business.findUnique({
          where: { id: businessId },
          select: { isExempt: true, monthlyFeeUsdCents: true, nextPaymentDueDate: true },
        }),
        tx.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } }),
      ])
    ),
    getPlatformExchangeRateInfo(),
  ]);

  const isExempt = business?.isExempt ?? false;
  const nextPaymentDueDate = business?.nextPaymentDueDate ?? null;

  const monthlyFeeUsdCents = business?.monthlyFeeUsdCents ?? null;
  const monthlyFeeLocalAmount =
    platformRate.rate != null && monthlyFeeUsdCents != null ? (monthlyFeeUsdCents / 100) * platformRate.rate : null;

  return {
    businessName,
    isExempt,
    monthlyFeeUsdCents,
    monthlyFeeLocalAmount,
    platformRate: platformRate.rate,
    nextPaymentDueDate,
    blocked: isBusinessBlocked({ isExempt, nextPaymentDueDate }),
    paymentInstructions: settings?.paymentInstructions ?? null,
    binanceQrDataUrl: settings?.binanceQrDataUrl ?? null,
    binanceId: settings?.binanceId ?? null,
    pagoMovilBank: settings?.pagoMovilBank ?? null,
    pagoMovilPhone: settings?.pagoMovilPhone ?? null,
    pagoMovilId: settings?.pagoMovilId ?? null,
  };
}

export async function listMyPaymentReports() {
  const { businessId } = await requireBusinessUser();
  return withTenant(businessId, (tx) =>
    tx.paymentReport.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
      take: 200,
    })
  );
}

// A business owner's self-reported claim of having paid the maintenance fee
// externally. Stays PENDING until a super admin reviews it from /admin —
// this alone never changes the business' billing state or unblocks it. The
// proof-of-payment image is no longer collected in-app; the billing page
// tells the business to send it by WhatsApp instead, which is how the super
// admin actually finds out to go review it.
export async function submitPaymentReport(input: unknown): Promise<ActionResult> {
  const { businessId, userId } = await requireBusinessUser();
  const parsed = PaymentReportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await withTenant(businessId, (tx) =>
    tx.paymentReport.create({
      data: {
        businessId,
        reportedById: userId,
        note: parsed.data.note,
        lines: {
          create: parsed.data.lines.map((line) => ({
            paymentMethod: line.paymentMethod,
            amountUsdCents: line.amount,
            reference: line.reference,
          })),
        },
      },
    })
  );

  revalidatePath("/billing");
  return { success: true };
}
