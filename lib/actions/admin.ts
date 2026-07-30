"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import type { ActionResult } from "@/lib/types";

export type AdminBusinessRow = {
  id: string;
  name: string;
  subdomain: string;
  createdAt: Date;
  ownerId: string;
  ownerEmail: string;
  ownerStatus: "PENDING" | "ACTIVE" | "SUSPENDED";
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
    }));
}

export async function approveBusiness(userId: string): Promise<ActionResult> {
  await requireSuperAdmin();
  const { count } = await prisma.user.updateMany({
    where: { id: userId, status: "PENDING" },
    data: { status: "ACTIVE" },
  });
  if (count === 0) return { success: false, error: "No encontrado o ya fue procesado" };
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
