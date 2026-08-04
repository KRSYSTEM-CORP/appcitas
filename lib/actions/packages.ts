"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateKeyOf, zonedHM, zonedTimeToUtc } from "@/lib/timezone";
import { getAvailableSlots } from "@/lib/actions/public";
import { formatDayLabel } from "@/lib/format";
import type { ActionResult } from "@/lib/types";
import type { AppointmentStatus, PackagePaymentMode, PaymentMethod, Prisma } from "@prisma/client";

type TransactionLine = {
  id: string;
  amountLocalCents: number;
  amountForeignCents: number | null;
  paidCurrencyCode: string;
  currencyLocal: string;
  currencyForeign: string | null;
  paymentMethod: PaymentMethod;
  reference: string | null;
  paidAt: Date;
};

const TRANSACTION_SELECT = {
  id: true,
  amountLocalCents: true,
  amountForeignCents: true,
  paidCurrencyCode: true,
  currencyLocal: true,
  currencyForeign: true,
  paymentMethod: true,
  reference: true,
  paidAt: true,
} as const;

export type PackageListItem = {
  id: string;
  createdAt: Date;
  totalSessions: number;
  paymentMode: PackagePaymentMode;
  packagePriceCents: number | null;
  packagePriceCurrencyCode: string | null;
  client: { id: string; firstName: string; lastName: string; phone: string };
  specialist: { id: string; displayName: string };
  service: { id: string; name: string; basePriceCents: number; priceCurrencyCode: string };
  sessionsAttended: number;
  sessionsCancelled: number;
  transactions: TransactionLine[];
};

// range is a [start, end) window over Package.createdAt (when the package
// itself was scheduled, not any individual session's date); omit to list
// every package regardless of when it was created.
export async function listPackages(range?: { start: Date; end: Date }): Promise<PackageListItem[]> {
  const { businessId } = await requireSession();

  const packages = await prisma.sessionPackage.findMany({
    where: { businessId, ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}) },
    include: {
      client: { select: { id: true, firstName: true, lastName: true, phone: true } },
      specialist: { select: { id: true, displayName: true } },
      service: { select: { id: true, name: true, basePriceCents: true, priceCurrencyCode: true } },
      appointments: { select: { status: true } },
      transactions: { select: TRANSACTION_SELECT, orderBy: { paidAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return packages.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    totalSessions: p.totalSessions,
    paymentMode: p.paymentMode,
    packagePriceCents: p.packagePriceCents,
    packagePriceCurrencyCode: p.packagePriceCurrencyCode,
    client: p.client,
    specialist: p.specialist,
    service: p.service,
    sessionsAttended: p.appointments.filter((a) => a.status === "ATTENDED").length,
    sessionsCancelled: p.appointments.filter((a) => a.status === "CANCELLED").length,
    transactions: p.transactions,
  }));
}

export type PackageDetail = PackageListItem & {
  appointments: {
    id: string;
    sessionNumber: number | null;
    startsAt: Date;
    endsAt: Date;
    status: AppointmentStatus;
    cancelToken: string;
    transactions: TransactionLine[];
  }[];
};

const PACKAGE_DETAIL_INCLUDE = {
  client: { select: { id: true, firstName: true, lastName: true, phone: true } },
  specialist: { select: { id: true, displayName: true } },
  service: { select: { id: true, name: true, basePriceCents: true, priceCurrencyCode: true } },
  transactions: { select: TRANSACTION_SELECT, orderBy: { paidAt: "asc" as const } },
  appointments: {
    select: {
      id: true,
      sessionNumber: true,
      startsAt: true,
      endsAt: true,
      status: true,
      cancelToken: true,
      transactions: { select: TRANSACTION_SELECT, orderBy: { paidAt: "asc" as const } },
    },
    orderBy: { sessionNumber: "asc" as const },
  },
};

type PackageWithDetailInclude = Prisma.SessionPackageGetPayload<{ include: typeof PACKAGE_DETAIL_INCLUDE }>;

function toPackageDetail(pkg: PackageWithDetailInclude): PackageDetail {
  return {
    id: pkg.id,
    createdAt: pkg.createdAt,
    totalSessions: pkg.totalSessions,
    paymentMode: pkg.paymentMode,
    packagePriceCents: pkg.packagePriceCents,
    packagePriceCurrencyCode: pkg.packagePriceCurrencyCode,
    client: pkg.client,
    specialist: pkg.specialist,
    service: pkg.service,
    sessionsAttended: pkg.appointments.filter((a) => a.status === "ATTENDED").length,
    sessionsCancelled: pkg.appointments.filter((a) => a.status === "CANCELLED").length,
    transactions: pkg.transactions,
    appointments: pkg.appointments,
  };
}

export async function getPackage(packageId: string): Promise<PackageDetail | null> {
  const { businessId } = await requireSession();
  const pkg = await prisma.sessionPackage.findFirst({
    where: { id: packageId, businessId },
    include: PACKAGE_DETAIL_INCLUDE,
  });
  return pkg ? toPackageDetail(pkg) : null;
}

