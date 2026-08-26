"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/tenant-db";
import { requireSession } from "@/lib/session";
import { ClientSchema } from "@/lib/validations";
import type { ActionResult } from "@/lib/types";

export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
};

// Any signed-in role can manage clients — a specialist booking their own
// agenda needs to add walk-in clients too, not just the owner. Deleted
// (active=false) clients are excluded, so they also drop out of every
// client picker (new appointment/package forms reuse this same query).
export async function listClients(): Promise<ClientListItem[]> {
  const { businessId } = await requireSession();
  return withTenant(businessId, (tx) =>
    tx.client.findMany({
      where: { businessId, active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    })
  );
}

export async function getClient(clientId: string): Promise<ClientListItem | null> {
  const { businessId } = await requireSession();
  return withTenant(businessId, (tx) =>
    tx.client.findFirst({ where: { id: clientId, businessId, active: true } })
  );
}

export type ClientCrmItem = ClientListItem & {
  lastVisit: Date | null;
  lastServiceName: string | null;
  totalVisits: number;
};

// Powers /crm — who to reach out to for reactivation. A client is never
// "attended" until an appointment is explicitly marked ATTENDED (see
// AppointmentCard's status select), so a PENDING/CONFIRMED appointment
// doesn't count as a real visit here even if it's in the past.
export async function listClientsForCrm(): Promise<ClientCrmItem[]> {
  const { businessId } = await requireSession();
  const [clients, attended] = await withTenant(businessId, (tx) =>
    Promise.all([
      tx.client.findMany({ where: { businessId, active: true } }),
      tx.appointment.findMany({
        where: { businessId, status: "ATTENDED" },
        select: { clientId: true, startsAt: true, service: { select: { name: true } } },
        orderBy: { startsAt: "desc" },
      }),
    ])
  );

  const lastByClient = new Map<string, { startsAt: Date; serviceName: string }>();
  const visitCounts = new Map<string, number>();
  for (const a of attended) {
    visitCounts.set(a.clientId, (visitCounts.get(a.clientId) ?? 0) + 1);
    // attended is ordered startsAt desc, so the first hit per client is its
    // most recent visit.
    if (!lastByClient.has(a.clientId)) {
      lastByClient.set(a.clientId, { startsAt: a.startsAt, serviceName: a.service.name });
    }
  }

  return clients
    .map((c) => {
      const last = lastByClient.get(c.id);
      return {
        ...c,
        lastVisit: last?.startsAt ?? null,
        lastServiceName: last?.serviceName ?? null,
        totalVisits: visitCounts.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => {
      // Never-visited clients surface first, then longest-absent — these are
      // the ones most worth a reactivation message.
      if (a.lastVisit === null && b.lastVisit === null) return 0;
      if (a.lastVisit === null) return -1;
      if (b.lastVisit === null) return 1;
      return a.lastVisit.getTime() - b.lastVisit.getTime();
    });
}

function parseClientForm(formData: FormData) {
  return ClientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createClient(formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireSession();

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const created = await withTenant(businessId, async (tx) => {
    const existing = await tx.client.findUnique({
      where: { businessId_phone: { businessId, phone: parsed.data.phone } },
    });
    if (existing) return null;

    await tx.client.create({
      data: {
        businessId,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
      },
    });
    return true;
  });
  if (!created) return { success: false, error: "Ya existe un cliente con ese teléfono" };

  revalidatePath("/clients");
  return { success: true };
}

export async function updateClient(clientId: string, formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireSession();

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const result = await withTenant(businessId, async (tx) => {
    const existing = await tx.client.findUnique({
      where: { businessId_phone: { businessId, phone: parsed.data.phone } },
    });
    if (existing && existing.id !== clientId) return "duplicate" as const;

    const { count } = await tx.client.updateMany({
      where: { id: clientId, businessId },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
      },
    });
    return count === 0 ? ("not_found" as const) : ("ok" as const);
  });

  if (result === "duplicate") return { success: false, error: "Ya existe un cliente con ese teléfono" };
  if (result === "not_found") return { success: false, error: "Cliente no encontrado" };

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

// Soft delete — flips active=false instead of removing the row, so every
// Appointment/Transaction that already points at this client keeps working
// exactly as before and every revenue/attendance report stays unchanged.
// The client just disappears from /clients and from client pickers.
export async function deleteClient(clientId: string): Promise<ActionResult> {
  const { businessId } = await requireSession();

  const { count } = await withTenant(businessId, (tx) =>
    tx.client.updateMany({
      where: { id: clientId, businessId },
      data: { active: false },
    })
  );
  if (count === 0) return { success: false, error: "Cliente no encontrado" };

  revalidatePath("/clients");
  return { success: true };
}
