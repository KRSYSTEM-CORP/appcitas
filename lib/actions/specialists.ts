"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireSession } from "@/lib/session";
import { SpecialistHoursSchema, SpecialistSchema } from "@/lib/validations";
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

export type CreateSpecialistResult = { success: true; specialistId: string } | { success: false; error: string };

export async function createSpecialist(formData: FormData): Promise<CreateSpecialistResult> {
  const { businessId } = await requireOwner();

  const parsed = parseSpecialistForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const created = await prisma.specialist.create({
    data: {
      businessId,
      displayName: parsed.data.displayName,
      bio: parsed.data.bio || null,
      services: { create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })) },
    },
  });

  revalidatePath("/specialists");
  return { success: true, specialistId: created.id };
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

export type SpecialistHourItem = {
  weekday: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  breakStart: string | null;
  breakEnd: string | null;
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export async function getSpecialistHours(
  specialistId: string,
): Promise<{ hasCustomHours: boolean; hours: SpecialistHourItem[] } | null> {
  const { businessId } = await requireOwner();
  const specialist = await prisma.specialist.findFirst({
    where: { id: specialistId, businessId },
    select: { hasCustomHours: true, hours: true },
  });
  if (!specialist) return null;

  const byWeekday = new Map(specialist.hours.map((h) => [h.weekday, h]));
  const hours = WEEKDAYS.map((weekday) => {
    const h = byWeekday.get(weekday);
    return h
      ? {
          weekday,
          isClosed: h.isClosed,
          opensAt: h.opensAt,
          closesAt: h.closesAt,
          breakStart: h.breakStart,
          breakEnd: h.breakEnd,
        }
      : { weekday, isClosed: false, opensAt: null, closesAt: null, breakStart: null, breakEnd: null };
  });

  return { hasCustomHours: specialist.hasCustomHours, hours };
}

// hasCustomHours=false leaves the SpecialistHour rows in place (harmless —
// see getAvailableSlots, which only reads them when the flag is on) so
// toggling custom hours back on later restores whatever was last configured.
export async function updateSpecialistHours(
  specialistId: string,
  input: { hasCustomHours: boolean; hours: SpecialistHourItem[] },
): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = SpecialistHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Horario inválido" };
  }

  const specialist = await prisma.specialist.findFirst({ where: { id: specialistId, businessId } });
  if (!specialist) return { success: false, error: "Especialista no encontrado" };

  await prisma.$transaction([
    prisma.specialist.update({ where: { id: specialistId }, data: { hasCustomHours: parsed.data.hasCustomHours } }),
    ...parsed.data.hours.map((h) =>
      prisma.specialistHour.upsert({
        where: { specialistId_weekday: { specialistId, weekday: h.weekday } },
        create: {
          specialistId,
          weekday: h.weekday,
          isClosed: h.isClosed,
          opensAt: h.isClosed ? null : h.opensAt || null,
          closesAt: h.isClosed ? null : h.closesAt || null,
          breakStart: h.isClosed ? null : h.breakStart || null,
          breakEnd: h.isClosed ? null : h.breakEnd || null,
        },
        update: {
          isClosed: h.isClosed,
          opensAt: h.isClosed ? null : h.opensAt || null,
          closesAt: h.isClosed ? null : h.closesAt || null,
          breakStart: h.isClosed ? null : h.breakStart || null,
          breakEnd: h.isClosed ? null : h.breakEnd || null,
        },
      }),
    ),
  ]);

  revalidatePath("/specialists");
  return { success: true };
}
