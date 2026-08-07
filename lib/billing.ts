const GRACE_DAYS = 5;

// Free trial granted automatically the moment a new business is created —
// signup() and the Google signup path (app/api/auth/google/callback) both go
// through createBusinessWithOwner (lib/business-provisioning.ts), which is
// where this actually gets applied. approveBusiness in lib/actions/admin.ts
// still applies it too, purely to cover any pre-existing PENDING account
// from before self-serve signup — new signups never reach PENDING anymore.
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