// Powers the "Paquetes de este cliente" section on the client edit page —
// lets the owner report attendance (asistió/no asistió/cancelada) per
// session without leaving that client's page.
export async function listPackagesByClient(clientId: string): Promise<PackageDetail[]> {
  const { businessId } = await requireSession();
  const packages = await prisma.sessionPackage.findMany({
    where: { businessId, clientId },
    include: PACKAGE_DETAIL_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return packages.map(toPackageDetail);
}

export type CreatePackageInput = {
  clientId?: string;
  newClient?: { firstName: string; lastName: string; phone: string; email?: string };
  specialistId: string;
  serviceId: string;
  totalSessions: number;
  intervalDays: number;
  dateKey: string;
  time: string;
  notes?: string;
  paymentMode: PackagePaymentMode;
  packagePrice?: number;
  packagePriceCurrencyCode?: string;
};

// Sessions are generated from a single start date/time + a fixed interval
// (in days) rather than picked one by one — each becomes its own Appointment
// (own attendance status) linked back here via packageId/sessionNumber, so
// the rest of the app (Agenda, WhatsApp reminders, status changes) treats
// them exactly like any other appointment except for how payment is tracked.
export async function createPackage(input: CreatePackageInput): Promise<ActionResult> {
  const { businessId } = await requireSession();

  if (!input.clientId && !input.newClient) {
    return { success: false, error: "Elige un cliente o registra uno nuevo" };
  }
  if (!input.specialistId || !input.serviceId) {
    return { success: false, error: "Elige especialista y servicio" };
  }
  if (!Number.isInteger(input.totalSessions) || input.totalSessions < 2 || input.totalSessions > 52) {
    return { success: false, error: "Un paquete debe tener entre 2 y 52 sesiones" };
  }
  if (!Number.isInteger(input.intervalDays) || input.intervalDays < 1 || input.intervalDays > 90) {
    return { success: false, error: "El intervalo entre sesiones debe ser de 1 a 90 días" };
  }
  if (input.paymentMode === "PACKAGE" && (!input.packagePrice || input.packagePrice <= 0)) {
    return { success: false, error: "Indica el precio total del paquete" };
  }

  const [specialist, service] = await Promise.all([
    prisma.specialist.findFirst({ where: { id: input.specialistId, businessId, active: true } }),
    prisma.service.findFirst({ where: { id: input.serviceId, businessId, active: true } }),
  ]);
  if (!specialist) return { success: false, error: "Especialista no válido" };
  if (!service) return { success: false, error: "Servicio no válido" };

  const firstStart = zonedTimeToUtc(input.dateKey, input.time);
  if (Number.isNaN(firstStart.getTime())) return { success: false, error: "Fecha u hora inválidas" };

  // Each session lands on its own calendar day (intervalDays >= 1), so no two
  // sessions of the same package ever share a dateKey.
  const sessions = Array.from({ length: input.totalSessions }, (_, i) => {
    const startsAt = new Date(firstStart.getTime() + i * input.intervalDays * 24 * 60 * 60_000);
    return { startsAt, endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000) };
  });

  // Same free/busy + business-hours/break source the single-appointment
  // picker and the public booking link use (getAvailableSlots) — reused here
  // instead of a separate ad-hoc conflict query so a package can never book a
  // session outside business hours, inside a break, or over an existing
  // appointment, the way a single "Nueva cita" already can't.
  for (const session of sessions) {
    const sessionDateKey = dateKeyOf(session.startsAt);
    const slots = await getAvailableSlots(businessId, specialist.id, service.id, sessionDateKey);
    if (!slots.includes(zonedHM(session.startsAt))) {
      return {
        success: false,
        error: `La sesión del ${formatDayLabel(session.startsAt)} a las ${zonedHM(session.startsAt)} cae fuera del horario de atención, coincide con un descanso o ya tiene una cita — ajusta la hora o el intervalo.`,
      };
    }
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

  const packagePriceCents = input.paymentMode === "PACKAGE" ? Math.round(input.packagePrice! * 100) : null;
  const packagePriceCurrencyCode =
    input.paymentMode === "PACKAGE" ? input.packagePriceCurrencyCode || service.priceCurrencyCode : null;
  const notes = input.notes?.trim() || null;
  const resolvedClientId = clientId;

  await prisma.$transaction(async (tx) => {
    const pkg = await tx.sessionPackage.create({
      data: {
        businessId,
        clientId: resolvedClientId,
        specialistId: specialist.id,
        serviceId: service.id,
        totalSessions: input.totalSessions,
        paymentMode: input.paymentMode,
        packagePriceCents,
        packagePriceCurrencyCode,
      },
    });
    await tx.appointment.createMany({
      data: sessions.map((s, i) => ({
        businessId,
        clientId: resolvedClientId,
        specialistId: specialist.id,
        serviceId: service.id,
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        packageId: pkg.id,
        sessionNumber: i + 1,
        notes,
        cancelToken: crypto.randomUUID(),
      })),
    });
  });

  revalidatePath("/agenda");
  revalidatePath("/packages");
  return { success: true };
}

// Blocked once the package has any real value attached — a payment (at the
// package level OR on any individual session, since PER_SESSION mode pays
// per-appointment) or an attended session — so deleting a package can never
// quietly erase revenue or attendance history. Safe to delete otherwise: the
// not-yet-happened sessions are removed along with it, not just detached.
export async function deletePackage(packageId: string): Promise<ActionResult> {
  const { businessId } = await requireSession();

  const pkg = await prisma.sessionPackage.findFirst({
    where: { id: packageId, businessId },
    select: {
      transactions: { select: { id: true } },
      appointments: { select: { status: true, transactions: { select: { id: true } } } },
    },
  });
  if (!pkg) return { success: false, error: "Paquete no encontrado" };

  const hasPayment = pkg.transactions.length > 0 || pkg.appointments.some((a) => a.transactions.length > 0);
  if (hasPayment) {
    return { success: false, error: "No se puede eliminar: este paquete tiene pagos registrados" };
  }
  if (pkg.appointments.some((a) => a.status === "ATTENDED")) {
    return { success: false, error: "No se puede eliminar: este paquete tiene sesiones ya asistidas" };
  }

  await prisma.$transaction([
    prisma.appointment.deleteMany({ where: { packageId } }),
    prisma.sessionPackage.delete({ where: { id: packageId } }),
  ]);

  revalidatePath("/packages");
  revalidatePath("/agenda");
  return { success: true };
}
