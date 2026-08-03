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
  // Platform-wide rate (not per-business) — only meaningful for VES
  // businesses previewing what a report would come out to in bolívares
  // (Transferencia Bancaria / Pago Móvil); the headline "cost" shown is
  // always the USD amount.
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
// business' billing state or unblocks it. This is now the ONLY way a payment
// gets recorded from the business side (no automated checkout of any kind) —
// the billing page also tells the business to send the same proof to KR
// System's WhatsApp, which is how the super admin actually finds out to go
// review it.
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
