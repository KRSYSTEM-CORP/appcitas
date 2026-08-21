"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { zonedTimeToUtc } from "@/lib/timezone";
import { getAvailableSlots, getAvailableSlotsAnySpecialist } from "@/lib/actions/public";
import type { ActionResult } from "@/lib/types";
import type { AppointmentStatus, PackagePaymentMode, PaymentMethod } from "@prisma/client";

export type AppointmentListItem = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  notes: string | null;
  cancelToken: string;
  sessionNumber: number | null;
  sessionPackage: { id: string; totalSessions: number; paymentMode: PackagePaymentMode } | null;
  client: { id: string; firstName: string; lastName: string; phone: string };
  // Null when the business is in BUSINESS_ASSIGNS mode and staff hasn't
  // distributed this appointment to a specialist yet.
  specialist: { id: string; displayName: string } | null;
  service: { id: string; name: string; durationMinutes: number; basePriceCents: number; priceCurrencyCode: string };
  transactions: {
    id: string;
    amountLocalCents: number;
    amountForeignCents: number | null;
    paidCurrencyCode: string;
    currencyLocal: string;
    currencyForeign: string | null;
    paymentMethod: PaymentMethod;
    reference: string | null;
    paidAt: Date;
  }[];
};

// [start, end) — used for day/week/month agenda views alike (see
// app/(app)/agenda/page.tsx), which just differ in how wide a range they ask
// for and how they group the results, not in the query itself.
export async function listAppointmentsInRange(start: Date, end: Date): Promise<AppointmentListItem[]> {
  const { businessId } = await requireSession();

  return prisma.appointment.findMany({
    where: { businessId, startsAt: { gte: start, lt: end } },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      specialist: { select: { id: true, displayName: true } },
      service: {
        select: { id: true, name: true, durationMinutes: true, basePriceCents: true, priceCurrencyCode: true },
      },
      sessionPackage: { select: { id: true, totalSessions: true, paymentMode: true } },
      transactions: {
        select: {
          id: true,
          amountLocalCents: true,
          amountForeignCents: true,
          paidCurrencyCode: true,
          currencyLocal: true,
          currencyForeign: true,
          paymentMethod: true,
          reference: true,
          paidAt: true,
        },
        orderBy: { paidAt: "asc" },
      },
    },
    orderBy: { startsAt: "asc" },
  });
}

export type CreateAppointmentInput = {
  clientId?: string;
  newClient?: { firstName: string; lastName: string; phone: string; email?: string };
  // Optional so staff can leave a cita "Sin asignar" and distribute it from
  // the agenda later (assignSpecialist below) — independent of the
  // business's SpecialistAssignmentMode, which only governs the public
  // booking widget.
  specialistId?: string;
  serviceId: string;
  dateKey: string;
  time: string;
  notes?: string;
};

export async function createAppointment(input: CreateAppointmentInput): Promise<ActionResult> {
  const { businessId } = await requireSession();

  if (!input.clientId && !input.newClient) {
    return { success: false, error: "Elige un cliente o registra uno nuevo" };
  }
  if (!input.serviceId) {
    return { success: false, error: "Elige un servicio" };
  }

  const [specialist, service] = await Promise.all([
    input.specialistId
      ? prisma.specialist.findFirst({ where: { id: input.specialistId, businessId, active: true } })
      : null,
    prisma.service.findFirst({ where: { id: input.serviceId, businessId, active: true } }),
  ]);
  if (input.specialistId && !specialist) return { success: false, error: "Especialista no válido" };
  if (!service) return { success: false, error: "Servicio no válido" };

  const startsAt = zonedTimeToUtc(input.dateKey, input.time);
  if (Number.isNaN(startsAt.getTime())) return { success: false, error: "Fecha u hora inválidas" };
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  if (specialist) {
    const conflict = await prisma.appointment.findFirst({
      where: {
        specialistId: specialist.id,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (conflict) return { success: false, error: "El especialista ya tiene una cita en ese horario" };
  }

  let clientId = input.clientId;
  if (!clientId && input.newClient) {
    const trimmedPhone = input.newClient.phone.trim();
    if (!input.newClient.firstName.trim() || !input.newClient.lastName.trim() || !trimmedPhone) {
      return { success: false, error: "Nombre, apellido y teléfono del cliente son obligatorios" };
    }
    const existing = await prisma.client.findUnique({
      where: { businessId_phone: { businessId, phone: trimmedPhone } },
    });
    if (existing) {
      clientId = existing.id;
    } else {
      const created = await prisma.client.create({
        data: {
          businessId,
          firstName: input.newClient.firstName.trim(),
          lastName: input.newClient.lastName.trim(),
          phone: trimmedPhone,
          email: input.newClient.email?.trim() || null,
        },
      });
      clientId = created.id;
    }
  }
  if (!clientId) return { success: false, error: "Elige un cliente o registra uno nuevo" };

  await prisma.appointment.create({
    data: {
      businessId,
      clientId,
      specialistId: specialist?.id ?? null,
      serviceId: service.id,
      startsAt,
      endsAt,
      notes: input.notes?.trim() || null,
    },
  });

  revalidatePath("/agenda");
  return { success: true };
}

// Distributes an unassigned (or reassigns an already-assigned) appointment
// to a specialist — the day-to-day workflow for a business in
// BUSINESS_ASSIGNS mode, but usable any time staff wants to change who's
// covering a cita. Re-validates qualification and schedule conflict the same
// way createAppointment does, since the appointment may have been created
// without ever checking a specific specialist's availability.
export async function assignSpecialist(appointmentId: string, specialistId: string): Promise<ActionResult> {
  const { businessId } = await requireSession();

  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, businessId } });
  if (!appointment) return { success: false, error: "Cita no encontrada" };

  const specialist = await prisma.specialist.findFirst({
    where: { id: specialistId, businessId, active: true },
    include: { services: { where: { serviceId: appointment.serviceId } } },
  });
  if (!specialist) return { success: false, error: "Especialista no válido" };
  if (specialist.services.length === 0) {
    return { success: false, error: "Ese especialista no ofrece el servicio de esta cita" };
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      id: { not: appointmentId },
      specialistId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { lt: appointment.endsAt },
      endsAt: { gt: appointment.startsAt },
    },
  });
  if (conflict) return { success: false, error: "Ese especialista ya tiene una cita en ese horario" };

  await prisma.appointment.update({ where: { id: appointmentId }, data: { specialistId } });

  revalidatePath("/agenda");
  return { success: true };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<ActionResult> {
  const { businessId } = await requireSession();

  const { count } = await prisma.appointment.updateMany({
    where: { id: appointmentId, businessId },
    data: { status },
  });
  if (count === 0) return { success: false, error: "Cita no encontrada" };

  revalidatePath("/agenda");
  return { success: true };
}

// Session-authenticated counterpart to the public getAvailableSlots (used by
// the public booking widget) — resolves businessId from the signed-in
// session instead of trusting a client-supplied one, so the internal "Nueva
// cita" form shows staff exactly the same free/busy slots a client would see
// on the public booking link, instead of a free-text time field. Staff can
// leave the specialist unset (regardless of the business's
// SpecialistAssignmentMode) to see combined availability and assign someone
// later — see getAvailableSlotsAnySpecialist.
export async function getAvailableSlotsForStaff(
  specialistId: string | undefined,
  serviceId: string,
  dateKey: string,
): Promise<string[]> {
  const { businessId } = await requireSession();
  return specialistId
    ? getAvailableSlots(businessId, specialistId, serviceId, dateKey)
    : getAvailableSlotsAnySpecialist(businessId, serviceId, dateKey);
}
