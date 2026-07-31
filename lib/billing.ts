const GRACE_DAYS = 5;

// Free trial granted automatically the moment a super admin approves a new
// signup (see approveBusiness in lib/actions/admin.ts) — not from signup()
// time itself, since the account can't do anything until approved anyway.
export const TRIAL_DAYS = 14;

// Fallback used only if a platform admin has never set PlatformSettings.
// defaultMonthlyFeeUsdCents — in practice that field should always be
// configured, but a brand-new deployment's PlatformSettings row may not
// exist yet.
export const FALLBACK_MONTHLY_FEE_USD_CENTS = 2500; // $25.00

// Fixed id of the single PlatformSettings row (global config, not per-business).
export const PLATFORM_SETTINGS_ID = "platform";

export type BillingBusiness = {
  isExempt: boolean;
  nextPaymentDueDate: Date | null;
};

// Computed live from the due date — no cron/background job needed. A
// business with no billing cycle configured yet (nextPaymentDueDate null)
// is treated as not blocked, since that's the state right after signup
// before a platform admin has approved and set up their first cycle.
export function isBusinessBlocked(business: BillingBusiness): boolean {
  if (business.isExempt || !business.nextPaymentDueDate) return false;
  const graceDeadline = new Date(business.nextPaymentDueDate);
  graceDeadline.setDate(graceDeadline.getDate() + GRACE_DAYS);
  return new Date() > graceDeadline;
}

// A payment covering an exact multiple of 12 months of the business'
// monthly fee earns 2 bonus months per full year prepaid (paying for 11 or
// 13 months earns no bonus — only a clean 12/24/36... month multiple does).
// Returns the total months to extend the due date by, bonus included.
export function monthsCoveredWithBonus(paidUsdCents: number, monthlyFeeUsdCents: number): number {
  if (!monthlyFeeUsdCents || monthlyFeeUsdCents <= 0) return 0;
  const months = Math.round(paidUsdCents / monthlyFeeUsdCents);
  const bonusMonths = months > 0 && months % 12 === 0 ? (months / 12) * 2 : 0;
  return months + bonusMonths;
}

// Every cycle in this app (trial, grace, a paid month) is expressed as a
// flat day count rather than calendar months, so extending "by N months"
// stays consistent with that: N × 30 days from the current due date (or
// from today if there's no due date yet).
export function extendDueDateByMonths(from: Date | null, months: number): Date {
  const base = new Date(from ?? new Date());
  base.setDate(base.getDate() + months * 30);
  return base;
}

// Extracts the transferred amount and reference number from a Banesco
// "Pago Móvil" notification email — see app/api/webhooks/banesco-email/
// route.ts, which receives this text forwarded by a Cloudflare Email
// Worker. Matches the real notification wording exactly:
//   "...Pago recibido a través de Pago Móvil de NOMBRE por Bs.10000.00 el
//   27/07/2026 a las 22:09.\nREF:062081854648"
// The reference is captured for logging/audit but never relied on for
// matching — see createPagoMovilOrder for why the amount itself is what
// identifies which business's order this is.
export function parseBanescoPagoMovilEmail(
  text: string
): { amountBsCents: number; reference: string | null } | null {
  const amountMatch = text.match(/Pago\s*M[oó]vil[\s\S]{0,80}?por\s+Bs\.?\s*([\d.,]+)/i);
  if (!amountMatch) return null;

  const raw = amountMatch[1];
  // Banesco's own format has no thousands separator (e.g. "10000.00"), but
  // this stays tolerant of "10.000,00" or "10,000.00" too: whichever
  // separator appears last is treated as the decimal point.
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = raw.replace(/,/g, "");
  } else {
    normalized = raw;
  }
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const refMatch = text.match(/REF:?\s*(\d+)/i);

  return {
    amountBsCents: Math.round(amount * 100),
    reference: refMatch ? refMatch[1] : null,
  };
}
