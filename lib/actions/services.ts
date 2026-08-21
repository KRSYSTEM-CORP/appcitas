"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireOwner, requireSession } from "@/lib/session";
import { ServiceHoursSchema, ServiceSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

export type ServiceListItem = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  basePriceCents: number;
  priceCurrencyCode: string;
  category: string | null;
  active: boolean;
  hasCustomHours: boolean;
};

export async function listServices(): Promise<ServiceListItem[]> {
  const { businessId } = await requireOwner();
  return prisma.service.findMany({
    where: { businessId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
}

export async function getService(serviceId: string): Promise<ServiceListItem | null> {
  const { businessId } = await requireOwner();
  return prisma.service.findFirst({ where: { id: serviceId, businessId } });
}

// Used by the booking flow (any signed-in role) — only active services can
// be picked when scheduling an appointment.
export async function listActiveServices(): Promise<ServiceListItem[]> {
  const { businessId } = await requireSession();
  return prisma.service.findMany({
    where: { businessId, active: true },
    orderBy: { name: "asc" },
  });
}

function parseServiceForm(formData: FormData) {
  return ServiceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    basePrice: formData.get("basePrice"),
    priceCurrencyCode: formData.get("priceCurrencyCode"),
    category: formData.get("category") || undefined,
  });
}

export async function createService(formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.service.create({
    data: {
      businessId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      durationMinutes: parsed.data.durationMinutes,
      basePriceCents: Math.round(parsed.data.basePrice * 100),
      priceCurrencyCode: parsed.data.priceCurrencyCode,
      category: parsed.data.category || null,
    },
  });

  revalidatePath("/services");
  return { success: true };
}

export async function updateService(serviceId: string, formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = parseServiceForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { count } = await prisma.service.updateMany({
    where: { id: serviceId, businessId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      durationMinutes: parsed.data.durationMinutes,
      basePriceCents: Math.round(parsed.data.basePrice * 100),
      priceCurrencyCode: parsed.data.priceCurrencyCode,
      category: parsed.data.category || null,
    },
  });
  if (count === 0) return { success: false, error: "Servicio no encontrado" };

  revalidatePath("/services");
  return { success: true };
}

export async function toggleServiceActive(serviceId: string, active: boolean): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const { count } = await prisma.service.updateMany({
    where: { id: serviceId, businessId },
    data: { active },
  });
  if (count === 0) return { success: false, error: "Servicio no encontrado" };

  revalidatePath("/services");
  return { success: true };
}

// Always deletes, regardless of history — unlike deleteSpecialist, this
// intentionally has no usage guard. Appointments/packages/payments tied to
// this service are deleted right along with it (in explicit dependency
// order, not just relying on the schema's cascade graph), since the
// service's own FK is RESTRICT and would otherwise block this. The
// client-side confirm makes clear that history goes with it; "Desactivar"
// remains the way to retire a used service while keeping its history.
export async function deleteService(serviceId: string): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service) return { success: false, error: "Servicio no encontrado" };

  await prisma.$transaction([
    prisma.transaction.deleteMany({
      where: { OR: [{ appointment: { serviceId } }, { sessionPackage: { serviceId } }] },
    }),
    prisma.notification.deleteMany({ where: { appointment: { serviceId } } }),
    prisma.appointment.deleteMany({ where: { serviceId } }),
    prisma.sessionPackage.deleteMany({ where: { serviceId } }),
    prisma.specialistService.deleteMany({ where: { serviceId } }),
    prisma.serviceHour.deleteMany({ where: { serviceId } }),
    prisma.service.delete({ where: { id: serviceId } }),
  ]);

  revalidatePath("/services");
  revalidatePath("/agenda");
  revalidatePath("/packages");
  return { success: true };
}

export type BulkServiceRow = {
  name: unknown;
  category?: unknown;
  durationMinutes: unknown;
  basePrice: unknown;
  priceCurrencyCode: unknown;
};

export type BulkServiceResult = {
  created: number;
  updated: number;
  failed: { row: number; error: string }[];
};

// Creates or updates by matching the service name case-insensitively within
// the business — services don't have a SKU-like code, so the name is the
// natural match key (mirrors bulkImportProducts' SKU-match in KR System,
// adapted since services key on name instead).
export async function bulkImportServices(rows: BulkServiceRow[]): Promise<BulkServiceResult> {
  const { businessId } = await requireOwner();
  let created = 0;
  let updated = 0;
  const failed: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const parsed = ServiceSchema.safeParse(rows[i]);
    if (!parsed.success) {
      failed.push({ row: i + 1, error: parsed.error.issues[0]?.message ?? "Datos inválidos" });
      continue;
    }

    try {
      const existing = await prisma.service.findFirst({
        where: { businessId, name: { equals: parsed.data.name, mode: "insensitive" } },
      });

      const data = {
        name: parsed.data.name,
        description: parsed.data.description || null,
        durationMinutes: parsed.data.durationMinutes,
        basePriceCents: Math.round(parsed.data.basePrice * 100),
        priceCurrencyCode: parsed.data.priceCurrencyCode,
        category: parsed.data.category || null,
      };

      if (existing) {
        await prisma.service.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.service.create({ data: { ...data, businessId } });
        created++;
      }
    } catch {
      failed.push({ row: i + 1, error: "No se pudo guardar" });
    }
  }

  revalidatePath("/services");
  return { created, updated, failed };
}

export type ServiceHourItem = {
  weekday: number;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
  breakStart: string | null;
  breakEnd: string | null;
};

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export async function getServiceHours(
  serviceId: string,
): Promise<{ hasCustomHours: boolean; hours: ServiceHourItem[] } | null> {
  const { businessId } = await requireOwner();
  const [service, businessHours] = await Promise.all([
    prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: { hasCustomHours: true, hours: true },
    }),
    prisma.businessHour.findMany({ where: { businessId } }),
  ]);
  if (!service) return null;

  const byWeekday = new Map(service.hours.map((h) => [h.weekday, h]));
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
    // No ServiceHour saved yet for this day — seed the form with the
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

  return { hasCustomHours: service.hasCustomHours, hours };
}

// hasCustomHours=false leaves the ServiceHour rows in place (harmless — see
// getAvailableSlots, which only reads them when the flag is on) so toggling
// custom hours back on later restores whatever was last configured.
export async function updateServiceHours(
  serviceId: string,
  input: { hasCustomHours: boolean; hours: ServiceHourItem[] },
): Promise<ActionResult> {
  const { businessId } = await requireOwner();

  const parsed = ServiceHoursSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Horario inválido" };
  }

  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service) return { success: false, error: "Servicio no encontrado" };

  await prisma.$transaction([
    prisma.service.update({ where: { id: serviceId }, data: { hasCustomHours: parsed.data.hasCustomHours } }),
    ...parsed.data.hours.map((h) =>
      prisma.serviceHour.upsert({
        where: { serviceId_weekday: { serviceId, weekday: h.weekday } },
        create: {
          serviceId,
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

  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/services");
  return { success: true };
}
