import { createAppointment } from "@/lib/actions/appointments";
import {
  addPendingAppointment,
  listPendingAppointmentsRaw,
  removePendingAppointment,
  setPendingAppointmentError,
  type PendingAppointment,
  type PendingAppointmentInput,
  type PendingAppointmentPreview,
} from "@/lib/offline/db";

export type { PendingAppointment, PendingAppointmentInput, PendingAppointmentPreview };

export async function queueAppointment(
  input: PendingAppointmentInput,
  preview: PendingAppointmentPreview
): Promise<PendingAppointment> {
  const appointment: PendingAppointment = {
    localId: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
    input,
    preview,
  };
  await addPendingAppointment(appointment);
  return appointment;
}

export async function listPendingAppointments(): Promise<PendingAppointment[]> {
  const rows = await listPendingAppointmentsRaw();
  return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

// Permanently drops a queued appointment without ever submitting it — used
// from the owner-only review screen (app/(app)/agenda/review/page.tsx) for
// one that genuinely can't be honored (e.g. the client already left).
// Distinct from a sync failure, which keeps the appointment queued.
export async function discardPendingAppointment(localId: string): Promise<void> {
  await removePendingAppointment(localId);
}

export type SyncResult = { synced: number; remaining: number };

// Best-effort: submits every queued appointment in order through the real
// createAppointment() action. A success removes it from the queue; a failure
// (e.g. the specialist already has a conflicting appointment, since another
// device booked it in the meantime) leaves it queued with its error message
// attached so the owner can resolve it by hand rather than losing — or
// silently double-booking — it.
export async function syncPendingAppointments(): Promise<SyncResult> {
  const pending = await listPendingAppointments();
  let synced = 0;
  for (const appointment of pending) {
    try {
      const result = await createAppointment({
        newClient: appointment.input.newClient,
        specialistId: appointment.input.specialistId,
        serviceId: appointment.input.serviceId,
        dateKey: appointment.input.dateKey,
        time: appointment.input.time,
        notes: appointment.input.notes,
      });
      if (result.success) {
        await removePendingAppointment(appointment.localId);
        synced++;
      } else {
        await setPendingAppointmentError(appointment.localId, result.error);
      }
    } catch {
      await setPendingAppointmentError(appointment.localId, "Sin conexión — se reintentará más tarde.");
    }
  }
  const remaining = (await listPendingAppointments()).length;
  return { synced, remaining };
}
