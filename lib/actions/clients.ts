"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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
  return prisma.client.findMany({
    where: { businessId, active: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

export async function getClient(clientId: string): Promise<ClientListItem | null> {
  const { businessId } = await requireSession();
  return prisma.client.findFirst({ where: { id: clientId, businessId, active: true } });
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

  const existing = await prisma.client.findUnique({
    where: { businessId_phone: { businessId, phone: parsed.data.phone } },
  });
  if (existing) {
    return { success: false, error: "Ya existe un cliente con ese teléfono" };
  }

  await prisma.client.create({
    data: {
      businessId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/clients");
  return { success: true };
}

export async function updateClient(clientId: string, formData: FormData): Promise<ActionResult> {
  const { businessId } = await requireSession();

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existing = await prisma.client.findUnique({
    where: { businessId_phone: { businessId, phone: parsed.data.phone } },
  });
  if (existing && existing.id !== clientId) {
    return { success: false, error: "Ya existe un cliente con ese teléfono" };
  }

  const { count } = await prisma.client.updateMany({
    where: { id: clientId, businessId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      notes: parsed.data.notes || null,
    },
  });
  if (count === 0) return { success: false, error: "Cliente no encontrado" };

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

  const { count } = await prisma.client.updateMany({
    where: { id: clientId, businessId },
    data: { active: false },
  });
  if (count === 0) return { success: false, error: "Cliente no encontrado" };

  revalidatePath("/clients");
  return { success: true };
}
