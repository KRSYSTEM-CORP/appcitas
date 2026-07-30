"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireSession } from "@/lib/session";
import { SpecialistSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

export type SpecialistListItem = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarDataUrl: string | null;
  active: boolean;
  serviceIds: string[];
};

function toListItem(s: {
  id: string;
  displayName: string;
  bio: string | null;
  avatarDataUrl: string | null;
  active: boolean;
  services: { serviceId: string }[];
}): SpecialistListItem {
  return {
    id: s.id,
    displayName: s.displayName,
    bio: s.bio,
    avatarDataUrl: s.avatarDataUrl,
    active: s.active,
    serviceIds: s.services.map((sv) => sv.serviceId),
  };
}

export async function listSpecialists(): Promise<SpecialistListItem[]> {
  const { businessId } = await requireOwner();
  const specialists = await prisma.specialist.findMany({
    where: { businessId },
    include: { services: { select: { serviceId: true } } },
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
  });
  return specialists.map(toListItem);
}

// Used by the booking flow (any signed-in role) — only active specialists,
// each with the services they're allowed to perform so the booking form can
// filter the service picker per specialist.
export async function listActiveSpecialists(): Promise<SpecialistListItem[]> {
  const { businessId } = await requireSession();
  const specialists = await prisma.specialist.findMany({
    where: { businessId, active: true },
    include: { services: { select: { serviceId: true } } },
    orderBy: { displayName: "asc" },
  });
  return specialists.map(toListItem);
}

export async function getSpecialist(specialistId: string): Promise<SpecialistListItem | null> {
  const { businessId } = await requireOwner();
  const specialist = await prisma.specialist.findFirst({
    where: { id: specialistId, businessId },
    include: { services: { select: { serviceId: true } } },
  });
  return specialist ? toListItem(specialist) : null;
}

function parseSpecialistForm(formData: FormData) {
  return SpecialistSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || undefined,
    serviceIds: formData.getAll("serviceIds"),
  });
}

export async function createSpecialist(formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = parseSpecialistForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.specialist.create({
    data: {
      businessId,
      displayName: parsed.data.displayName,
      bio: parsed.data.bio || null,
      services: { create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })) },
    },
  });

  revalidatePath("/specialists");
  return { success: true };
}

export async function updateSpecialist(specialistId: string, formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = parseSpecialistForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existing = await prisma.specialist.findFirst({ where: { id: specialistId, businessId } });
  if (!existing) return { success: false, error: "Especialista no encontrado" };

  await prisma.$transaction([
    prisma.specialist.update({
      where: { id: specialistId },
      data: { displayName: parsed.data.displayName, bio: parsed.data.bio || null },
    }),
    prisma.specialistService.deleteMany({ where: { specialistId } }),
    prisma.specialistService.createMany({
      data: parsed.data.serviceIds.map((serviceId) => ({ specialistId, serviceId })),
    }),
  ]);

  revalidatePath("/specialists");
  return { success: true };
}

// Blocked if the specialist has ever been booked (appointment or package) —
// same reasoning as deleteService: the FK is RESTRICT, so this avoids a raw
// constraint error and points to "Desactivar" for a used specialist.
export async function deleteSpecialist(specialistId: string): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const specialist = await prisma.specialist.findFirst({ where: { id: specialistId, businessId } });
  if (!specialist) return { success: false, error: "Especialista no encontrado" };

  const [appointmentCount, packageCount] = await Promise.all([
    prisma.appointment.count({ where: { specialistId } }),
    prisma.sessionPackage.count({ where: { specialistId } }),
  ]);
  if (appointmentCount > 0 || packageCount > 0) {
    return {
      success: false,
      error: "No se puede eliminar: este especialista tiene citas o paquetes registrados. Desactívalo en su lugar.",
    };
  }

  await prisma.specialist.delete({ where: { id: specialistId } });

  revalidatePath("/specialists");
  return { success: true };
}

export async function toggleSpecialistActive(specialistId: string, active: boolean): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const { count } = await prisma.specialist.updateMany({
    where: { id: specialistId, businessId },
    data: { active },
  });
  if (count === 0) return { success: false, error: "Especialista no encontrado" };

  revalidatePath("/specialists");
  return { success: true };
}
