import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Row-Level Security safety net: every tenant-scoped query runs inside a
// transaction that first tags the Postgres session with the caller's
// businessId (via set_config, which is safely parameterized — unlike a raw
// SET LOCAL string). RLS policies on the business tables then only return
// rows matching that business, even if application code ever forgets a
// `where: { businessId }` filter. The explicit filters stay in place anyway
// as a first line of defense; this is the second. Mirrors withTenant in the
// KR POS (ventas-inventario) app exactly.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

export async function withTenant<T>(
  businessId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.business_id', ${businessId}, true)`;
    return fn(tx);
  }, TRANSACTION_OPTIONS);
}

// Used only after requireSuperAdmin() has already verified the caller —
// grants the RLS escape hatch that lets platform-admin queries see every
// business's rows instead of just one.
export async function withSuperAdmin<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_super_admin', 'true', true)`;
    return fn(tx);
  }, TRANSACTION_OPTIONS);
}
