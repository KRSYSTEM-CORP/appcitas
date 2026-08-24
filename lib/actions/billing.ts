"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isBusinessBlocked, PLATFORM_SETTINGS_ID } from "@/lib/billing";
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

export type BillingInfo = {
  businessName: string;
  isExempt: boolean;
  monthlyFeeUsdCents: number | null;
  // The business' own retail currency (Settings → Moneda) — informational,
  // unrelated to platform billing (which is always USDT via Binance now).
  localCurrencyCode: string;
  nextPaymentDueDate: Date | null;
  blocked: boolean;
  paymentInstructions: string | null;
  binanceQrDataUrl: string | null;
  binanceId: string | null;
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
    localCurrencyCode: business?.localCurrencyCode ?? "VES",
    nextPaymentDueDate,
    blocked: isBusinessBlocked({ isExempt, nextPaymentDueDate }),
    paymentInstructions: settings?.paymentInstructions ?? null,
    binanceQrDataUrl: settings?.binanceQrDataUrl ?? null,
    binanceId: settings?.binanceId ?? null,
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

  await prisma.paymentReport.create({
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
  });

  revalidatePath("/billing");
  return { success: true };
}
