"use server";

import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/tenant-db";

// Called once the first-time product tour is dismissed (finished or
// skipped) — never shown again for this user after this. Failures here
// aren't worth surfacing to the user; worst case the tour just reappears
// next login, which is harmless.
export async function markTourSeen(): Promise<void> {
  const { userId, businessId } = await requireSession();
  await withTenant(businessId, (tx) => tx.user.update({ where: { id: userId }, data: { hasSeenTour: true } }));
}
