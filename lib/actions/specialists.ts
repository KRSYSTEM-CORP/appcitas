"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/tenant-db";
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
  const specialists = await withTenant(businessId, (tx) =>
    tx.specialist.findMany({
      where: { businessId },
      include: { services: { select: { serviceId: true } } },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
    })
  );
  return specialists.map(toListItem);
}

// Used by the booking flow (any signed-in role) — only active specialists,
// each with the services they're allowed to perform so the booking form can
// filter the service picker per specialist.
export async function listActiveSpecialists(): Promise<SpecialistListItem[]> {
  const { businessId } = await requireSession();
  const specialists = await withTenant(businessId, (tx) =>
    tx.specialist.findMany({
      where: { businessId, active: true },
      include: { services: { select: { serviceId: true } } },
      orderBy: { displayName: "asc" },
    })
  );
  return specialists.map(toListItem);
}

export async function getSpecialist(specialistId: string): Promise<SpecialistListItem | null> {
  const { businessId } = await requireOwner();
  const specialist = await withTenant(businessId, (tx) =>
    tx.specialist.findFirst({
      where: { id: specialistId, businessId },
      include: { services: { select: { serviceId: true } } },
    })
  );
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

  const created = await withTenant(businessId, (tx) =>
    tx.specialist.create({
      data: {
        businessId,
        displayName: parsed.data.displayName,
        bio: parsed.data.bio || null,
        services: { create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })) },
      },
    })
  );

  revalidatePath("/specialists");
  return { success: true, specialistId: created.id };
}

export async function updateSpecialist(specialistId: string, formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = parseSpecialistForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const found = await withTenant(businessId, async (tx) => {
    const existing = await tx.specialist.findFirst({ where: { id: specialistId, businessId } });
    if (!existing) return false;

    await tx.specialist.update({
      where: { id: specialistId },
      data: { displayName: parsed.data.displayName, bio: parsed.data.bio || null },
    });
    await tx.specialistService.deleteMany({ where: { specialistId } });
    await tx.specialistService.createMany({
      data: parsed.data.serviceIds.map((serviceId) => ({ specialistId, serviceId })),
    });
    return true;
  });
  if (!found) return { success: false, error: "Especialista no encontrado" };

  revalidatePath("/specialists");
  return { success: true };
}

// Blocked if the specialist has ever been booked (appointment or package) —
// same reasoning as deleteService: the FK is RESTRICT, so this avoids a raw
// constraint error and points to "Desactivar" for a used specialist.
export async function deleteSpecialist(specialistId: string): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const result = await withTenant(businessId, async (tx) => {
    const specialist = await tx.specialist.findFirst({ where: { id: specialistId, businessId } });
    if (!specialist) return "not_found" as const;

    const [appointmentCount, packageCount] = await Promise.all([
      tx.appointment.count({ where: { specialistId } }),
      tx.sessionPackage.count({ where: { specialistId } }),
    ]);
    if (appointmentCount > 0 || packageCount > 0) return "in_use" as const;

    await tx.specialist.delete({ where: { id: specialistId } });
    return "ok" as const;
  });

  if (result === "not_found") return { success: false, error: "Especialista no encontrado" };
  if (result === "in_use") {
    return {
      success: false,
      error: "No se puede eliminar: este especialista tiene citas o paquetes registrados. Desactívalo en su lugar.",
    };
  }

  revalidatePath("/specialists");
  return { success: true };
}

export async function toggleSpecialistActive(specialistId: string, active: boolean): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const { count } = await withTenant(businessId, (tx) =>
    tx.specialist.updateMany({
      where: { id: specialistId, businessId },
      data: { active },
    })
  );
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
  const [specialist, businessHours] = await withTenant(businessId, (tx) =>
    Promise.all([
      tx.specialist.findFirst({
        where: { id: specialistId, businessId },
        select: { hasCustomHours: true, hours: true },
      }),
      tx.businessHour.findMany({ where: { businessId } }),
    ])
  );
  if (!specialist) return null;

  const byWeekday = new Map(specialist.hours.map((h) => [h.weekday, h]));
  const businessByWeekday = new Map(businessHours.map((h) => [h.weekday, h]));
  const hours = WEEKDAYS.map((weekday) => {
    const h = byWeekday.get(weekday);
    if (h) {
      return {
        weekday,
        isClosed: h.isClosed,
        opensAt: h.opensAt,
        closesAt: h.closesAt,
        breakStart: h.breakStart,
        breakEnd: h.breakEnd,
      };
    }
    // No SpecialistHour saved yet for this day — seed the form with the
    // business's own hours as a starting point (rather than blank fields,
    // which render as a stray browser placeholder time in every input) so
    // the owner only has to adjust the days that actually differ.
    const b = businessByWeekday.get(weekday);
    return {
      weekday,
      isClosed: b?.isClosed ?? true,
      opensAt: b?.opensAt ?? null,
      closesAt: b?.closesAt ?? null,
      breakStart: b?.breakStart ?? null,
      breakEnd: b?.breakEnd ?? null,
    };
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

  const found = await withTenant(businessId, async (tx) => {
    const specialist = await tx.specialist.findFirst({ where: { id: specialistId, businessId } });
    if (!specialist) return false;

    await tx.specialist.update({ where: { id: specialistId }, data: { hasCustomHours: parsed.data.hasCustomHours } });
    for (const h of parsed.data.hours) {
      await tx.specialistHour.upsert({
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
      });
    }
    return true;
  });
  if (!found) return { success: false, error: "Especialista no encontrado" };

  revalidatePath("/specialists");
  return { success: true };
}
