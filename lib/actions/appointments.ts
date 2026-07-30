"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
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
  specialist: { id: string; displayName: string };
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
  specialistId: string;
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
  if (!input.specialistId || !input.serviceId) {
    return { success: false, error: "Elige especialista y servicio" };
  }

  const [specialist, service] = await Promise.all([
    prisma.specialist.findFirst({ where: { id: input.specialistId, businessId, active: true } }),
    prisma.service.findFirst({ where: { id: input.serviceId, businessId, active: true } }),
  ]);
  if (!specialist) return { success: false, error: "Especialista no válido" };
  if (!service) return { success: false, error: "Servicio no válido" };

  const startsAt = new Date(`${input.dateKey}T${input.time}:00`);
  if (Number.isNaN(startsAt.getTime())) return { success: false, error: "Fecha u hora inválidas" };
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

  const conflict = await prisma.appointment.findFirst({
    where: {
      specialistId: specialist.id,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (conflict) return { success: false, error: "El especialista ya tiene una cita en ese horario" };

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
      specialistId: specialist.id,
      serviceId: service.id,
      startsAt,
      endsAt,
      notes: input.notes?.trim() || null,
    },
  });

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
