"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ClientSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";
import type { AppointmentStatus } from "@prisma/client";

// Everything in this file is intentionally unauthenticated — it's the
// surface a not-signed-in end client hits at /book/[subdomain]. Every query
// is scoped by the resolved businessId and returns only what a booking
// widget needs (no emails, phones, or other clients' data).

export type PublicBusiness = {
  id: string;
  name: string;
  subdomain: string;
  logoDataUrl: string | null;
  brandColor: string | null;
  brandBackground: string | null;
  localCurrencyCode: string;
  fxEnabled: boolean;
  foreignCurrencyCode: string;
  rate: number | null;
};

export async function getPublicBusiness(subdomain: string): Promise<PublicBusiness | null> {
  const business = await prisma.business.findUnique({
    where: { subdomain: subdomain.trim().toLowerCase() },
    select: {
      id: true,
      name: true,
      subdomain: true,
      logoDataUrl: true,
      brandColor: true,
      brandBackground: true,
      localCurrencyCode: true,
      fxEnabled: true,
      foreignCurrencyCode: true,
      exchangeRate: true,
    },
  });
  if (!business) return null;

  const { exchangeRate, ...rest } = business;
  return { ...rest, rate: exchangeRate != null ? Number(exchangeRate) : null };
}

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  basePriceCents: number;
  priceCurrencyCode: string;
  category: string | null;
};

export type PublicSpecialist = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarDataUrl: string | null;
  serviceIds: string[];
};

