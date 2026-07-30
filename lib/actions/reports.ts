"use server";

import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { toDateKey } from "@/lib/format";

const DAILY_CHART_DAYS = 14;

export type ReportPeriod = "day" | "week" | "month";

export type ReportsSummary = {
  period: ReportPeriod;
  currencyCode: string;
  periodRevenueLocalCents: number;
  revenueByCurrency: { currencyCode: string; cents: number }[];
  appointmentsToday: number;
  appointmentsInPeriod: number;
  topServices: { name: string; count: number }[];
  newClientsCount: number;
  newClients: { id: string; firstName: string; lastName: string; phone: string; appointmentCount: number }[];
  recurringClientsCount: number;
  recurringClients: { id: string; firstName: string; lastName: string; phone: string; appointmentCount: number }[];
  clientsByService: { serviceId: string; serviceName: string; newClients: number; recurringClients: number }[];
  dailyRevenue: { dateKey: string; cents: number }[];
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// end=null means "from start through now" (week/month); day gets an
// explicit upper bound so it doesn't creep into tomorrow.
function getPeriodRange(period: ReportPeriod, now: Date): { start: Date; end: Date | null } {
  const todayStart = startOfDay(now);
  if (period === "day") {
    return { start: todayStart, end: new Date(todayStart.getTime() + 24 * 60 * 60_000) };
  }
  if (period === "week") {
    return { start: new Date(todayStart.getTime() - 6 * 24 * 60 * 60_000), end: null };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
}

// A payment can be recorded against a single Appointment OR against a whole
// Package (packageId, appointmentId null — see prisma/schema.prisma's
// Transaction model). Filtering by `appointment: { businessId }` alone
// silently excludes package-level payments, which used to make them
// invisible in every revenue figure below.
function transactionBusinessFilter(businessId: string) {
  return { OR: [{ appointment: { businessId } }, { sessionPackage: { businessId } }] };
}

export async function getReportsSummary(period: ReportPeriod = "month"): Promise<ReportsSummary> {
  const { businessId } = await requireOwner();

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60_000);
  const { start: periodStart, end: periodEnd } = getPeriodRange(period, now);
  const periodPaidAtFilter = periodEnd ? { gte: periodStart, lt: periodEnd } : { gte: periodStart };
  const periodStartsAtFilter = periodEnd ? { gte: periodStart, lt: periodEnd } : { gte: periodStart };
  const chartStart = new Date(todayStart.getTime() - (DAILY_CHART_DAYS - 1) * 24 * 60 * 60_000);

  const [
    business,
    periodTransactions,
    appointmentsToday,
    appointmentsInPeriod,
    topServiceGroups,
    newClientRecords,
    chartTransactions,
  ] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { localCurrencyCode: true } }),
    prisma.transaction.findMany({
      where: { ...transactionBusinessFilter(businessId), paidAt: periodPaidAtFilter },
      select: { paidCurrencyCode: true, amountLocalCents: true, amountForeignCents: true, currencyForeign: true },
    }),
    prisma.appointment.count({ where: { businessId, startsAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.appointment.count({ where: { businessId, startsAt: periodStartsAtFilter } }),
    prisma.appointment.groupBy({
      by: ["serviceId"],
      where: { businessId, startsAt: periodStartsAtFilter },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: "desc" } },
      take: 5,
    }),
    // Not filtered by active — a client who was later deleted still
    // shows up here, same as they still show up on their old
    // appointments, so deleting a client never changes report numbers.
    prisma.client.findMany({
      where: { businessId, createdAt: periodStartsAtFilter },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    prisma.transaction.findMany({
      where: { ...transactionBusinessFilter(businessId), paidAt: { gte: chartStart } },
      select: { amountLocalCents: true, paidAt: true },
    }),
  ]);

  // Revenue actually received per currency (unconverted) alongside the
  // local-currency-equivalent total — e.g. "Bs. 5.000 + $50" rather than
  // collapsing everything into one converted figure.
  const revenueByCurrencyMap = new Map<string, number>();
  let periodRevenueLocalCents = 0;
  for (const t of periodTransactions) {
    periodRevenueLocalCents += t.amountLocalCents;
    const paidForeign = t.paidCurrencyCode === t.currencyForeign;
    const nativeCents = paidForeign ? (t.amountForeignCents ?? t.amountLocalCents) : t.amountLocalCents;
    revenueByCurrencyMap.set(t.paidCurrencyCode, (revenueByCurrencyMap.get(t.paidCurrencyCode) ?? 0) + nativeCents);
  }
  const revenueByCurrency = [...revenueByCurrencyMap.entries()]
    .map(([currencyCode, cents]) => ({ currencyCode, cents }))
    .sort((a, b) => b.cents - a.cents);

  let newClients: ReportsSummary["newClients"] = [];
  if (newClientRecords.length > 0) {
    const newClientIds = newClientRecords.map((c) => c.id);
    const appointmentCounts = await prisma.appointment.groupBy({
      by: ["clientId"],
      where: { businessId, clientId: { in: newClientIds } },
      _count: { clientId: true },
    });
    const countByClientId = new Map(appointmentCounts.map((c) => [c.clientId, c._count.clientId]));
    newClients = newClientRecords
      .map((c) => ({ ...c, appointmentCount: countByClientId.get(c.id) ?? 0 }))
      .sort((a, b) => b.appointmentCount - a.appointmentCount)
      .slice(0, 10);
  }

  const services = await prisma.service.findMany({
    where: { id: { in: topServiceGroups.map((g) => g.serviceId) } },
    select: { id: true, name: true },
  });
  const serviceNameById = new Map(services.map((s) => [s.id, s.name]));
  const topServices = topServiceGroups.map((g) => ({
    name: serviceNameById.get(g.serviceId) ?? "Servicio eliminado",
    count: g._count.serviceId,
  }));

  // Recurring = a client with an appointment in the period whose earliest
  // appointment (ever, for this business) predates the period. New = a
  // client with an appointment in the period whose record itself was
  // created within the period (mirrors newClientsCount's own definition).
  const periodAppointments = await prisma.appointment.findMany({
    where: { businessId, startsAt: periodStartsAtFilter },
    select: { clientId: true, serviceId: true },
  });
  const periodClientIds = [...new Set(periodAppointments.map((a) => a.clientId))];

  let recurringClientsCount = 0;
  let recurringClients: ReportsSummary["recurringClients"] = [];
  let clientsByService: ReportsSummary["clientsByService"] = [];

  if (periodClientIds.length > 0) {
    const [firstAppointments, periodClientRecords] = await Promise.all([
      prisma.appointment.groupBy({
        by: ["clientId"],
        where: { businessId, clientId: { in: periodClientIds } },
        _min: { startsAt: true },
      }),
      prisma.client.findMany({ where: { id: { in: periodClientIds } }, select: { id: true, createdAt: true } }),
    ]);

    const recurringClientIdSet = new Set(
      firstAppointments.filter((f) => f._min.startsAt && f._min.startsAt < periodStart).map((f) => f.clientId),
    );
    recurringClientsCount = recurringClientIdSet.size;
    const newClientIdSet = new Set(periodClientRecords.filter((c) => c.createdAt >= periodStart).map((c) => c.id));

    if (recurringClientIdSet.size > 0) {
      const [clients, appointmentCounts] = await Promise.all([
        prisma.client.findMany({
          where: { id: { in: [...recurringClientIdSet] } },
          select: { id: true, firstName: true, lastName: true, phone: true },
        }),
        prisma.appointment.groupBy({
          by: ["clientId"],
          where: { businessId, clientId: { in: [...recurringClientIdSet] } },
          _count: { clientId: true },
        }),
      ]);
      const countByClientId = new Map(appointmentCounts.map((c) => [c.clientId, c._count.clientId]));
      recurringClients = clients
        .map((c) => ({ ...c, appointmentCount: countByClientId.get(c.id) ?? 0 }))
        .sort((a, b) => b.appointmentCount - a.appointmentCount)
        .slice(0, 10);
    }

    // Per-service breakdown — a client counts under every service they
    // booked in the period, since new/recurring classifies the client, not
    // any one appointment.
    const byService = new Map<string, { newClients: Set<string>; recurringClients: Set<string> }>();
    for (const a of periodAppointments) {
      let entry = byService.get(a.serviceId);
      if (!entry) {
        entry = { newClients: new Set(), recurringClients: new Set() };
        byService.set(a.serviceId, entry);
      }
      if (newClientIdSet.has(a.clientId)) entry.newClients.add(a.clientId);
      if (recurringClientIdSet.has(a.clientId)) entry.recurringClients.add(a.clientId);
    }
    const byServiceIds = [...byService.keys()];
    const byServiceInfo = await prisma.service.findMany({
      where: { id: { in: byServiceIds } },
      select: { id: true, name: true },
    });
    const byServiceNameById = new Map(byServiceInfo.map((s) => [s.id, s.name]));
    clientsByService = byServiceIds
      .map((id) => {
        const entry = byService.get(id)!;
        return {
          serviceId: id,
          serviceName: byServiceNameById.get(id) ?? "Servicio eliminado",
          newClients: entry.newClients.size,
          recurringClients: entry.recurringClients.size,
        };
      })
      .sort((a, b) => b.newClients + b.recurringClients - (a.newClients + a.recurringClients));
  }

  const revenueByDay = new Map<string, number>();
  for (const t of chartTransactions) {
    const key = toDateKey(t.paidAt);
    revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + t.amountLocalCents);
  }
  const dailyRevenue: { dateKey: string; cents: number }[] = [];
  for (let i = 0; i < DAILY_CHART_DAYS; i++) {
    const d = new Date(chartStart.getTime() + i * 24 * 60 * 60_000);
    const key = toDateKey(d);
    dailyRevenue.push({ dateKey: key, cents: revenueByDay.get(key) ?? 0 });
  }

  return {
    period,
    currencyCode: business.localCurrencyCode,
    periodRevenueLocalCents,
    revenueByCurrency,
    appointmentsToday,
    appointmentsInPeriod,
    topServices,
    newClientsCount: newClientRecords.length,
    newClients,
    recurringClientsCount,
    recurringClients,
    clientsByService,
    dailyRevenue,
  };
}
