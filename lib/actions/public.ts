"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { withTenant, withSuperAdmin } from "@/lib/tenant-db";
import { ClientSchema } from "@/lib/validations";
import { notifyLive, agendaChannel } from "@/lib/realtime";
import { checkRateLimit, recordFailedAttempt, rateLimitMessage } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { zonedTimeToUtc, zonedMidnightUtc, zonedHM, weekdayOf } from "@/lib/timezone";
import type { ActionResult } from "@/lib/types";
import type { AppointmentStatus, SpecialistAssignmentMode } from "@prisma/client";

// Everything in this file is intentionally unauthenticated — it's the
// surface a not-signed-in end client hits at /book/[subdomain]. Every query
// is scoped by the resolved businessId and returns only what a booking
// widget needs (no emails, phones, or other clients' data). Lookups that
// don't yet have a businessId in hand (subdomain resolution, cancelToken
// lookup) use withSuperAdmin — the RLS bypass — since that's the whole point
// of those two lookups; everything after resolves to a single businessId and
// switches to withTenant so RLS still backstops it like any other query.

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
  specialistAssignmentMode: SpecialistAssignmentMode;
};

export async function getPublicBusiness(subdomain: string): Promise<PublicBusiness | null> {
  const business = await withSuperAdmin((tx) =>
    tx.business.findUnique({
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
        specialistAssignmentMode: true,
      },
    })
  );
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
  const [services, specialists] = await withTenant(businessId, (tx) =>
    Promise.all([
      tx.service.findMany({
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
      tx.specialist.findMany({
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
    ])
  );

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

type DayInterval = { start: Date; end: Date };

// The business/service open-close window for one weekday, before any
// specialist-level restriction is applied — shared by the fixed-specialist
// and any-specialist slot functions below so they agree on the base grid.
// Takes the caller's own tx (rather than opening its own withTenant) since
// it's always called from inside one of those two functions' transaction.
async function resolveBaseWindow(
  tx: Prisma.TransactionClient,
  businessId: string,
  serviceId: string,
  dateKey: string,
): Promise<{ open: Date; close: Date; breaks: DayInterval[]; durationMinutes: number } | null> {
  const weekday = weekdayOf(dateKey);
  const [businessHours, service] = await Promise.all([
    tx.businessHour.findUnique({ where: { businessId_weekday: { businessId, weekday } } }),
    tx.service.findFirst({
      where: { id: serviceId, businessId, active: true },
      include: { hours: { where: { weekday } } },
    }),
  ]);
  if (!service) return null;

  // A service with hasCustomHours fully replaces the business's default
  // hours for that weekday (rather than intersecting with them) — see
  // ServiceHour in prisma/schema.prisma.
  const hours = service.hasCustomHours ? service.hours[0] : businessHours;
  if (!hours || hours.isClosed || !hours.opensAt || !hours.closesAt) return null;

  const open = zonedTimeToUtc(dateKey, hours.opensAt);
  const close = zonedTimeToUtc(dateKey, hours.closesAt);
  const breaks: DayInterval[] = [];
  if (hours.breakStart && hours.breakEnd) {
    breaks.push({ start: zonedTimeToUtc(dateKey, hours.breakStart), end: zonedTimeToUtc(dateKey, hours.breakEnd) });
  }
  return { open, close, breaks, durationMinutes: service.durationMinutes };
}

// Narrows a base window down to one specialist's own working hours for that
// weekday, when they have a custom schedule (Specialist.hasCustomHours) —
// intersected with, never wider than, the base window. Returns null if the
// specialist doesn't work at all that day (or the base window itself is
// null/closed).
function narrowToSpecialist(
  base: { open: Date; close: Date; breaks: DayInterval[] } | null,
  specialistHasCustomHours: boolean,
  specialistHour: { opensAt: string | null; closesAt: string | null; isClosed: boolean; breakStart: string | null; breakEnd: string | null } | undefined,
  dateKey: string,
): { open: Date; close: Date; breaks: DayInterval[] } | null {
  if (!base) return null;
  if (!specialistHasCustomHours) return base;
  if (!specialistHour || specialistHour.isClosed || !specialistHour.opensAt || !specialistHour.closesAt) return null;

  const specOpen = zonedTimeToUtc(dateKey, specialistHour.opensAt);
  const specClose = zonedTimeToUtc(dateKey, specialistHour.closesAt);
  const open = specOpen > base.open ? specOpen : base.open;
  const close = specClose < base.close ? specClose : base.close;
  if (open >= close) return null;

  const breaks = [...base.breaks];
  if (specialistHour.breakStart && specialistHour.breakEnd) {
    breaks.push({
      start: zonedTimeToUtc(dateKey, specialistHour.breakStart),
      end: zonedTimeToUtc(dateKey, specialistHour.breakEnd),
    });
  }
  return { open, close, breaks };
}

function generateSlots(
  window: { open: Date; close: Date; breaks: DayInterval[] },
  durationMinutes: number,
  isFree: (slotStart: Date, slotEnd: Date) => boolean,
): string[] {
  const now = new Date();
  const slots: string[] = [];
  for (
    let slotStart = new Date(window.open);
    slotStart.getTime() + durationMinutes * 60_000 <= window.close.getTime();
    slotStart = new Date(slotStart.getTime() + SLOT_STEP_MINUTES * 60_000)
  ) {
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
    if (slotStart < now) continue;
    const overlapsBreak = window.breaks.some((b) => slotStart < b.end && slotEnd > b.start);
    if (!overlapsBreak && isFree(slotStart, slotEnd)) {
      slots.push(zonedHM(slotStart));
    }
  }
  return slots;
}

// Half-hour grid for one specific specialist, minus any window already taken
// by a non-cancelled appointment of theirs, minus their own hours (if they
// have a custom schedule) and anything already in the past if dateKey is
// today.
// Rate-limited only at the boundary that's actually reachable by an
// anonymous stranger (the public widget) — the staff-facing counterpart in
// appointments.ts and the internal re-check inside createPublicAppointment
// both call computeAvailableSlots directly, since throttling those by IP
// would either punish a whole office behind one NAT'd address or eat into
// the same budget as the booking submission it's validating.
export async function getAvailableSlots(
  businessId: string,
  specialistId: string,
  serviceId: string,
  dateKey: string,
): Promise<string[]> {
  const ip = await getClientIp();
  const rl = await checkRateLimit("public-slots", ip, 30, 60_000);
  if (!rl.allowed) return [];
  await recordFailedAttempt("public-slots", ip);
  return computeAvailableSlots(businessId, specialistId, serviceId, dateKey);
}

export async function computeAvailableSlots(
  businessId: string,
  specialistId: string,
  serviceId: string,
  dateKey: string,
): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];
  const dayStart = zonedMidnightUtc(dateKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const weekday = weekdayOf(dateKey);

  const [base, specialist, appointments] = await withTenant(businessId, (tx) =>
    Promise.all([
      resolveBaseWindow(tx, businessId, serviceId, dateKey),
      tx.specialist.findFirst({
        where: { id: specialistId, businessId },
        select: { hasCustomHours: true, hours: { where: { weekday } } },
      }),
      tx.appointment.findMany({
        where: {
          businessId,
          specialistId,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startsAt: { gte: dayStart, lt: dayEnd },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ])
  );
  if (!base || !specialist) return [];

  const window = narrowToSpecialist(base, specialist.hasCustomHours, specialist.hours[0], dateKey);
  if (!window) return [];

  return generateSlots(
    window,
    base.durationMinutes,
    (slotStart, slotEnd) => !appointments.some((a) => slotStart < a.endsAt && slotEnd > a.startsAt),
  );
}

// Half-hour grid for "any qualified specialist" — used when the business is
// in BUSINESS_ASSIGNS mode, so the client never picks a specific person. A
// slot is offered while at least one active specialist who performs this
// service is both working (per their own hours, intersected with the
// business/service hours) and not already busy then — busy meaning either
// an appointment already assigned to them (any service), or one of the
// business's own not-yet-assigned appointments for this same service
// claiming that time from the shared pool.
export async function getAvailableSlotsAnySpecialist(
  businessId: string,
  serviceId: string,
  dateKey: string,
): Promise<string[]> {
  const ip = await getClientIp();
  const rl = await checkRateLimit("public-slots", ip, 30, 60_000);
  if (!rl.allowed) return [];
  await recordFailedAttempt("public-slots", ip);
  return computeAvailableSlotsAnySpecialist(businessId, serviceId, dateKey);
}

export async function computeAvailableSlotsAnySpecialist(
  businessId: string,
  serviceId: string,
  dateKey: string,
): Promise<string[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];
  const dayStart = zonedMidnightUtc(dateKey);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const weekday = weekdayOf(dateKey);

  return withTenant(businessId, async (tx) => {
    const base = await resolveBaseWindow(tx, businessId, serviceId, dateKey);
    if (!base) return [];

    const [specialists, unassignedAppointments] = await Promise.all([
      tx.specialist.findMany({
        where: { businessId, active: true, services: { some: { serviceId } } },
        select: {
          id: true,
          hasCustomHours: true,
          hours: { where: { weekday } },
          appointments: {
            where: { status: { notIn: ["CANCELLED", "NO_SHOW"] }, startsAt: { gte: dayStart, lt: dayEnd } },
            select: { startsAt: true, endsAt: true },
          },
        },
      }),
      tx.appointment.findMany({
        where: {
          businessId,
          serviceId,
          specialistId: null,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startsAt: { gte: dayStart, lt: dayEnd },
        },
        select: { startsAt: true, endsAt: true },
      }),
    ]);
    if (specialists.length === 0) return [];

    const specialistWindows = specialists
      .map((s) => ({ appointments: s.appointments, window: narrowToSpecialist(base, s.hasCustomHours, s.hours[0], dateKey) }))
      .filter((s): s is { appointments: typeof specialists[number]["appointments"]; window: NonNullable<ReturnType<typeof narrowToSpecialist>> } => s.window != null);

    return generateSlots(base, base.durationMinutes, (slotStart, slotEnd) => {
      const availableCount = specialistWindows.filter((s) => {
        if (slotStart < s.window.open || slotEnd > s.window.close) return false;
        if (s.window.breaks.some((b) => slotStart < b.end && slotEnd > b.start)) return false;
        return !s.appointments.some((a) => slotStart < a.endsAt && slotEnd > a.startsAt);
      }).length;
      const claimedByUnassigned = unassignedAppointments.filter((a) => slotStart < a.endsAt && slotEnd > a.startsAt).length;
      return availableCount > claimedByUnassigned;
    });
  });
}

export type PublicBookingInput = {
  subdomain: string;
  // Omitted when the business is in BUSINESS_ASSIGNS mode — the widget never
  // shows a specialist picker in that case, so there's nothing to send.
  specialistId?: string;
  serviceId: string;
  dateKey: string;
  time: string;
  client: { firstName: string; lastName: string; phone: string; email?: string };
};

export type CreatePublicAppointmentResult = { success: true; cancelToken: string } | { success: false; error: string };

export async function createPublicAppointment(input: PublicBookingInput): Promise<CreatePublicAppointmentResult> {
  const ip = await getClientIp();
  const rl = await checkRateLimit("public-appointment", ip, 5, 10 * 60_000);
  if (!rl.allowed) return { success: false, error: rateLimitMessage(rl.retryAfterMinutes) };
  await recordFailedAttempt("public-appointment", ip);

  const business = await withSuperAdmin((tx) =>
    tx.business.findUnique({ where: { subdomain: input.subdomain.trim().toLowerCase() } })
  );
  if (!business) return { success: false, error: "Negocio no encontrado" };

  const clientParsed = ClientSchema.safeParse(input.client);
  if (!clientParsed.success) {
    return { success: false, error: clientParsed.error.issues[0]?.message ?? "Datos de contacto inválidos" };
  }

  const businessAssigns = business.specialistAssignmentMode === "BUSINESS_ASSIGNS";
  if (!businessAssigns && !input.specialistId) {
    return { success: false, error: "Elige un especialista" };
  }

  const result = await withTenant(
    business.id,
    async (tx): Promise<{ ok: false; error: string } | { ok: true; cancelToken: string }> => {
      const [specialist, service] = await Promise.all([
        input.specialistId
          ? tx.specialist.findFirst({ where: { id: input.specialistId, businessId: business.id, active: true } })
          : null,
        tx.service.findFirst({ where: { id: input.serviceId, businessId: business.id, active: true } }),
      ]);
      if (!businessAssigns && !specialist) return { ok: false, error: "Especialista no válido" };
      if (!service) return { ok: false, error: "Servicio no válido" };

      const startsAt = zonedTimeToUtc(input.dateKey, input.time);
      if (Number.isNaN(startsAt.getTime()) || startsAt < new Date()) {
        return { ok: false, error: "Elige una fecha y hora válidas" };
      }
      const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

      if (specialist) {
        const conflict = await tx.appointment.findFirst({
          where: {
            specialistId: specialist.id,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });
        if (conflict) return { ok: false, error: "Ese horario ya no está disponible, elige otro" };
      } else {
        // No fixed specialist yet — re-check the shared pool the same way
        // getAvailableSlotsAnySpecialist does, so a slot that filled up between
        // the widget loading and this submit gets rejected instead of silently
        // over-booking the business's real capacity. Runs as its own tenant
        // transaction (same businessId), which is fine nested here.
        const stillAvailable = (await computeAvailableSlotsAnySpecialist(business.id, service.id, input.dateKey)).includes(
          zonedHM(startsAt),
        );
        if (!stillAvailable) return { ok: false, error: "Ese horario ya no está disponible, elige otro" };
      }

      const existingClient = await tx.client.findUnique({
        where: { businessId_phone: { businessId: business.id, phone: clientParsed.data.phone } },
      });
      const clientId =
        existingClient?.id ??
        (
          await tx.client.create({
            data: {
              businessId: business.id,
              firstName: clientParsed.data.firstName,
              lastName: clientParsed.data.lastName,
              phone: clientParsed.data.phone,
              email: clientParsed.data.email || null,
            },
          })
        ).id;

      const created = await tx.appointment.create({
        data: {
          businessId: business.id,
          clientId,
          specialistId: specialist?.id ?? null,
          serviceId: service.id,
          startsAt,
          endsAt,
        },
        select: { cancelToken: true },
      });
      return { ok: true, cancelToken: created.cancelToken };
    },
  );

  if (!result.ok) return { success: false, error: result.error };
  void notifyLive(agendaChannel(business.id), "appointment");
  return { success: true, cancelToken: result.cancelToken };
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
  return withSuperAdmin((tx) =>
    tx.appointment.findUnique({
      where: { cancelToken: token },
      select: {
        id: true,
        startsAt: true,
        status: true,
        business: { select: { name: true, logoDataUrl: true, brandColor: true, brandBackground: true } },
        service: { select: { name: true } },
        client: { select: { firstName: true } },
      },
    })
  );
}

export async function cancelAppointmentByToken(token: string): Promise<ActionResult> {
  const ip = await getClientIp();
  const rl = await checkRateLimit("public-cancel", ip, 10, 60 * 60_000);
  if (!rl.allowed) return { success: false, error: rateLimitMessage(rl.retryAfterMinutes) };
  await recordFailedAttempt("public-cancel", ip);

  const result = await withSuperAdmin(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { cancelToken: token },
      select: { id: true, status: true, businessId: true },
    });
    if (!appointment) return { error: "Enlace inválido", businessId: null };
    if (appointment.status === "CANCELLED") return { error: "Esta cita ya fue cancelada", businessId: null };
    if (appointment.status === "ATTENDED") return { error: "Esta cita ya fue atendida", businessId: null };

    await tx.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });
    return { error: null, businessId: appointment.businessId };
  });
  if (result.error) return { success: false, error: result.error };

  revalidatePath("/agenda");
  if (result.businessId) void notifyLive(agendaChannel(result.businessId), "appointment");
  return { success: true };
}