export async function listPublicCatalog(
  businessId: string,
): Promise<{ services: PublicService[]; specialists: PublicSpecialist[] }> {
  const [services, specialists] = await Promise.all([
    prisma.service.findMany({
      where: { businessId, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        basePriceCents: true,
        priceCurrencyCode: true,
        category: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.specialist.findMany({
      where: { businessId, active: true },
      select: {
        id: true,
        displayName: true,
        bio: true,
        avatarDataUrl: true,
        services: { select: { serviceId: true } },
      },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return {
    services,
    specialists: specialists.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      bio: s.bio,
      avatarDataUrl: s.avatarDataUrl,
      serviceIds: s.services.map((sv) => sv.serviceId),
    })),
  };
}

const SLOT_STEP_MINUTES = 30;

// Half-hour grid between the business's open/close for that weekday, minus
// any window already taken by a non-cancelled appointment for that
// specialist, minus anything already in the past if dateKey is today.
export async function getAvailableSlots(
  businessId: string,
  specialistId: string,
  serviceId: string,
  dateKey: string,
): Promise<string[]> {
  const dayStart = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(dayStart.getTime())) return [];
  const weekday = dayStart.getDay();

  const [businessHours, service, appointments] = await Promise.all([
    prisma.businessHour.findUnique({ where: { businessId_weekday: { businessId, weekday } } }),
    prisma.service.findFirst({
      where: { id: serviceId, businessId, active: true },
      include: { hours: { where: { weekday } } },
    }),
    prisma.appointment.findMany({
      where: {
        businessId,
        specialistId,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startsAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60_000) },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ]);

  if (!service) return [];

  // A service with hasCustomHours fully replaces the business's default
  // hours for that weekday (rather than intersecting with them) — see
  // ServiceHour in prisma/schema.prisma.
  const hours = service.hasCustomHours ? service.hours[0] : businessHours;
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) return [];

  const [openH, openM] = hours.opensAt.split(":").map(Number);
  const [closeH, closeM] = hours.closesAt.split(":").map(Number);
  const dayOpen = new Date(dayStart);
  dayOpen.setHours(openH, openM, 0, 0);
  const dayClose = new Date(dayStart);
  dayClose.setHours(closeH, closeM, 0, 0);

  const now = new Date();
  const slots: string[] = [];
  for (
    let slotStart = new Date(dayOpen);
    slotStart.getTime() + service.durationMinutes * 60_000 <= dayClose.getTime();
    slotStart = new Date(slotStart.getTime() + SLOT_STEP_MINUTES * 60_000)
  ) {
    const slotEnd = new Date(slotStart.getTime() + service.durationMinutes * 60_000);
    if (slotStart < now) continue;
    const overlaps = appointments.some((a) => slotStart < a.endsAt && slotEnd > a.startsAt);
    if (!overlaps) {
      slots.push(`${String(slotStart.getHours()).padStart(2, "0")}:${String(slotStart.getMinutes()).padStart(2, "0")}`);
    }
  }
  return slots;
}

export type PublicBookingInput = {
  subdomain: string;
  specialistId: string;
  serviceId: string;
  dateKey: string;
  time: string;
  client: { firstName: string; lastName: string; phone: string; email?: string };
};

export type CreatePublicAppointmentResult = { success: true; cancelToken: string } | { success: false; error: string };

export async function createPublicAppointment(input: PublicBookingInput): Promise<CreatePublicAppointmentResult> {
  const business = await prisma.business.findUnique({ where: { subdomain: input.subdomain.trim().toLowerCase() } });
  if (!business) return { success: false, error: "Negocio no encontrado" };

  const clientParsed = ClientSchema.safeParse(input.client);
  if (!clientParsed.success) {
    return { success: false, error: clientParsed.error.issues[0]?.message ?? "Datos de contacto inválidos" };
  }

  const [specialist, service] = await Promise.all([
    prisma.specialist.findFirst({ where: { id: input.specialistId, businessId: business.id, active: true } }),
    prisma.service.findFirst({ where: { id: input.serviceId, businessId: business.id, active: true } }),
  ]);
  if (!specialist) return { success: false, error: "Especialista no válido" };
  if (!service) return { success: false, error: "Servicio no válido" };

  const startsAt = new Date(`${input.dateKey}T${input.time}:00`);
  if (Number.isNaN(startsAt.getTime()) || startsAt < new Date()) {
    return { success: false, error: "Elige una fecha y hora válidas" };
  }
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      specialistId: specialist.id,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (conflict) return { success: false, error: "Ese horario ya no está disponible, elige otro" };

  const existingClient = await prisma.client.findUnique({
    where: { businessId_phone: { businessId: business.id, phone: clientParsed.data.phone } },
  });
  const clientId =
    existingClient?.id ??
    (
      await prisma.client.create({
        data: {
          businessId: business.id,
          firstName: clientParsed.data.firstName,
          lastName: clientParsed.data.lastName,
          phone: clientParsed.data.phone,
          email: clientParsed.data.email || null,
        },
      })
    ).id;

  const created = await prisma.appointment.create({
    data: { businessId: business.id, clientId, specialistId: specialist.id, serviceId: service.id, startsAt, endsAt },
    select: { cancelToken: true },
  });

  return { success: true, cancelToken: created.cancelToken };
}

export type PublicAppointmentInfo = {
  id: string;
  startsAt: Date;
  status: AppointmentStatus;
  business: { name: string; logoDataUrl: string | null; brandColor: string | null; brandBackground: string | null };
  service: { name: string };
  client: { firstName: string };
};

// Powers the public /cancel/[token] page — no session/businessId scoping,
// the unguessable token itself is the authorization (see Appointment.cancelToken).
export async function getAppointmentByCancelToken(token: string): Promise<PublicAppointmentInfo | null> {
  return prisma.appointment.findUnique({
    where: { cancelToken: token },
    select: {
      id: true,
      startsAt: true,
      status: true,
      business: { select: { name: true, logoDataUrl: true, brandColor: true, brandBackground: true } },
      service: { select: { name: true } },
      client: { select: { firstName: true } },
    },
  });
}

export async function cancelAppointmentByToken(token: string): Promise<ActionResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { cancelToken: token },
    select: { id: true, status: true },
  });
  if (!appointment) return { success: false, error: "Enlace inválido" };
  if (appointment.status === "CANCELLED") return { success: false, error: "Esta cita ya fue cancelada" };
  if (appointment.status === "ATTENDED") return { success: false, error: "Esta cita ya fue atendida" };

  await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });
  revalidatePath("/agenda");
  return { success: true };
}
